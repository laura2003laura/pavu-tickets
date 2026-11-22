import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { day, time } from "@/lib/format";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

async function respondToInvitation(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const response = String(formData.get("response") ?? "");

  if (!token || !["ACCEPTED", "DECLINED"].includes(response)) {
    return;
  }

  const status = response === "ACCEPTED" ? "ACCEPTED" : "DECLINED";

  const invitation = await db.giftInvitation.findUnique({
    where: { token },
    include: { order: true },
  });

  if (!invitation || invitation.order.status !== "PAID") {
    notFound();
  }

  if (invitation.status !== "PENDING") {
    redirect(`/gift-invitations/${token}`);
  }

  await db.giftInvitation.updateMany({
    where: { token, status: "PENDING" },
    data: {
      status,
      respondedAt: new Date(),
    },
  });

  redirect(`/gift-invitations/${token}`);
}

export default async function GiftInvitationPage(props: PageProps) {
  const params = await props.params;
  const invitation = await db.giftInvitation.findUnique({
    where: { token: params.token },
    include: {
      order: {
        include: {
          event: true,
          user: true,
        },
      },
    },
  });

  if (!invitation || invitation.order.status !== "PAID") {
    notFound();
  }

  const event = invitation.order.event;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(135deg, #17152b 0%, #302747 50%, #6b5263 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "48px 32px",
          borderRadius: "24px",
          background: "#fffaf4",
          color: "#302747",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <p
          style={{
            letterSpacing: "5px",
            fontSize: "12px",
            textTransform: "uppercase",
            color: "#a47c64",
          }}
        >
          PAVU TICKETS
        </p>

        <div style={{ fontSize: "42px", margin: "24px 0 12px" }}>✦</div>

        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "32px",
            fontWeight: 400,
            marginBottom: "16px",
          }}
        >
          Դուք հրավիրված եք
        </h1>

        <p style={{ color: "#806d68", marginBottom: "28px" }}>
          Սիրով հրավիրում ենք Ձեզ մասնակցելու
        </p>

        <h2
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "26px",
            marginBottom: "28px",
          }}
        >
          {event.title}
        </h2>

        <div
          style={{
            borderTop: "1px solid #e5d8cc",
            borderBottom: "1px solid #e5d8cc",
            padding: "24px 0",
            marginBottom: "28px",
            lineHeight: 2,
          }}
        >
          <p>
            <strong>Ամսաթիվ՝</strong> {day(event.startsAt)}
          </p>
          <p>
            <strong>Ժամ՝</strong> {time(event.startsAt)}
          </p>
          <p>
            <strong>Վայր՝</strong> {event.venue}
          </p>
          {!invitation.order.giftAnonymous && (
            <p>
              <strong>Սիրով՝</strong>{" "}
              {invitation.order.user.name || "Ձեր մտերիմից"}
            </p>
          )}
        </div>

        {invitation.status === "ACCEPTED" ? (
          <p style={{ color: "#26734d", fontWeight: 600 }}>
            Դուք ընդունել եք հրավերը։ Շնորհակալություն։
          </p>
        ) : invitation.status === "DECLINED" ? (
          <p style={{ color: "#a33c3c", fontWeight: 600 }}>
            Դուք մերժել եք հրավերը։
          </p>
        ) : (
          <>
            <p style={{ marginBottom: "20px" }}>
              Խնդրում ենք հաստատել՝ կմասնակցե՞ք միջոցառմանը։
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <form action={respondToInvitation}>
                <input type="hidden" name="token" value={invitation.token} />
                <input type="hidden" name="response" value="ACCEPTED" />
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "none",
                    borderRadius: "10px",
                    background: "#302747",
                    color: "white",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  Ընդունել հրավերը
                </button>
              </form>

              <form action={respondToInvitation}>
                <input type="hidden" name="token" value={invitation.token} />
                <input type="hidden" name="response" value="DECLINED" />
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "1px solid #c9b9ad",
                    borderRadius: "10px",
                    background: "transparent",
                    color: "#6d5550",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  Մերժել հրավերը
                </button>
              </form>
            </div>
          </>
        )}

        <p
          style={{
            marginTop: "36px",
            fontSize: "12px",
            color: "#a99a91",
            letterSpacing: "2px",
          }}
        >
          MADE WITH PAVU
        </p>
      </section>
    </main>
  );
}
