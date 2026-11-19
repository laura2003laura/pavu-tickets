import { randomBytes } from "node:crypto";
import { db } from "./db";
import { appUrl, stripe } from "./stripe";

// Creates a Stripe Checkout page for an order. Returns its URL (or null on failure).
export async function checkoutUrl(
  orderId: string,
  email: string,
  lines: { name: string; priceCents: number; currency: string; qty: number }[],
  cancelPath: string,
) {
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: orderId,
      metadata: { orderId },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${appUrl}/my-tickets?paid=1`,
      cancel_url: `${appUrl}${cancelPath}`,
      line_items: lines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: l.currency.toLowerCase(),
          unit_amount: l.priceCents,
          product_data: { name: l.name },
        },
      })),
    });
    await db.order.update({ where: { id: orderId }, data: { stripeSessionId: session.id } });
    return session.url;
  } catch (e) {
    console.error("Stripe error", e);
    return null;
  }
}

// Called by the Stripe webhook. Safe to call twice: only a PENDING order is processed.


export async function markPaidAndIssue(orderId: string) {
  await db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o || o.status !== "PENDING" || o.deliveryMethod === "COURIER") return;

    const createGiftInvitation = async () => {
      if (!o.isGift) return;
      const recipientPhone = o.giftRecipientPhone;
      if (!recipientPhone) throw new Error("Gift invitation recipient phone is missing");

      await tx.giftInvitation.create({
        data: {
          orderId: o.id,
          recipientName: o.giftRecipientName,
          recipientPhone,
          token: randomBytes(32).toString("hex"),
        },
      });
    };

    if (o.ticketTypeId) {
      const stock = await tx.$executeRaw`
        UPDATE "TicketType"
        SET "quantitySold" = "quantitySold" + ${o.quantity}
        WHERE id = ${o.ticketTypeId}
          AND "eventId" = ${o.eventId}
          AND "quantitySold" + ${o.quantity} <= "quantityTotal"
      `;
      if (stock !== 1) throw new Error("Not enough tickets available");

      const paid = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (paid.count !== 1) throw new Error("Order payment status could not be updated");

      await tx.ticket.createMany({
        data: Array.from({ length: o.quantity }, () => ({
          orderId: o.id,
          eventId: o.eventId,
          ticketTypeId: o.ticketTypeId!,
        })),
      });
      await createGiftInvitation();
      return;
    }

    const ids = o.seatIds;
    if (ids.length !== o.quantity || ids.length === 0) {
      throw new Error("Invalid seat selection");
    }

    const seats = await tx.eventSeat.findMany({
      where: {
        eventId: o.eventId,
        seatId: { in: ids },
        status: "AVAILABLE",
      },
      include: { seat: true },
    });
    if (seats.length !== ids.length) {
      throw new Error("One or more seats are no longer available");
    }

    const types = await tx.ticketType.findMany({ where: { eventId: o.eventId } });
    const typeOf = new Map(types.map((t) => [t.name, t.id]));
    const ticketData = seats.map((s) => {
      const ticketTypeId = typeOf.get(s.seat.zone);
      if (!ticketTypeId) throw new Error(`Ticket type not found for zone: ${s.seat.zone}`);
      return {
        orderId: o.id,
        eventId: o.eventId,
        seatId: s.seatId,
        ticketTypeId,
      };
    });

    const sold = await tx.eventSeat.updateMany({
      where: {
        eventId: o.eventId,
        seatId: { in: ids },
        status: "AVAILABLE",
      },
      data: { status: "SOLD", orderId: null },
    });
    if (sold.count !== ids.length) {
      throw new Error("One or more seats could not be sold");
    }

    const paid = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (paid.count !== 1) throw new Error("Order payment status could not be updated");

    await tx.ticket.createMany({ data: ticketData });
    await createGiftInvitation();
  });
}

export async function markCourierDeliveredAndIssue(orderId: string) {
  await db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o || o.status !== "PENDING" || o.deliveryMethod !== "COURIER") return;

    if (o.ticketTypeId) {
      const stock = await tx.$executeRaw`
        UPDATE "TicketType"
        SET "quantitySold" = "quantitySold" + ${o.quantity}
        WHERE id = ${o.ticketTypeId}
          AND "eventId" = ${o.eventId}
          AND "quantitySold" + ${o.quantity} <= "quantityTotal"
      `;
      if (stock !== 1) throw new Error("Not enough courier tickets available");

      const paid = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING", deliveryMethod: "COURIER" },
        data: {
          status: "PAID",
          paidAt: new Date(),
          deliveryStatus: "IN_TRANSIT",
        },
      });
      if (paid.count !== 1) throw new Error("Courier order could not be confirmed");

      await tx.ticket.createMany({
        data: Array.from({ length: o.quantity }, () => ({
          orderId: o.id,
          eventId: o.eventId,
          ticketTypeId: o.ticketTypeId!,
        })),
      });
      return;
    }

    const ids = o.seatIds;
    if (ids.length !== o.quantity || ids.length === 0) {
      throw new Error("Invalid courier seat selection");
    }

    const seats = await tx.eventSeat.findMany({
      where: {
        eventId: o.eventId,
        seatId: { in: ids },
        status: "AVAILABLE",
      },
      include: { seat: true },
    });
    if (seats.length !== ids.length) {
      throw new Error("One or more courier seats are no longer available");
    }

    const types = await tx.ticketType.findMany({ where: { eventId: o.eventId } });
    const typeOf = new Map(types.map((t) => [t.name, t.id]));
    const ticketData = seats.map((s) => {
      const ticketTypeId = typeOf.get(s.seat.zone);
      if (!ticketTypeId) throw new Error(`Ticket type not found for zone: ${s.seat.zone}`);
      return {
        orderId: o.id,
        eventId: o.eventId,
        seatId: s.seatId,
        ticketTypeId,
      };
    });

    const sold = await tx.eventSeat.updateMany({
      where: {
        eventId: o.eventId,
        seatId: { in: ids },
        status: "AVAILABLE",
      },
      data: { status: "SOLD", orderId: null },
    });
    if (sold.count !== ids.length) {
      throw new Error("Not all courier seats could be marked as sold");
    }

    const paid = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING", deliveryMethod: "COURIER" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        deliveryStatus: "IN_TRANSIT",
      },
    });
    if (paid.count !== 1) throw new Error("Courier order could not be confirmed");

    await tx.ticket.createMany({ data: ticketData });
  });
}

// Stripe line items rebuilt from an existing order (used by the checkout page).
export async function orderLines(orderId: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { event: true } });
  const types = await db.ticketType.findMany({ where: { eventId: o.eventId } });
  if (o.ticketTypeId) {
    const t = types.find((x) => x.id === o.ticketTypeId)!;
    return [{ name: `${o.event.title}, ${t.name}`, priceCents: t.priceCents, currency: t.currency, qty: o.quantity }];
  }
  const seats = await db.eventSeat.findMany({
  where: {
    eventId: o.eventId,
    seatId: { in: o.seatIds },
  },
  include: { seat: true },
});
  const byZone = new Map<string, number>();
  for (const s of seats) byZone.set(s.seat.zone, (byZone.get(s.seat.zone) ?? 0) + 1);
  return [...byZone].map(([zone, qty]) => {
    const t = types.find((x) => x.name === zone)!;
    return { name: `${o.event.title}, ${t.name}`, priceCents: t.priceCents, currency: t.currency, qty };
  });
}
