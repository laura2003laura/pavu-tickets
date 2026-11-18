import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { appUrl, stripe } from "./stripe";

// General admission: takes `qty` tickets out of stock. Succeeds only while enough remain.
export async function reserveStock(tx: Prisma.TransactionClient, typeId: string, eventId: string, qty: number) {
  const n = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "quantityReserved" = "quantityReserved" + ${qty}
    WHERE id = ${typeId}
      AND "eventId" = ${eventId}
      AND "quantitySold" + "quantityReserved" + ${qty} <= "quantityTotal"`;
  return n === 1;
}

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

    if (o.ticketTypeId) {
      const reserved = await tx.ticketType.updateMany({
        where: {
          id: o.ticketTypeId,
          eventId: o.eventId,
          quantityReserved: { gte: o.quantity },
        },
        data: {
          quantityReserved: { decrement: o.quantity },
          quantitySold: { increment: o.quantity },
        },
      });

      if (reserved.count !== 1) {
        throw new Error("Not enough reserved tickets to complete payment");
      }

      const paid = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });

      if (paid.count !== 1) {
        throw new Error("Order payment status could not be updated");
      }

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

    const types = await tx.ticketType.findMany({
      where: { eventId: o.eventId },
    });

    const typeOf = new Map(types.map((t) => [t.name, t.id]));

    const ticketData = seats.map((s) => {
      const ticketTypeId = typeOf.get(s.seat.zone);

      if (!ticketTypeId) {
        throw new Error(`Ticket type not found for zone: ${s.seat.zone}`);
      }

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
      data: { status: "SOLD", holdUntil: null },
    });

    if (sold.count !== ids.length) {
      throw new Error("One or more seats could not be sold");
    }

    const paid = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (paid.count !== 1) {
      throw new Error("Order payment status could not be updated");
    }

    await tx.ticket.createMany({ data: ticketData });
  });
}


export async function markCourierDeliveredAndIssue(orderId: string) {
  await db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });

    if (!o || o.status !== "PENDING" || o.deliveryMethod !== "COURIER") return;

    if (o.ticketTypeId) {
      const reserved = await tx.ticketType.updateMany({
        where: {
          id: o.ticketTypeId,
          eventId: o.eventId,
          quantityReserved: { gte: o.quantity },
        },
        data: {
          quantityReserved: { decrement: o.quantity },
          quantitySold: { increment: o.quantity },
        },
      });

      if (reserved.count !== 1) {
        throw new Error("Reserved courier tickets could not be completed");
      }

      const paid = await tx.order.updateMany({
        where: {
          id: orderId,
          status: "PENDING",
          deliveryMethod: "COURIER",
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
          deliveryStatus: "IN_TRANSIT",
        },
      });

      if (paid.count !== 1) {
        throw new Error("Courier order could not be confirmed");
      }

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

    const types = await tx.ticketType.findMany({
      where: { eventId: o.eventId },
    });

    const typeOf = new Map(types.map((t) => [t.name, t.id]));

    const ticketData = seats.map((s) => {
      const ticketTypeId = typeOf.get(s.seat.zone);

      if (!ticketTypeId) {
        throw new Error(`Ticket type not found for zone: ${s.seat.zone}`);
      }

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
      data: { status: "SOLD", holdUntil: null },
    });

    if (sold.count !== ids.length) {
      throw new Error("Not all courier seats could be marked as sold");
    }

    const paid = await tx.order.updateMany({
      where: {
        id: orderId,
        status: "PENDING",
        deliveryMethod: "COURIER",
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
        deliveryStatus: "IN_TRANSIT",
      },
    });

    if (paid.count !== 1) {
      throw new Error("Courier order could not be confirmed");
    }

    await tx.ticket.createMany({ data: ticketData });
  });
}
// Payment failed or expired: release reserved tickets or seats.
export async function cancelPending(orderId: string) {
  await db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });

    if (!o || o.status !== "PENDING") return;

    if (o.ticketTypeId) {
      const released = await tx.ticketType.updateMany({
        where: {
          id: o.ticketTypeId,
          quantityReserved: { gte: o.quantity },
        },
        data: {
          quantityReserved: { decrement: o.quantity },
        },
      });

      if (released.count !== 1) {
        throw new Error("Reserved ticket stock could not be released");
      }
    } else {
      await tx.eventSeat.updateMany({
        where: { orderId: o.id, status: "HELD" },
        data: {
          status: "AVAILABLE",
          orderId: null,
          holdUntil: null,
        },
      });
    }

    await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
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

// True while a PENDING order still owns everything it reserved.
export async function reservationIntact(orderId: string) {
  const o = await db.order.findUnique({ where: { id: orderId } });
  if (!o || o.status !== "PENDING") return false;
  if (o.ticketTypeId) return true; // general admission: stock was already taken from the counter
  const ids = o.seatIds;

if (ids.length !== o.quantity || ids.length === 0) {
  return false;
}

const n = await db.eventSeat.count({
  where: {
    eventId: o.eventId,
    seatId: { in: ids },
    status: "AVAILABLE",
  },
});
  return n === o.quantity;
}

// Gives the buyer more time (used right before sending them to Stripe, so the seats
// can't be released while the Stripe page is still open). Returns false if the seats were lost.

// Cleans up PENDING orders whose time ran out (e.g. the Stripe webhook never arrived).
// If Stripe says the order WAS paid, it is completed instead of cancelled.

