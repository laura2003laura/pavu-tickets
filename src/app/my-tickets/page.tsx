import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { day, time } from "@/lib/format";
import { makeToken } from "@/lib/ticket";

export const dynamic = "force-dynamic";
const LABEL = {
  VALID: "Վավեր",
  USED: "Օգտագործված",
  CANCELLED: "Չեղարկված",
} as const;

export default async function MyTickets(props: {
  searchParams: Promise<{ paid?: string; delivery?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getUser();
  if (!user) redirect("/login?next=/my-tickets");

  const tickets = await db.ticket.findMany({
    where: { order: { userId: user.id } },
    include: { event: true, ticketType: true, seat: true, order: true },
    orderBy: { createdAt: "desc" },
  });
  const giftInvitations = await db.giftInvitation.findMany({
    where: {
      order: { userId: user.id },
    },
    include: {
      order: {
        include: {
          event: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const pendingCourierOrders = await db.order.findMany({
    where: {
      userId: user.id,
      status: "PENDING",
      deliveryMethod: "COURIER",
    },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });
  const pending = searchParams.paid
    ? await db.order.count({ where: { userId: user.id, status: "PENDING" } })
    : 0;
  // Courier orders show the QR code only after the admin marks them as delivered and paid.
  const waiting = (t: (typeof tickets)[number]) =>
    t.order.deliveryMethod === "COURIER" && !t.order.deliveredAt;
  const qrs = await Promise.all(
    tickets.map((t) =>
      waiting(t)
        ? ""
        : QRCode.toDataURL(makeToken(t.id), { margin: 1, width: 400 }),
    ),
  );

  return (
    <main>
      <h1>Իմ տոմսերը</h1>
      {pending > 0 && (
        <p className="lead">
          Վճարումը մշակվում է։ Թարմացրու էջը մի քանի վայրկյանից։
        </p>
      )}
      {searchParams.delivery && (
        <p className="lead">
          Առաքման պատվերը ընդունված է։ Մեր աշխատակիցը կզանգահարի նշված համարով։
        </p>
      )}
      {tickets.length === 0 && pendingCourierOrders.length === 0 && (
        <p className="muted">
          Դու դեռ տոմս չունես։ Ընտրիր միջոցառում գլխավոր էջից։
        </p>
      )}

      {pendingCourierOrders.map((o) => (
        <div className="tk" key={o.id}>
          <strong style={{ fontSize: 18 }}>{o.event.title}</strong>
          <span className="muted">
            {day(o.event.startsAt)}, {time(o.event.startsAt)} В· {o.event.venue}
          </span>
          <span>Քանակ՝ {o.quantity}</span>
          <span>Առաքման հասցե՝ {o.deliveryAddress}</span>
          <span>Հեռախոս՝ {o.deliveryPhone}</span>
          <span className="badge PENDING">
            Սպասում է առաքման և վճարման հաստատմանը
          </span>
          <span className="muted">
            QR կոդը կստեղծվի վճարումը հաստատելուց հետո։
          </span>
        </div>
      ))}
      {giftInvitations.length > 0 && (
        <section style={{ marginBottom: "28px" }}>
          <h2>Իմ նվեր հրավերները</h2>
          <div className="tickets">
            {giftInvitations.map((invitation) => (
              <div className="tk" key={invitation.id}>
                <strong style={{ fontSize: 18 }}>
                  {invitation.order.event.title}
                </strong>
                <span className="muted">
                  {day(invitation.order.event.startsAt)},{" "}
                  {time(invitation.order.event.startsAt)} ·{" "}
                  {invitation.order.event.venue}
                </span>
                <span>
                  Ստացող՝ {invitation.recipientName || "Անունը նշված չէ"}
                </span>
                <span className={`badge ${invitation.status}`}>
                  {invitation.status === "PENDING"
                    ? "Սպասում է պատասխանին"
                    : invitation.status === "ACCEPTED"
                      ? "Հրավերն ընդունվել է"
                      : "Հրավերը մերժվել է"}
                </span>
                {invitation.respondedAt && (
                  <span className="muted">
                    Պատասխանի ամսաթիվ՝ {day(invitation.respondedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="tickets">
        {tickets.map((t, i) => (
          <div className="tk" key={t.id}>
            <strong style={{ fontSize: 18 }}>{t.event.title}</strong>
            <span className="muted">
              {day(t.event.startsAt)}, {time(t.event.startsAt)} В·{" "}
              {t.event.venue}
            </span>
            {waiting(t) ? (
              <span className="muted">
                🚚 Առաքվում է՝ {t.order.deliveryAddress}
                <br />
                QR կոդը կերևա առաքումից հետո։
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs[i]} alt="Տոմսի QR կոդ" />
            )}
            <span>{t.ticketType.name}</span>
            {t.seat && (
              <strong>
                Շարք {t.seat.rowLabel}, տեղ {t.seat.number}
              </strong>
            )}
            <span className={`badge ${t.status}`}>{LABEL[t.status]}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
