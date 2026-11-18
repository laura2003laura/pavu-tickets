import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cancelPending, markPaidAndIssue } from "@/lib/orders";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const orders = await db.order.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
      OR: [
        { deliveryMethod: { not: "COURIER" } },
        { deliveryMethod: null },
      ],
    },
    select: {
      id: true,
      stripeSessionId: true,
    },
  });

  let cancelled = 0;
  let paid = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      if (order.stripeSessionId) {
        if (!stripe) {
          skipped++;
          continue;
        }

        const session = await stripe.checkout.sessions.retrieve(
          order.stripeSessionId
        );

        if (session.payment_status === "paid") {
          await markPaidAndIssue(order.id);
          paid++;
          continue;
        }

        if (session.status !== "expired") {
          skipped++;
          continue;
        }
      }

      await cancelPending(order.id);
      cancelled++;
    } catch (error) {
      failed++;
      console.error(`Order cleanup failed: ${order.id}`, error);
    }
  }

  return NextResponse.json({
    success: true,
    checked: orders.length,
    cancelled,
    paid,
    skipped,
    failed,
    executedAt: now.toISOString(),
  });
}
