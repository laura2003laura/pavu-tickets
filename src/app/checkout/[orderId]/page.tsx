import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { validCard } from "@/lib/card";
import { db } from "@/lib/db";
import { day, money, time } from "@/lib/format";
import { cancelPending, checkoutUrl,  markPaidAndIssue, orderLines, reservationIntact } from "@/lib/orders";
import { stripe } from "@/lib/stripe";
import { inYerevan } from "@/lib/yerevan";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";


export default async function Checkout({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { error?: string };
}) {
  const id = params.orderId;
  const user = await getUser();
  if (!user) redirect(`/login?next=/checkout/${id}`);


  const order = await db.order.findFirst({ where: { id, userId: user.id }, include: { event: true } });
  if (!order) notFound();
  if (order.status === "PAID") redirect("/my-tickets");

  if (order.status !== "PENDING") {
    return (
      <main>
        <h1>Պատվերի ժամանակը սպառվել է</h1>
        <p className="lead">Ընտրված տեղերը/տոմսերը ազատվել են։ Կարող ես նորից ընտրել։</p>
        <Link className="btn" href={`/events/${order.eventId}`}>Վերադառնալ միջոցառմանը</Link>
      </main>
    );
  }

  // Loads the order again inside an action and makes sure it is still ours and still reserved.
  // Plain helper (not a public action), only called from the actions below.
  async function loadPending() {
    const u = await getUser();
    if (!u) redirect(`/login?next=/checkout/${id}`);
    const o = await db.order.findFirst({ where: { id, userId: u.id, status: "PENDING" } });
    if (!o) redirect(`/checkout/${id}`);
    if (!(await reservationIntact(id))) {
      await cancelPending(id);
      redirect(`/checkout/${id}`);
    }
    return { u, o };
  }

  // ---------- Option 1: pay online ----------
  async function payOnline(formData: FormData) {
    "use server";
    const u = await getUser();
if (!u) redirect(`/login?next=/checkout/${id}`);

const o = await db.order.findFirst({
  where: { id, userId: u.id, status: "PENDING" },
});

if (!o) redirect(`/checkout/${id}`);

if (o.expiresAt && o.expiresAt <= new Date()) {
  await cancelPending(id);
  redirect(`/checkout/${id}?error=expired`);
}

if (!(await reservationIntact(id))) {
  await cancelPending(id);
  redirect(`/checkout/${id}`);
}

    if (stripe) {
      // The card is entered on Stripe's own page, so card data never touches this server.
      let existing: string | null = null;
      if (o.stripeSessionId) {
        try {
          const s = await stripe.checkout.sessions.retrieve(o.stripeSessionId);
          if (s.status === "open" && s.url) existing = s.url;
        } catch {}
      }
      if (existing) redirect(existing);

      
      await db.order.update({ where: { id }, data: { deliveryMethod: "ONLINE" } });
      const url = await checkoutUrl(id, u.email, await orderLines(id), `/checkout/${id}`);
      if (!url) redirect(`/checkout/${id}?error=payment`);
      redirect(url);
    }

    // Demo mode: the card is only checked, never stored or logged.
    const f = (k: string) => String(formData.get(k) ?? "");
    if (!validCard({ number: f("cardNumber"), expiry: f("cardExpiry"), cvc: f("cardCvc"), holder: f("cardHolder") })) {
      redirect(`/checkout/${id}?error=card`);
    }
    await db.order.update({ where: { id }, data: { deliveryMethod: "ONLINE" } });
    await markPaidAndIssue(id);
    redirect("/my-tickets?paid=1");
  }

  // ---------- Option 2: delivery to a point in Yerevan (pay the courier) ----------
  
  async function orderDelivery(formData: FormData) {
    "use server";
   const u = await getUser();
if (!u) redirect(`/login?next=/checkout/${id}`);

const o = await db.order.findFirst({
  where: { id, userId: u.id, status: "PENDING" },
});

if (!o) redirect(`/checkout/${id}`);

if (o.expiresAt && o.expiresAt <= new Date()) {
  await cancelPending(id);
  redirect(`/checkout/${id}?error=expired`);
}

if (!(await reservationIntact(id))) {
  await cancelPending(id);
  redirect(`/checkout/${id}`);
}
    const f = (k: string) => String(formData.get(k) ?? "").trim();
    const phone = f("phone");
    const address = f("address").slice(0, 200);
    const lat = Number(f("lat"));
    const lng = Number(f("lng"));

    if (!/^\+?[0-9 ()-]{8,16}$/.test(phone) || !address || !inYerevan(lat, lng)) {
      redirect(`/checkout/${id}?error=delivery`);
    }


    await db.order.update({
      where: { id },
      data: {
        deliveryMethod: "COURIER",
        deliveryPhone: phone,
        deliveryAddress: address,
        deliveryLat: lat,
        deliveryLng: lng,
      },
    });

    redirect("/my-tickets?delivery=1");
  }

  const lines = await orderLines(id);

  return (
    <main>
      <h1>Պատվերի ավարտ</h1>
      <p className="lead">
        {order.event.title} · {day(order.event.startsAt)}, {time(order.event.startsAt)}
      </p>
      <CheckoutClient
        lines={lines.map((l) => ({ name: l.name, qty: l.qty, price: money(l.priceCents * l.qty, l.currency) }))}
        total={money(order.totalCents, order.currency)}
        
        stripeEnabled={!!stripe}
        error={searchParams.error ?? null}
        payOnline={payOnline}
        orderDelivery={orderDelivery}
      />
    </main>
  );
}
