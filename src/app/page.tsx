import Link from "next/link";
import { db } from "@/lib/db";
import { day, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";
const CATS = ["Երաժշտություն", "Թատրոն", "Ստենդափ", "Սպորտ", "Կոնֆերանս"];
const cover = (category: string) =>
  category === "Երաժշտություն"
    ? "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1000&q=80"
    : category === "Թատրոն"
      ? "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1000&q=80"
      : category === "Սպորտ"
        ? "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80"
        : category === "Կոնֆերանս"
          ? "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80"
          : "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=80";

export default async function Home(props: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim();
  const cat = searchParams.cat;
  const events = await db.event.findMany({
    where: {
      isPublished: true,
      startsAt: { gte: new Date() },
      ...(cat ? { category: cat } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { venue: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { ticketTypes: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <main>
      <h1>Տոմսը քո հեռախոսում, մուտքը՝ մեկ սկանով</h1>
      <p className="lead">
        Գնիր տոմսեր համերգների, թատրոնի և սպորտային միջոցառումների համար։
        Յուրաքանչյուր QR կոդ աշխատում է միայն մեկ անգամ։
      </p>

      <form
        style={{ display: "flex", gap: 8, maxWidth: 480, marginBottom: 22 }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Գտիր միջոցառում կամ քաղաք"
          aria-label="Որոնում"
          style={{ flex: 1 }}
        />
        {cat && <input type="hidden" name="cat" value={cat} />}
        <button className="btn">Որոնել</button>
      </form>

      <div className="chips">
        <Link className={`chip ${!cat ? "on" : ""}`} href="/">
          Բոլորը
        </Link>
        {CATS.map((c) => (
          <Link
            key={c}
            className={`chip ${cat === c ? "on" : ""}`}
            href={`/?cat=${encodeURIComponent(c)}`}
          >
            {c}
          </Link>
        ))}
      </div>

      {events.length === 0 && (
        <p className="muted">
          Ոչինչ չգտնվեց։ Փորձիր այլ բառ կամ ընտրիր «Բոլորը»։
        </p>
      )}

      <div className="grid">
        {events.map((e) => {
          const min = e.ticketTypes.length
            ? Math.min(...e.ticketTypes.map((t) => t.priceCents))
            : null;
          const cur = e.ticketTypes[0]?.currency ?? "AMD";
          return (
            <article className="card" key={e.id}>
              <div
                className="event-card-art"
                style={{
                  backgroundImage: `linear-gradient(180deg,rgba(14,8,25,.05),rgba(14,8,25,.72)), url("${e.imageUrl || cover(e.category)}")`,
                }}
              >
                <div className="date">
                  {day(e.startsAt)}
                  <br />
                  <span>{time(e.startsAt)}</span>
                </div>
                <span className="cat">{e.category}</span>
                <span className="art-caption">LIVE · PAVU EXPERIENCE</span>
              </div>
              <div className="perf" />
              <div className="body">
                <h4>{e.title}</h4>
                <p>
                  {e.city}, {e.venue}
                </p>
              </div>
              <div className="foot">
                <span className="price">
                  {min === null ? (
                    <span className="muted">Գինը շուտով</span>
                  ) : (
                    <>
                      <span
                        className="muted"
                        style={{ fontWeight: 500, fontSize: 13 }}
                      >
                        սկսած{" "}
                      </span>
                      {money(min, cur)}
                    </>
                  )}
                </span>
                <Link className="btn" href={`/events/${e.id}`}>
                  Դիտել միջոցառումը <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
