import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { day, gradient, money, time } from "@/lib/format";
import { stripe } from "@/lib/stripe";
import SeatPicker from "./SeatPicker";
import VolunteerApply from "./VolunteerApply";
import FieldView3D from "./FieldView3D";


export const dynamic = "force-dynamic";


export default async function EventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; volunteer?: string };
}) {
  const id = params.id;
  
  const event = await db.event.findUnique({
    where: { id },
    include: { ticketTypes: { orderBy: { priceCents: "asc" } }, hall: true },
  });
  if (!event || !event.isPublished) notFound();
  const past = event.startsAt <= new Date();

  // ---------- general admission ----------
  async function buy(formData: FormData) {
    "use server";
    const user = await getUser();
    if (!user) redirect(`/login?next=/events/${id}`);

    if (event!.startsAt <= new Date()) redirect(`/events/${id}?error=past`);
    const typeId = String(formData.get("typeId"));
    const qty = Math.min(10, Math.max(1, Number(formData.get("qty")) || 1));
    const tt = await db.ticketType.findFirst({ where: { id: typeId, eventId: id }, include: { event: true } });
    if (!tt) redirect(`/events/${id}?error=soldout`);

    const order = await db.order.create({
      data: {
        userId: user.id,
        eventId: id,
        ticketTypeId: typeId,
        quantity: qty,
        status: "PENDING",
        totalCents: tt.priceCents * qty,
        currency: tt.currency,
      },
    });

    redirect(`/checkout/${order.id}`);
  }

  // ---------- seated ----------
  
async function buySeats(formData: FormData) {
  "use server";

  const user = await getUser();
  if (!user) redirect(`/login?next=/events/${id}`);
  if (event!.startsAt <= new Date()) redirect(`/events/${id}?error=past`);

  const ids = [...new Set(formData.getAll("seatId").map(String))];

  if (ids.length < 1 || ids.length > 8) {
    redirect(`/events/${id}?error=count`);
  }

  const [chosen, types] = await Promise.all([
    db.eventSeat.findMany({
      where: {
        eventId: id,
        seatId: { in: ids },
      },
      include: { seat: true },
    }),
    db.ticketType.findMany({
      where: { eventId: id },
    }),
  ]);

  if (
    chosen.length !== ids.length ||
    chosen.some((seat) => seat.status !== "AVAILABLE")
  ) {
    redirect(`/events/${id}?error=taken`);
  }

  const typeOf = new Map(types.map((t) => [t.name, t]));
  let total = 0;

  for (const cs of chosen) {
    const t = typeOf.get(cs.seat.zone);
    if (!t) redirect(`/events/${id}?error=taken`);
    total += t.priceCents;
  }

  let order;

  try {
    order = await db.order.create({
      data: {
        userId: user.id,
        eventId: id,
        quantity: ids.length,
        seatIds: ids,
        status: "PENDING",
        totalCents: total,
        currency: types[0].currency,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SEATS_TAKEN") {
      redirect(`/events/${id}?error=taken`);
    }
    throw error;
  }

  redirect(`/checkout/${order.id}`);
}

  async function applyVolunteer(formData: FormData) {
    "use server";
    console.log("VOLUNTEER FORM SUBMITTED");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const telegram = String(formData.get("telegram") ?? "").trim().replace(/^@/, "");
    const birthRaw = String(formData.get("birthDate") ?? "");
    const birthDate = new Date(`${birthRaw}T12:00:00`);
    const age = (Date.now() - birthDate.getTime()) / 31557600000;
    if (!firstName || !lastName || !/^\+?[0-9 ()-]{8,16}$/.test(phone) || !/^[a-zA-Z0-9_]{4,64}$/.test(telegram) || !birthRaw || !Number.isFinite(age) || age < 16 ) {
      return { error: "Ստուգիր լրացված տվյալները․ հայտ կարող են ուղարկել 16 տարին լրացած անձինք։" };
    }
    await db.volunteerApplication.create({ data: { eventId: id, firstName, lastName, phone, telegram: `@${telegram}`, birthDate } });
    return { success: true };
  }
let seatData: {
  id: string;
  row: string;
  number: number;
  col: number;
  zone: string;
  taken: boolean;
}[] = [];

if (event.hallId) {
  const list = await db.eventSeat.findMany({
    where: { eventId: id },
    include: { seat: true },
  });

  seatData = list.map((es) => ({
    id: es.seatId,
    row: es.seat.rowLabel,
    number: es.seat.number,
    col: es.seat.col,
    zone: es.seat.zone,
    taken: es.status === "SOLD",
  }));
}

  return (
    <main>
      <div className="event-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(15,9,28,.88), rgba(15,9,28,.18)), url("${event.imageUrl || (event.category === "Երաժշտություն" ? "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1800&q=85" : event.category === "Թատրոն" ? "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1800&q=85" : event.category === "Սպորտ" ? "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1800&q=85" : "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=85")}")` }}>
        <span className="cat">{event.category}</span><div><span className="eyebrow">PAVU PRESENTS</span><h1>{event.title}</h1><p>{day(event.startsAt)} · {time(event.startsAt)} · {event.city}</p></div>
      </div>
      <p className="lead event-location">{event.hall?.name ?? event.venue} · {event.city}</p>
      <p className="event-description" style={{ maxWidth: "70ch" }}>{event.description}</p>
    
     
      {searchParams.error === "taken" && <p className="err">Ընտրված տեղերից մեկը արդեն զբաղված է։ Ընտրիր այլ տեղեր։</p>}
      {searchParams.error === "count" && <p className="err">Կարելի է ընտրել 1-ից 8 տեղ։</p>}
      {searchParams.error === "payment" && <p className="err">Վճարումը չհաջողվեց սկսել։ Փորձիր նորից։</p>}
      {searchParams.error === "past" && <p className="err">Այս միջոցառումն արդեն անցել է։</p>}

      {event.category === "Սպորտ" && !event.hallId && <FieldView3D />}
      {past ? (
        <p className="panel">Այս միջոցառումն արդեն անցել է, տոմսերի վաճառքը փակ է։</p>
      ) : event.hallId ? (
        <>
          <h3>Ընտրիր տեղերը</h3>
          <p>Տեղերի քանակ՝ {seatData.length}</p>
<p>Ազատ տեղեր՝ {seatData.filter((s) => !s.taken).length}</p>
          <SeatPicker
          
            seats={seatData}
            zones={event.ticketTypes.map((t) => ({ name: t.name, priceCents: t.priceCents, currency: t.currency }))}
            action={buySeats}
          />
          {!stripe && <p className="muted" style={{ fontSize: 13 }}>Ցուցադրական ռեժիմ՝ վճարումը սիմուլյացիա է։</p>}
        </>
      ) : (
        <form action={buy} className="panel stack">
          <h3 style={{ margin: 0 }}>Գնել տոմս</h3>
          <label>Տոմսի տեսակ
            <select name="typeId" required>
              {event.ticketTypes.map((t) => {
                const left = t.quantityTotal - t.quantitySold;
                return (
                  <option key={t.id} value={t.id} disabled={left <= 0}>
                    {t.name}, {money(t.priceCents, t.currency)} {left <= 0 ? "(սպառված է)" : `(մնացել է ${left})`}
                  </option>
                );
              })}
            </select>
          </label>
          <label>Քանակ<input type="number" name="qty" min={1} max={10} defaultValue={1} /></label>
          {searchParams.error === "soldout" && <p className="err">Բավարար տոմսեր չկան։ Փորձիր ավելի քիչ քանակ։</p>}
          <button className="btn">{stripe ? "Անցնել վճարման" : "Գնել"}</button>
          {!stripe && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Ցուցադրական ռեժիմ՝ վճարումը սիմուլյացիա է։</p>}
        </form>
      )}
      <VolunteerApply action={applyVolunteer} />
    </main>
  );
}
