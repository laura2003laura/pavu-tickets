import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  PENDING: "Նոր հայտ",
  APPROVED: "Հաստատված",
  REJECTED: "Մերժված",
  RESERVE: "Ռեզերվ",
};

export default async function EditVolunteerPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await requireAdmin();

  const application = await db.volunteerApplication.findUnique({
    where: { id: params.id },
    include: { event: true },
  });

  if (!application) notFound();

  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
  });

  async function updateApplication(formData: FormData) {
    "use server";

    await requireAdmin();

    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const birthDate = String(formData.get("birthDate") ?? "");
    const phone = String(formData.get("phone") ?? "").trim();
    const telegram = String(formData.get("telegram") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const eventId = String(formData.get("eventId") ?? "");
    const status = String(formData.get("status") ?? "");
    const languages = String(formData.get("languages") ?? "");
    const experience = String(formData.get("experience") ?? "").trim();
    const availableDays = String(formData.get("availableDays") ?? "").trim();
    const comment = String(formData.get("comment") ?? "").trim();

    if (!firstName || !lastName || !birthDate || !telegram) {
      throw new Error("Լրացրեք պարտադիր դաշտերը։");
    }

    if (!["PENDING", "APPROVED", "REJECTED", "RESERVE"].includes(status)) {
      throw new Error("Սխալ կարգավիճակ։");
    }

    const parsedBirthDate = new Date(`${birthDate}T12:00:00`);

    if (Number.isNaN(parsedBirthDate.getTime())) {
      throw new Error("Ծննդյան ամսաթիվը սխալ է։");
    }

    const eventExists = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!eventExists) {
      throw new Error("Միջոցառումը չի գտնվել։");
    }

    await db.volunteerApplication.update({
      where: { id: params.id },
      data: {
        firstName,
        lastName,
        birthDate: parsedBirthDate,
        phone: phone || null,
        telegram,
        email: email || null,
        eventId,
        status: status as "PENDING" | "APPROVED" | "REJECTED" | "RESERVE",
        languages: languages
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        experience: experience || null,
        availableDays: availableDays || null,
        comment: comment || null,
      },
    });

    revalidatePath("/admin/volunteers");
    revalidatePath(`/admin/volunteers/${params.id}`);
    redirect("/admin/volunteers");
  }

  return (
    <main>
      <p>
        <Link href="/admin/volunteers">← Վերադառնալ հայտերի ցանկ</Link>
      </p>

      <h1>Խմբագրել կամավորի հայտը</h1>
      <p className="lead">
        {application.firstName} {application.lastName}
      </p>

      <form action={updateApplication} className="form">
        <label>
          Անուն *
          <input
            name="firstName"
            defaultValue={application.firstName}
            required
          />
        </label>

        <label>
          Ազգանուն *
          <input name="lastName" defaultValue={application.lastName} required />
        </label>

        <label>
          Ծննդյան ամսաթիվ *
          <input
            type="date"
            name="birthDate"
            defaultValue={application.birthDate.toISOString().slice(0, 10)}
            required
          />
        </label>

        <label>
          Հեռախոս
          <input name="phone" defaultValue={application.phone ?? ""} />
        </label>

        <label>
          Telegram *
          <input name="telegram" defaultValue={application.telegram} required />
        </label>

        <label>
          Էլ․ փոստ
          <input
            type="email"
            name="email"
            defaultValue={application.email ?? ""}
          />
        </label>

        <label>
          Միջոցառում *
          <select name="eventId" defaultValue={application.eventId} required>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Կարգավիճակ *
          <select name="status" defaultValue={application.status}>
            <option value="PENDING">Նոր հայտ</option>
            <option value="APPROVED">Հաստատված</option>
            <option value="REJECTED">Մերժված</option>
            <option value="RESERVE">Ռեզերվ</option>
          </select>
        </label>

        <label>
          Լեզուներ (ստորակետով բաժանված)
          <input
            name="languages"
            defaultValue={application.languages.join(", ")}
          />
        </label>

        <label>
          Կամավորական փորձ
          <textarea
            name="experience"
            defaultValue={application.experience ?? ""}
            rows={3}
          />
        </label>

        <label>
          Հասանելի օրեր
          <textarea
            name="availableDays"
            defaultValue={application.availableDays ?? ""}
            rows={3}
          />
        </label>

        <label>
          Լրացուցիչ մեկնաբանություն
          <textarea
            name="comment"
            defaultValue={application.comment ?? ""}
            rows={3}
          />
        </label>

        <button type="submit" className="btn">
          Պահպանել փոփոխությունները
        </button>
      </form>
    </main>
  );
}
