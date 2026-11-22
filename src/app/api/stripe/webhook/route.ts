import { NextResponse } from "next/server";
import { markPaidAndIssue } from "@/lib/orders";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (orderId && session.payment_status === "paid") {
      const currentOrder = await db.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      if (
        currentOrder?.status === "PAID" ||
        currentOrder?.status === "REFUNDED"
      ) {
        return NextResponse.json({ received: true });
      }

      try {
        await markPaidAndIssue(orderId);
      } catch (error) {
        console.error("Ticket issuing failed. Starting refund:", error);

        const paymentIntent = session.payment_intent;

        if (!paymentIntent) {
          console.error("Payment intent is missing");
          return NextResponse.json(
            { error: "Payment intent is missing" },
            { status: 500 },
          );
        }

        try {
          const paymentIntentId =
            typeof paymentIntent === "string"
              ? paymentIntent
              : paymentIntent.id;

          await stripe.refunds.create(
            {
              payment_intent: paymentIntentId,
              reason: "duplicate",
            },
            {
              idempotencyKey: `ticket-refund-${event.id}`,
            },
          );

          await db.order.updateMany({
            where: {
              id: orderId,
              status: "PENDING",
            },
            data: {
              status: "REFUNDED",
            },
          });
        } catch (refundError) {
          console.error("Stripe refund failed:", refundError);

          return NextResponse.json(
            { error: "Refund failed; webhook retry required" },
            { status: 500 },
          );
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
