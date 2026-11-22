import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { SCAN_LABEL, day, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminEvent(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await requireAdmin();
  const id = params.id;
  const event = await db.event.findUnique({
    where: { id },
    include: { ticketTypes: true },
  });
  if (!event) notFound();
  const soldRows = await db.ticket.groupBy({
    by: ["ticketTypeId"],
    where: { eventId: id, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });
  const soldBy = new Map(soldRows.map((r) => [r.ticketTypeId, r._count._all]));

  const deliveries = await db.order.findMany({
    where: { eventId: id, deliveryMethod: "COURIER", status: "PAID" },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  const [scans, used] = await Promise.all([
    db.scanLog.findMany({
      where: { eventId: id },
      orderBy: { scannedAt: "desc" },
      take: 20,
      include: { staff: true },
    }),
    db.ticket.count({ where: { eventId: id, status: "USED" } }),
  ]);

  async function togglePublish() {
    "use server";
    await requireAdmin();
    const e = await db.event.findUniqueOrThrow({ where: { id } });
    await db.event.update({
      where: { id },
      data: { isPublished: !e.isPublished },
    });
    revalidatePath(`/admin/events/${id}`);
  }

  async function markDelivered(formData: FormData) {
    "use server";
    await requireAdmin();
    const orderId = String(formData.get("orderId") ?? "");
    await db.order.updateMany({
      where: {
        id: orderId,
        eventId: id,
        deliveryMethod: "COURIER",
        deliveredAt: null,
      },
      data: { deliveredAt: new Date(), paidAt: new Date() },
    });
    revalidatePath(`/admin/events/${id}`);
  }

  async function addType(formData: FormData) {
    "use server";
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const price = Number(formData.get("price"));
    const qty = Math.floor(Number(formData.get("qty")));
    const first = await db.ticketType.findFirst({ where: { eventId: id } });
    if (!name || !(price > 0) || !(qty > 0)) return;
    await db.ticketType.create({
      data: {
        eventId: id,
        name,
        priceCents: Math.round(price * 100),
        currency: first?.currency ?? "AMD",
        quantityTotal: qty,
      },
    });
    revalidatePath(`/admin/events/${id}`);
  }

  return (
    <main>
      <h1>{event.title}</h1>
      <p className="lead">
        {day(event.startsAt)}, {time(event.startsAt)} · {event.city},{" "}
        {event.venue}
      </p>
      <form action={togglePublish} style={{ marginBottom: 24 }}>
        <span style={{ marginRight: 12 }}>
          {event.isPublished ? "Հրապարակված է" : "Սևագիր է"}
        </span>
        <button className="btn ghost">
          {event.isPublished ? "Թաքցնել" : "Հրապարակել"}
        </button>
      </form>

      <h3>Տոմսերի տեսակներ (մուտք գործել է՝ {used})</h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Տեսակ</th>
              <th>Գին</th>
              <th>Վաճառված</th>
            </tr>
          </thead>
          <tbody>
            {event.ticketTypes.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{money(t.priceCents, t.currency)}</td>
                <td>
                  {soldBy.get(t.id) ?? 0} / {t.quantityTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={addType}
        className="panel stack"
        style={{ margin: "24px 0" }}
      >
        <strong>Ավելացնել տոմսի տեսակ</strong>
        <label>
          Անվանում
          <input name="name" required />
        </label>
        <label>
          Գին
          <input type="number" name="price" min={1} step="any" required />
        </label>
        <label>
          Քանակ
          <input type="number" name="qty" min={1} required />
        </label>
        <button className="btn">Ավելացնել</button>
      </form>

      <h3>Առաքումներ</h3>
      {deliveries.length === 0 ? (
        <p className="muted">Առաքման պատվերներ չկան։</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Գնորդ</th>
                <th>Հեռախոս</th>
                <th>Հասցե</th>
                <th>Քարտեզ</th>
                <th>Տոմսեր</th>
                <th>Գանձել</th>
                <th>Կարգավիճակ</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.user.name ?? d.user.email}</td>
                  <td>{d.deliveryPhone}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 200 }}>
                    {d.deliveryAddress}
                  </td>
                  <td>
                    {d.deliveryLat != null && d.deliveryLng != null && (
                      <a
                        style={{ textDecoration: "underline" }}
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.openstreetmap.org/?mlat=${d.deliveryLat}&mlon=${d.deliveryLng}#map=17/${d.deliveryLat}/${d.deliveryLng}`}
                      >
                        Բացել
                      </a>
                    )}
                  </td>
                  <td>{d.quantity}</td>
                  <td>{money(d.totalCents, d.currency)}</td>
                  <td>
                    {d.deliveredAt ? (
                      "Առաքված և վճարված"
                    ) : (
                      <form action={markDelivered}>
                        <input type="hidden" name="orderId" value={d.id} />
                        <button
                          className="btn ghost"
                          style={{ padding: "6px 14px" }}
                        >
                          Առաքված է
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Վերջին սկանավորումները</h3>
      {scans.length === 0 ? (
        <p className="muted">Դեռ սկանավորում չի եղել։</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Ժամանակ</th>
                <th>Արդյունք</th>
                <th>Աշխատակից</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.scannedAt.toLocaleString("hy-AM", {
                      timeZone: "Asia/Yerevan",
                    })}
                  </td>
                  <td>{SCAN_LABEL[s.result] ?? s.result}</td>
                  <td>{s.staff.name ?? s.staff.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
