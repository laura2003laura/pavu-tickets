import Link from "next/link";
import CopyInvitationLink from "./CopyInvitationLink";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { day, money, time } from "@/lib/format";
async function markReminderSent(formData: FormData) {
  "use server";

  await requireAdmin();

  const id = String(formData.get("invitationId") ?? "");

  if (!id) return;

  await db.giftInvitation.updateMany({
    where: {
      id,
      status: "PENDING",
      createdAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      reminderSentAt: null,
    },
    data: {
      reminderSentAt: new Date(),
    },
  });

  redirect("/admin/gift-invitations");
}
export const dynamic = "force-dynamic";

export default async function AdminGiftInvitationsPage() {
  await requireAdmin();

  const invitations = await db.giftInvitation.findMany({
    include: {
      order: {
        include: {
          user: true,
          event: true,
          tickets: {
            include: {
              ticketType: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const appUrl = (
    process.env.APP_URL || "https://pavu-tickets-production.up.railway.app"
  ).replace(/\/$/, "");

  return (
    <main>
      <h1>Նվեր հրավիրատոմսեր</h1>
      <p className="muted">
        Այստեղ կարող եք տեսնել գնված նվեր հրավիրատոմսերը, ստացողների տվյալները և
        նրանց պատասխանները։
      </p>

      <p>
        <strong>Ընդհանուր հրավերներ՝ {invitations.length}</strong>
      </p>

      {invitations.length === 0 ? (
        <p className="muted">Այս պահին նվեր հրավիրատոմսեր չկան։</p>
      ) : (
        <div className="grid">
          {invitations.map((invitation) => {
            const order = invitation.order;
            const invitationUrl = `${appUrl}/gift-invitations/${invitation.token}`;
            const ticketTypes = [
              ...new Set(order.tickets.map((ticket) => ticket.ticketType.name)),
            ];

            const reminderDue =
              invitation.status === "PENDING" &&
              Date.now() - invitation.createdAt.getTime() >=
                48 * 60 * 60 * 1000 &&
              !invitation.reminderSentAt;

            return (
              <section className="card" key={invitation.id}>
                <h2>{order.event.title}</h2>

                <p>
                  <strong>Գնորդ՝ </strong>
                  {order.user.name || order.user.email}
                </p>
                <p>
                  <strong>Անանուն ուղարկում՝ </strong>
                  {order.giftAnonymous ? "Այո" : "Ոչ"}
                </p>
                <p>
                  <strong>Ստացող՝ </strong>
                  {invitation.recipientName || "Անունը նշված չէ"}
                </p>
                <p>
                  <strong>Հեռախոս՝ </strong>
                  {invitation.recipientPhone}
                </p>
                <p>
                  <strong>Միջոցառման ամսաթիվ՝ </strong>
                  {day(order.event.startsAt)}, {time(order.event.startsAt)}
                </p>
                <p>
                  <strong>Վայր՝ </strong>
                  {order.event.venue}
                </p>
                <p>
                  <strong>Տոմսերի քանակ՝ </strong>
                  {order.tickets.length}
                </p>
                <p>
                  <strong>Տոմսերի տեսակներ՝ </strong>
                  {ticketTypes.join(", ") || "Նշված չէ"}
                </p>
                <p>
                  <strong>Պատվերի գումար՝ </strong>
                  {money(order.totalCents, order.currency)}
                </p>
                <p>
                  <strong>Ստեղծման ամսաթիվ՝ </strong>
                  {day(invitation.createdAt)}
                </p>
                <p>
                  <strong>Կարգավիճակ՝ </strong>
                  {invitation.status === "PENDING"
                    ? "Սպասում է պատասխանին"
                    : invitation.status === "ACCEPTED"
                      ? "Ընդունված է"
                      : "Մերժված է"}
                </p>

                {reminderDue && (
                  <>
                    <p style={{ color: "#b45309", fontWeight: 600 }}>
                      Հիշեցում է անհրաժեշտ․ անցել է 48 ժամ։
                    </p>

                    <form action={markReminderSent}>
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.id}
                      />
                      <button type="submit" className="btn">
                        Նշել հիշեցումն ուղարկված
                      </button>
                    </form>
                  </>
                )}

                {invitation.reminderSentAt && (
                  <p style={{ color: "#26734d" }}>
                    Հիշեցումն ուղարկվել է՝ {day(invitation.reminderSentAt)}
                  </p>
                )}

                {invitation.respondedAt && (
                  <p>
                    <strong>Պատասխանի ամսաթիվ՝ </strong>
                    {day(invitation.respondedAt)}
                  </p>
                )}

                <p>
                  <strong>Հրավիրատոմսի հղում՝</strong>
                </p>
                <p style={{ overflowWrap: "anywhere" }}>
                  <a
                    href={invitationUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: "underline" }}
                  >
                    {invitationUrl}
                  </a>
                </p>
                <CopyInvitationLink url={invitationUrl} />
              </section>
            );
          })}
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
