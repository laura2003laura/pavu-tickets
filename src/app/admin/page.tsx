import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { day, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Admin() {
  await requireAdmin();
  const [revenue, toDeliver, sold, used, events, usedBy, soldBy] = await Promise.all([
    // courier orders count as revenue only after they were delivered and paid
    db.order.aggregate({
      where: { status: "PAID", OR: [{ deliveryMethod: null }, { deliveryMethod: "ONLINE" }, { deliveredAt: { not: null } }] },
      _sum: { totalCents: true },
    }),
    db.order.count({ where: { status: "PAID", deliveryMethod: "COURIER", deliveredAt: null } }),
    db.ticket.count({ where: { status: { not: "CANCELLED" } } }),
    db.ticket.count({ where: { status: "USED" } }),
    db.event.findMany({ include: { ticketTypes: true, hall: true }, orderBy: { startsAt: "desc" } }),
    db.ticket.groupBy({ by: ["eventId"], where: { status: "USED" }, _count: { _all: true } }),
    db.ticket.groupBy({ by: ["eventId"], where: { status: { not: "CANCELLED" } }, _count: { _all: true } }),
  ]);
  const usedMap = new Map(usedBy.map((u) => [u.eventId, u._count._all]));
  const soldMap = new Map(soldBy.map((u) => [u.eventId, u._count._all]));

  return (
    <main>
      <h1>Ադմինիստրատորի վահանակ</h1>
      <div className="stats">
        <div className="stat"><span className="muted">Եկամուտ</span><strong>{money(revenue._sum.totalCents ?? 0, "AMD")}</strong></div>
        <div className="stat"><span className="muted">Առաքման սպասող</span><strong>{toDeliver}</strong></div>
        <div className="stat"><span className="muted">Վաճառված տոմսեր</span><strong>{sold}</strong></div>
        <div className="stat"><span className="muted">Մուտք գործածներ</span><strong>{used}</strong></div>
        <div className="stat"><span className="muted">Միջոցառումներ</span><strong>{events.length}</strong></div>
      </div>

    <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
  <Link className="btn" href="/admin/new">Ավելացնել միջոցառում</Link>
  <Link className="btn ghost" href="/admin/halls">Դահլիճներ</Link>
  <Link className="btn ghost" href="/admin/volunteers">
    Կամավորների հայտեր
  </Link>
  <Link className="btn ghost" href="/admin/gift-invitations">
    Նվեր հրավիրատոմսեր
  </Link>
</p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Միջոցառում</th><th>Դահլիճ</th><th>Ամսաթիվ</th><th>Վաճառված</th><th>Մուտք</th><th>Կարգավիճակ</th></tr></thead>
          <tbody>
            {events.map((e) => {
              const total = e.ticketTypes.reduce((a, t) => a + t.quantityTotal, 0);
              return (
                <tr key={e.id}>
                  <td><Link href={`/admin/events/${e.id}`} style={{ textDecoration: "underline" }}>{e.title}</Link></td>
                  <td>{e.hall?.name ?? "Առանց տեղերի"}</td>
                  <td>{day(e.startsAt)}</td>
                  <td>{soldMap.get(e.id) ?? 0} / {total}</td>
                  <td>{usedMap.get(e.id) ?? 0}</td>
                  <td>{e.isPublished ? "Հրապարակված" : "Սևագիր"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
