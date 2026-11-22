import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const CATS = ["Երաժշտություն", "Թատրոն", "Ստենդափ", "Սպորտ", "Կոնֆերանս"];

export default async function NewEvent(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const halls = await db.hall.findMany({ orderBy: { name: "asc" } });
  const zones = (await db.seat.groupBy({ by: ["zone"] })).map((z) => z.zone);

  async function create(formData: FormData) {
    "use server";
    await requireAdmin();
    const f = (k: string) => String(formData.get(k) ?? "").trim();
    const currency = f("currency") === "USD" ? "USD" : "AMD";
    const startsAt = new Date(`${f("startsAt")}:00+04:00`); // Yerevan time
    const basePrice = Number(f("price1"));
    const hallId = f("hallId");
    const hall = hallId
      ? await db.hall.findUnique({ where: { id: hallId } })
      : null;
    if (!f("title") || isNaN(startsAt.getTime()) || !(basePrice > 0))
      redirect("/admin/new?error=1");

    let types: {
      name: string;
      priceCents: number;
      currency: string;
      quantityTotal: number;
    }[] = [];
    let seats: { id: string; zone: string }[] = [];

    if (hall) {
      // Seated: one ticket type per hall zone; quantity = number of seats in the zone.
      seats = await db.seat.findMany({
        where: { hallId: hall.id },
        select: { id: true, zone: true },
      });
      const counts = new Map<string, number>();
      for (const s of seats) counts.set(s.zone, (counts.get(s.zone) ?? 0) + 1);
      types = [...counts].map(([zone, count]) => ({
        name: zone,
        currency,
        quantityTotal: count,
        priceCents: Math.round((Number(f(`zp_${zone}`)) || basePrice) * 100),
      }));
    } else {
      if (!f("city") || !f("venue")) redirect("/admin/new?error=1");
      for (const [name, p, q] of [
        ["Standard", "price1", "qty1"],
        ["VIP", "price2", "qty2"],
      ] as const) {
        const price = Number(f(p)),
          qty = Number(f(q));
        if (price > 0 && qty > 0)
          types.push({
            name,
            priceCents: Math.round(price * 100),
            currency,
            quantityTotal: Math.floor(qty),
          });
      }
      if (types.length === 0) redirect("/admin/new?error=1");
    }

    const ev = await db.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title: f("title"),
          category: f("category"),
          city: hall?.city ?? f("city"),
          venue: hall?.name ?? f("venue"),
          hallId: hall?.id,
          description: f("description"),
          startsAt,
          isPublished: true,
          ticketTypes: { create: types },
        },
      });
      if (hall)
        await tx.eventSeat.createMany({
          data: seats.map((s) => ({ eventId: created.id, seatId: s.id })),
        });
      return created;
    });
    redirect(`/admin/events/${ev.id}`);
  }

  return (
    <main>
      <h1>Նոր միջոցառում</h1>
      <form action={create} className="panel stack" style={{ maxWidth: 640 }}>
        <label>
          Անվանում
          <input name="title" required />
        </label>
        <label>
          Կատեգորիա
          <select name="category">
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Դահլիճ
          <select name="hallId">
            <option value="">Առանց նստատեղերի (ընդհանուր մուտք)</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}, {h.city}
              </option>
            ))}
          </select>
        </label>
        <label>
          Քաղաք (եթե դահլիճ չես ընտրել)
          <input name="city" />
        </label>
        <label>
          Վայր (եթե դահլիճ չես ընտրել)
          <input name="venue" />
        </label>
        <label>
          Նկարագրություն
          <input name="description" required />
        </label>
        <label>
          Սկիզբ (Երևանի ժամանակով)
          <input type="datetime-local" name="startsAt" required />
        </label>
        <label>
          Արժույթ
          <select name="currency">
            <option value="AMD">AMD ֏</option>
            <option value="USD">USD $</option>
          </select>
        </label>
        <label>
          Հիմնական գին (Standard)
          <input type="number" name="price1" min={1} step="any" required />
        </label>
        <label>
          Standard՝ քանակ (առանց դահլիճի)
          <input type="number" name="qty1" min={0} />
        </label>
        <label>
          VIP՝ գին (առանց դահլիճի, ըստ ցանկության)
          <input type="number" name="price2" min={0} step="any" />
        </label>
        <label>
          VIP՝ քանակ (առանց դահլիճի)
          <input type="number" name="qty2" min={0} />
        </label>
        {zones.length > 0 && (
          <strong>Գները ըստ գոտիների (դահլիճ ընտրելիս)</strong>
        )}
        {zones.map((z) => (
          <label key={z}>
            {z}՝ գին (դատարկ՝ հիմնական գինը)
            <input type="number" name={`zp_${z}`} min={1} step="any" />
          </label>
        ))}
        {searchParams.error && (
          <p className="err">
            Ստուգիր տվյալները. անվանումը, ամսաթիվը և գինը պարտադիր են։
          </p>
        )}
        <button className="btn">Ստեղծել</button>
      </form>
    </main>
  );
}
