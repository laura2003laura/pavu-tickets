import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Scanner from "./Scanner";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/scanner");
  if (user.role !== "STAFF" && user.role !== "ADMIN") redirect("/");
  const events = await db.event.findMany({
    where: {
      isPublished: true,
      startsAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    }, // today and upcoming
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true },
  });
  return (
    <main>
      <h1>Տոմսերի ստուգում</h1>
      {events.length === 0 ? (
        <p className="muted">Այսօրվա կամ առաջիկա միջոցառումներ չկան։</p>
      ) : (
        <Scanner events={events} />
      )}
    </main>
  );
}
