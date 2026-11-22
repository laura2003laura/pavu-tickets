import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { day, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage() {
  await requireAdmin();

  async function markDelivered(formData: FormData) {
    "use server";

    await requireAdmin();

    const orderId = String(formData.get("orderId") ?? "");
    if (!orderId) return;

    await db.order.updateMany({
      where: {
        id: orderId,
        status: "PAID",
        deliveryMethod: "COURIER",
        deliveryStatus: "IN_TRANSIT",
        deliveredAt: null,
      },
      data: {
        deliveredAt: new Date(),
        deliveryStatus: "DELIVERED",
      },
    });

    revalidatePath("/admin/deliveries");
    revalidatePath("/admin");
    revalidatePath("/my-tickets");
  }

  const orders = await db.order.findMany({
    where: {
      status: "PAID",
      deliveryMethod: "COURIER",
      deliveryStatus: "IN_TRANSIT",
      deliveredAt: null,
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
      <h1>Առաքման պատվերներ</h1>
      <p className="muted">
        Այստեղ ցուցադրվում են առաքման ընթացքում գտնվող պատվերները։
      </p>

      <p>
        <strong>Սպասող առաքումներ՝ {orders.length}</strong>
      </p>

      {orders.length === 0 ? (
        <p className="muted">Այս պահին առաքման ենթակա պատվերներ չկան։</p>
      ) : (
        <div className="grid">
          {orders.map((order) => (
            <section className="card" key={order.id}>
              <h2>{order.event.title}</h2>

              <p>
                <strong>Հաճախորդ՝ </strong>
                {order.user.name || order.user.email}
              </p>

              <p>
                <strong>Էլ․ փոստ՝ </strong>
                {order.user.email}
              </p>

              <p>
                <strong>Հեռախոս՝ </strong>
                {order.deliveryPhone || "—"}
              </p>

              <p>
                <strong>Հասցե՝ </strong>
                {order.deliveryAddress || "—"}
              </p>

              {order.deliveryLat != null && order.deliveryLng != null && (
                <p>
                  <a
                    style={{ textDecoration: "underline" }}
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${order.deliveryLat}&mlon=${order.deliveryLng}#map=17/${order.deliveryLat}/${order.deliveryLng}`}
                  >
                    Բացել քարտեզը
                  </a>
                </p>
              )}

              <p>
                <strong>Տոմսերի քանակ՝ </strong>
                {order.quantity}
              </p>

              <p>
                <strong>Գումար՝ </strong>
                {money(order.totalCents, order.currency)}
              </p>

              <p>
                <strong>Միջոցառման ամսաթիվ՝ </strong>
                {day(order.event.startsAt)}, {time(order.event.startsAt)}
              </p>

              <p>
                <strong>Պատվերի ամսաթիվ՝ </strong>
                {day(order.createdAt)}, {time(order.createdAt)}
              </p>

              <p>
                <strong>Ստեղծված տոմսեր՝ </strong>
                {order.tickets.length}
              </p>

              <p className="badge IN_TRANSIT">Առաքման ընթացքում</p>

              <form action={markDelivered}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn">Նշել որպես առաքված</button>
              </form>
            </section>
          ))}
        </div>
      )}

      <p>
        <Link className="btn ghost" href="/admin">
          Վերադառնալ կառավարման վահանակ
        </Link>
      </p>
    </main>
  );
}
