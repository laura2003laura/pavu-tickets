import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { seatRows } from "@/lib/halls";

export const dynamic = "force-dynamic";

export default async function Halls({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  const halls = await db.hall.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { seats: true, events: true } } } });
  const zoneRows = await db.seat.groupBy({ by: ["hallId", "zone"], _count: { _all: true } });

  async function createHall(formData: FormData) {
    "use server";
    await requireAdmin();
    const n = (k: string) => Math.floor(Number(formData.get(k)));
    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const rows = n("rows"), perRow = n("perRow"), aisleAfter = Math.max(0, n("aisleAfter") || 0);
    const vip = Math.max(0, n("vipRows") || 0), balcony = Math.max(0, n("balconyRows") || 0);
    if (!name || !city || !(rows >= 1 && rows <= 40) || !(perRow >= 1 && perRow <= 40) || vip + balcony >= rows) {
      redirect("/admin/halls?error=1");
    }
    const hall = await db.hall.create({ data: { name, city } });
    await db.seat.createMany({
      data: seatRows(hall.id, {
        rows, perRow, aisleAfter,
        zoneOf: (r) => (r <= vip ? "VIP" : r > rows - balcony ? "Պատշգամբ" : "Standard"),
      }),
    });
    revalidatePath("/admin/halls");
  }

  return (
    <main>
      <h1>Դահլիճներ</h1>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Անվանում</th><th>Քաղաք</th><th>Տեղեր</th><th>Գոտիներ</th><th>Միջոցառումներ</th></tr></thead>
          <tbody>
            {halls.map((h) => (
              <tr key={h.id}>
                <td>{h.name}</td><td>{h.city}</td><td>{h._count.seats}</td>
                <td>{zoneRows.filter((z) => z.hallId === h.id).map((z) => `${z.zone} (${z._count._all})`).join(", ")}</td>
                <td>{h._count.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createHall} className="panel stack" style={{ marginTop: 24 }}>
        <h3 style={{ margin: 0 }}>Նոր դահլիճ</h3>
        <label>Անվանում<input name="name" required /></label>
        <label>Քաղաք<input name="city" required /></label>
        <label>Շարքերի քանակ (1-40)<input type="number" name="rows" min={1} max={40} required /></label>
        <label>Տեղեր մեկ շարքում (1-40)<input type="number" name="perRow" min={1} max={40} required /></label>
        <label>Անցուղի՝ քանի՞ տեղից հետո (0՝ առանց անցուղու)<input type="number" name="aisleAfter" min={0} defaultValue={0} /></label>
        <label>VIP շարքեր (առջևից)<input type="number" name="vipRows" min={0} defaultValue={0} /></label>
        <label>Պատշգամբի շարքեր (ետևից)<input type="number" name="balconyRows" min={0} defaultValue={0} /></label>
        {searchParams.error && <p className="err">Ստուգիր տվյալները. VIP և պատշգամբի շարքերի գումարը պետք է փոքր լինի շարքերի քանակից։</p>}
        <button className="btn">Ստեղծել դահլիճ</button>
      </form>
    </main>
  );
}
