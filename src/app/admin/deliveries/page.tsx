import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { day, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage() {
  await requireAdmin();

  const orders = await db.order.findMany({
    where: {
      status: "PAID",
      deliveryMethod: "COURIER",
      deliveryStatus: "IN_TRANSIT",
    },
    include: {
      user: true,
      event: true,
      tickets: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main>
      <h1>Առաքման ճանապարհին</h1>
      <p className="muted">
        Հաստատված առաքման պատվերներ, որոնց տոմսերն արդեն ստեղծված են։
      </p>

      <p>
        <strong>Ընդամենը՝ {orders.length} պատվեր</strong>
      </p>

      {orders.length === 0 ? (
        <p className="muted">Առաքման ընթացքի մեջ գտնվող պատվերներ չկան։</p>
      ) : (
        <div className="grid">
          {orders.map((order) => (
            <section className="card" key={order.id}>
              <h2>{order.event.title}</h2>

              <p>
                <strong>Հաճախորդ՝</strong>{" "}
                {order.user.name || order.user.email}
              </p>

              <p>
                <strong>Էլ․ փոստ՝</strong> {order.user.email}
              </p>

              <p>
                <strong>Հեռախոս՝</strong> {order.deliveryPhone || "—"}
              </p>

              <p>
                <strong>Հասցե՝</strong> {order.deliveryAddress || "—"}
              </p>

              <p>
                <strong>Տոմսերի քանակ՝</strong> {order.quantity}
              </p>

              <p>
                <strong>Գումար՝</strong>{" "}
                {money(order.totalCents, order.currency)}
              </p>

              <p>
                <strong>Միջոցառման ամսաթիվ՝</strong>{" "}
                {day(order.event.startsAt)}, {time(order.event.startsAt)}
              </p>

              <p>
                <strong>Պատվերի ամսաթիվ՝</strong>{" "}
                {day(order.createdAt)}, {time(order.createdAt)}
              </p>

              <p>
                <strong>Ստեղծված QR տոմսեր՝</strong> {order.tickets.length}
              </p>

              <p className="badge IN_TRANSIT">Առաքման ճանապարհին</p>
            </section>
          ))}
        </div>
      )}

      <p>
        <Link className="btn ghost" href="/admin">
          Վերադառնալ ադմին վահանակ
        </Link>
      </p>
    </main>
  );
}