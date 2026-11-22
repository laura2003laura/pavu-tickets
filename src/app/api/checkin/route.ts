import { NextResponse } from "next/server";
import type { ScanResult } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readToken } from "@/lib/ticket";

export async function POST(req: Request) {
  const staff = await getUser();
  if (!staff || (staff.role !== "STAFF" && staff.role !== "ADMIN")) {
    return NextResponse.json(
      { ok: false, result: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const { token, eventId } = await req
    .json()
    .catch(() => ({ token: "", eventId: "" }));
  if (typeof eventId !== "string" || !eventId) {
    return NextResponse.json(
      { ok: false, result: "NO_EVENT" },
      { status: 400 },
    );
  }
  const exists = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!exists)
    return NextResponse.json(
      { ok: false, result: "NO_EVENT" },
      { status: 404 },
    );
  const log = (result: ScanResult, ticketId?: string, evId?: string) =>
    db.scanLog.create({
      data: { result, ticketId, eventId: evId ?? eventId, staffId: staff.id },
    });

  const id = typeof token === "string" ? readToken(token) : null;
  if (!id) {
    await log("INVALID_SIGNATURE");
    return NextResponse.json({ ok: false, result: "INVALID_SIGNATURE" });
  }

  // One atomic statement: only a VALID ticket of THIS event can become USED,
  // so two scanners can never both let the same ticket in.
  const changed = await db.$executeRaw`
    UPDATE "Ticket" SET status = 'USED', "usedAt" = now(), "usedById" = ${staff.id}
    WHERE id = ${id} AND status = 'VALID' AND "eventId" = ${eventId}`;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: { event: true, ticketType: true, seat: true },
  });
  if (!ticket) {
    await log("NOT_FOUND");
    return NextResponse.json({ ok: false, result: "NOT_FOUND" });
  }
  const info = {
    event: ticket.event.title,
    type: ticket.ticketType.name,
    seat: ticket.seat
      ? `Շարք ${ticket.seat.rowLabel}, տեղ ${ticket.seat.number}`
      : undefined,
  };

  if (changed === 1) {
    await log("SUCCESS", id);
    return NextResponse.json({ ok: true, result: "SUCCESS", ...info });
  }

  let result: ScanResult = "ALREADY_USED";
  if (ticket.eventId !== eventId) result = "WRONG_EVENT";
  else if (ticket.status === "CANCELLED") result = "CANCELLED";
  await log(result, id);
  return NextResponse.json({
    ok: false,
    result,
    ...info,
    usedAt: ticket.usedAt?.toISOString(),
  });
}
