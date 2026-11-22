import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seatRows, type HallSpec } from "../src/lib/halls";

const db = new PrismaClient();

// Price of a zone = event base price x multiplier
const MULT: Record<string, number> = {
  VIP: 2,
  Պարտեր: 1,
  Պատշգամբ: 0.6,
  Standard: 1,
  Premium: 1.5,
};

const HALLS: (HallSpec & { name: string; city: string })[] = [
  {
    name: "Մեծ դահլիճ",
    city: "Երևան",
    rows: 13,
    perRow: 16,
    aisleAfter: 8,
    zoneOf: (r) => (r <= 3 ? "VIP" : r <= 10 ? "Պարտեր" : "Պատշգամբ"),
  },
  {
    name: "Կամերային դահլիճ",
    city: "Երևան",
    rows: 8,
    perRow: 10,
    aisleAfter: 5,
    zoneOf: (r) => (r <= 2 ? "VIP" : "Standard"),
  },
  {
    name: "Կինոդահլիճ",
    city: "Երևան",
    rows: 10,
    perRow: 12,
    aisleAfter: 6,
    zoneOf: (r) => (r <= 4 ? "Standard" : "Premium"),
  },
  {
    name: "Կոնֆերանս դահլիճ",
    city: "Երևան",
    rows: 6,
    perRow: 14,
    aisleAfter: 7,
    zoneOf: () => "Standard",
  },
  {
    name: "Գյումրու մշակույթի տուն",
    city: "Գյումրի",
    rows: 9,
    perRow: 14,
    aisleAfter: 7,
    zoneOf: (r) => (r <= 2 ? "VIP" : "Standard"),
  },
];

const SEATED = [
  [
    "Երևանի ջազ ֆեստիվալ",
    "Երաժշտություն",
    "Մեծ դահլիճ",
    "2026-12-12T20:00:00+04:00",
    8000,
  ],
  ["Ստենդափ երեկո", "Ստենդափ", "Կինոդահլիճ", "2026-12-15T19:30:00+04:00", 4500],
  [
    "Ռոք համերգ",
    "Երաժշտություն",
    "Գյումրու մշակույթի տուն",
    "2026-12-19T19:00:00+04:00",
    6000,
  ],
  ["Անուշ, օպերա", "Թատրոն", "Մեծ դահլիճ", "2026-12-22T19:00:00+04:00", 10000],
  [
    "Դաշնամուրի երեկո",
    "Երաժշտություն",
    "Կամերային դահլիճ",
    "2027-01-05T19:00:00+04:00",
    5000,
  ],
  [
    "Տեխ կոնֆերանս",
    "Կոնֆերանս",
    "Կոնֆերանս դահլիճ",
    "2027-01-10T10:00:00+04:00",
    12000,
  ],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("Pavu12345", 10);
  for (const [email, name, role] of [
    ["admin@pavu.am", "Admin", "ADMIN"],
    ["staff@pavu.am", "Staff", "STAFF"],
    ["user@pavu.am", "Test User", "USER"],
  ] as const) {
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash },
    });
  }

  if ((await db.hall.count()) > 0) return;

  const halls = new Map<string, string>();
  for (const spec of HALLS) {
    const hall = await db.hall.create({
      data: { name: spec.name, city: spec.city },
    });
    await db.seat.createMany({ data: seatRows(hall.id, spec) });
    halls.set(spec.name, hall.id);
  }

  for (const [title, category, hallName, startsAt, base] of SEATED) {
    const hallId = halls.get(hallName)!;
    const hall = HALLS.find((h) => h.name === hallName)!;
    const seats = await db.seat.findMany({ where: { hallId } });
    const zones = new Map<string, number>();
    for (const s of seats) zones.set(s.zone, (zones.get(s.zone) ?? 0) + 1);

    const ev = await db.event.create({
      data: {
        title,
        category,
        city: hall.city,
        venue: hallName,
        hallId,
        description: `${title}՝ ${hall.city}, ${hallName}։ Ընտրիր քո տեղը դահլիճի սխեմայից։`,
        startsAt: new Date(startsAt),
        isPublished: true,
        ticketTypes: {
          create: [...zones].map(([name, count]) => ({
            name,
            currency: "AMD",
            quantityTotal: count,
            priceCents: Math.round(base * (MULT[name] ?? 1)) * 100,
          })),
        },
      },
    });
    await db.eventSeat.createMany({
      data: seats.map((s) => ({ eventId: ev.id, seatId: s.id })),
    });
  }

  // One general-admission event (no seats)
  await db.event.create({
    data: {
      title: "Ֆուտբոլային խաղ",
      category: "Սպորտ",
      city: "Երևան",
      venue: "Հանրապետական մարզադաշտ",
      description: "Ֆուտբոլային խաղ՝ առանց համարակալված տեղերի։",
      startsAt: new Date("2026-12-27T18:00:00+04:00"),
      isPublished: true,
      ticketTypes: {
        create: [
          {
            name: "Standard",
            priceCents: 300000,
            currency: "AMD",
            quantityTotal: 500,
          },
          {
            name: "VIP",
            priceCents: 600000,
            currency: "AMD",
            quantityTotal: 50,
          },
        ],
      },
    },
  });
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
