
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaffOrAdmin } from "@/lib/admin";
import { markCourierDeliveredAndIssue } from "@/lib/orders";
import { day, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";

async function confirmDelivery(formData: FormData) {
  "use server";

  await requireStaffOrAdmin();

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;

  await markCourierDeliveredAndIssue(orderId);

  revalidatePath("/staff/deliveries");
  revalidatePath("/my-tickets");
  revalidatePath("/admin");
}

export default async function DeliveriesPage() {
  await requireStaffOrAdmin();

  const orders = await db.order.findMany({
    where: {
      status: "PENDING",
      deliveryMethod: "COURIER",
    },
    include: {
      user: true,
      event: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main>
      <h1>Առաքման պատվերներ</h1>
      <p className="muted">
        Այստեղ ցուցադրվում են առաքման սպասող և դեռ չվճարված պատվերները։
      </p>

      {orders.length === 0 ? (
        <p className="muted">Այս պահին սպասող առաքման պատվերներ չկան։</p>
      ) : (
        <div className="grid">
          {orders.map((order) => (
            <section className="card" key={order.id}>
              <h2>{order.event.title}</h2>

              <p>
                <strong>Պատվիրատու՝</strong>{" "}
                {order.user.name || order.user.email}
              </p>
              <p>
                <strong>Էլ․ հասցե՝</strong> {order.user.email}
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

              <p className="badge PENDING">
                Սպասում է առաքման և վճարման հաստատմանը
              </p>

              <form action={confirmDelivery}>
                <input
                  type="hidden"
                  name="orderId"
                  value={order.id}
                />
                <button type="submit">
                  Հաստատել առաքումն ու վճարումը
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
