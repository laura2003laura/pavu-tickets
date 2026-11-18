import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const eventId = "cmwgfdw5300ue10m015bj17k2";
  const hallId = "cmwgfdlc4000310m091fvlaje";

  const event = await db.event.findUnique({
    where: { id: eventId },
  });

  if (!event || event.hallId !== hallId) {
    throw new Error("Միջոցառումը կամ դահլիճը չի համընկնում։");
  }

  const seats = await db.seat.findMany({
    where: { hallId },
    select: { id: true },
  });
console.log("Դահլիճի տեղեր՝", seats.length);
console.log(
  "Միջոցառման արդեն կապված տեղեր՝",
  await db.eventSeat.count({ where: { eventId } })
);
  const result = await db.eventSeat.createMany({
    data: seats.map((seat) => ({
      eventId,
      seatId: seat.id,
    })),
    skipDuplicates: true,
  });

  console.log("Ավելացված տեղեր՝", result.count);
  const statuses = await db.eventSeat.groupBy({
  by: ["status"],
  where: { eventId },
  _count: { status: true },
});

console.log("Տեղերի կարգավիճակները՝", statuses);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());