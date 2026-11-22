
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  PENDING: "Նոր հայտ",
  APPROVED: "Հաստատված",
  REJECTED: "Մերժված",
  RESERVE: "Ռեզերվ",
};

async function changeVolunteerStatus(formData: FormData) {
  "use server";

  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !["APPROVED", "REJECTED", "RESERVE"].includes(status)) {
    throw new Error("Սխալ տվյալներ։");
  }

  await db.volunteerApplication.update({
    where: { id },
    data: {
      status: status as "APPROVED" | "REJECTED" | "RESERVE",
    },
  });

  revalidatePath("/admin/volunteers");
}

export default async function AdminVolunteers(
  props: {
    searchParams: Promise<{
      search?: string;
      status?: string;
      eventId?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireAdmin();

  const search = (searchParams.search ?? "").trim();
  const status = searchParams.status ?? "";
  const eventId = searchParams.eventId ?? "";

  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
  });
  const allowedStatuses = ["PENDING", "APPROVED", "REJECTED", "RESERVE"];

  const selectedStatus = allowedStatuses.includes(status)
    ? status
    : "";
  const applications = await db.volunteerApplication.findMany({
 where: {
  ...(selectedStatus
    ? {
        status: selectedStatus as
          | "PENDING"
          | "APPROVED"
          | "REJECTED"
          | "RESERVE",
      }
    : {
        status: {
          in: ["PENDING", "APPROVED"],
        },
      }),
  ...(eventId ? { eventId } : {}),
  ...(search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }
    : {}),
},
  include: { event: true },
  orderBy: { createdAt: "desc" },
});

  return (
    <main>
      <p>
        <Link href="/admin">← Վերադառնալ ադմինիստրատոր</Link>
      </p>

      <h1>Կամավորների հայտեր</h1>

      <p className="lead">
        Գտնված հայտերի քանակը՝ {applications.length}
      </p>

      <form
        method="GET"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
          margin: "20px 0",
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <label style={{ flex: "1 1 220px" }}>
          Որոնում
          <input
            type="text"
            name="search"
            placeholder="Անուն, ազգանուն կամ հեռախոս"
            defaultValue={search}
            style={{ width: "100%" }}
          />
        </label>

        <label style={{ flex: "1 1 170px" }}>
          Կարգավիճակ
          <select
            name="status"
            defaultValue={status}
            style={{ width: "100%" }}
          >
            <option value="">Բոլոր կարգավիճակները</option>
            <option value="PENDING">Նոր հայտ</option>
            <option value="APPROVED">Հաստատված</option>
            <option value="REJECTED">Մերժված</option>
            <option value="RESERVE">Ռեզերվ</option>
          </select>
        </label>

        <label style={{ flex: "1 1 200px" }}>
          Միջոցառում
          <select
            name="eventId"
            defaultValue={eventId}
            style={{ width: "100%" }}
          >
            <option value="">Բոլոր միջոցառումները</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn">
          Որոնել
        </button>

        <Link href="/admin/volunteers" className="btn ghost">
          Մաքրել
        </Link>
      </form>

      {applications.length === 0 ? (
        <p className="muted">Համապատասխան հայտեր չեն գտնվել։</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Անուն, ազգանուն</th>
                <th>Հեռախոս</th>
                <th>Telegram</th>
                <th>Ծննդյան ամսաթիվ</th>
                <th>Միջոցառում</th>
                <th>Հայտի ամսաթիվ</th>
                <th>Կարգավիճակ</th>
                <th>Գործողություններ</th>
              </tr>
            </thead>

            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{a.firstName} {a.lastName}</td>
                  <td>{a.phone ?? "—"}</td>
                  <td>{a.telegram}</td>
                  <td>{a.birthDate.toLocaleDateString("hy-AM")}</td>
                  <td>{a.event.title}</td>
                  <td>{a.createdAt.toLocaleDateString("hy-AM")}</td>
                  <td>{statusLabel[a.status] ?? a.status}</td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        className="btn ghost"
                        href={`/admin/volunteers/${a.id}`}
                      >
                        Խմբագրել
                      </Link>

                      <form action={changeVolunteerStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="APPROVED" />
                        <button
                          type="submit"
                          title="Հաստատել"
                          disabled={a.status === "APPROVED"}
                          style={{
                            background: "#16834a",
                            color: "white",
                            border: 0,
                            borderRadius: 8,
                            padding: "9px 13px",
                            cursor: "pointer",
                            opacity: a.status === "APPROVED" ? 0.45 : 1,
                          }}
                        >
                          ✓
                        </button>
                      </form>

                      <form action={changeVolunteerStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="REJECTED" />
                        <button
                          type="submit"
                          title="Մերժել"
                          disabled={a.status === "REJECTED"}
                          style={{
                            background: "#c0392b",
                            color: "white",
                            border: 0,
                            borderRadius: 8,
                            padding: "9px 13px",
                            cursor: "pointer",
                            opacity: a.status === "REJECTED" ? 0.45 : 1,
                          }}
                        >
                          ✕
                        </button>
                      </form>

                      <form action={changeVolunteerStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="RESERVE" />
                        <button
                          type="submit"
                          title="Տեղափոխել ռեզերվ"
                          disabled={a.status === "RESERVE"}
                          style={{
                            background: "#d58b20",
                            color: "white",
                            border: 0,
                            borderRadius: 8,
                            padding: "9px 13px",
                            cursor: "pointer",
                            opacity: a.status === "RESERVE" ? 0.45 : 1,
                          }}
                        >
                          ◷
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
