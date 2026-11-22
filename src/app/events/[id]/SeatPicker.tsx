"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { money } from "@/lib/format";

const SeatView3D = dynamic(() => import("./SeatView3D"), {
  ssr: false,
  loading: () => <p className="muted">3D տեսարանը բեռնվում է…</p>,
});

type Seat = {
  id: string;
  row: string;
  number: number;
  col: number;
  zone: string;
  taken: boolean;
};
type Zone = { name: string; priceCents: number; currency: string };

const COLORS = ["#ff9447", "#8f6bff", "#3ec9a7", "#e0556f", "#4b7bff"];
const MAX = 8;

export default function SeatPicker({
  seats,
  zones,
  action,
}: {
  seats: Seat[];
  zones: Zone[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [sel, setSel] = useState<string[]>([]);

  const zoneNames = useMemo(() => zones.map((z) => z.name), [zones]);
  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const zoneOf = useMemo(() => new Map(zones.map((z) => [z.name, z])), [zones]);
  const color = (zone: string) =>
    COLORS[
      Math.max(
        0,
        zones.findIndex((z) => z.name === zone),
      ) % COLORS.length
    ];

  const rows = useMemo(() => {
    const m = new Map<string, Seat[]>();
    for (const s of seats) {
      if (!m.has(s.row)) m.set(s.row, []);
      m.get(s.row)!.push(s);
    }
    return [...m.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [seats]);
  const maxCol = Math.max(1, ...seats.map((s) => s.col));

  const toggle = (id: string) =>
    setSel((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < MAX
          ? [...cur, id]
          : cur,
    );

  const total = sel.reduce(
    (sum, id) => sum + (zoneOf.get(byId.get(id)!.zone)?.priceCents ?? 0),
    0,
  );
  const currency = zones[0]?.currency ?? "AMD";

  return (
    <div>
      <div className="legend">
        {zones.map((z) => (
          <span key={z.name}>
            <i style={{ background: color(z.name) }} /> {z.name},{" "}
            {money(z.priceCents, z.currency)}
          </span>
        ))}
        <span>
          <i className="taken" /> Զբաղված
        </span>
      </div>

      <div className="seatmap">
        <div className="stage">Բեմ / Էկրան</div>
        {rows.map(([row, list]) => (
          <div
            className="seatrow"
            key={row}
            style={{ gridTemplateColumns: `28px repeat(${maxCol}, 28px)` }}
          >
            <span className="rowlabel">{row}</span>
            {list.map((s) => {
              const on = sel.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={s.taken}
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  aria-label={`Շարք ${s.row}, տեղ ${s.number}, ${s.zone}${s.taken ? ", զբաղված" : ""}`}
                  className={`seat ${s.taken ? "taken" : ""} ${on ? "sel" : ""}`}
                  style={{
                    gridColumn: s.col + 1,
                    gridRow: 1,
                    background: s.taken ? undefined : color(s.zone),
                  }}
                >
                  {s.number}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 28 }}>Տեսարանը քո տեղից</h3>
      <SeatView3D
        seats={seats}
        zoneNames={zoneNames}
        selectedId={sel[sel.length - 1] ?? null}
      />

      <form action={action} className="panel stack" style={{ marginTop: 20 }}>
        {sel.map((id) => (
          <input key={id} type="hidden" name="seatId" value={id} />
        ))}
        <strong>
          Ընտրված տեղեր ({sel.length}/{MAX})
        </strong>
        {sel.length === 0 ? (
          <span className="muted">Սեղմիր դահլիճի սխեմայի ազատ տեղերի վրա։</span>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sel.map((id) => {
              const s = byId.get(id)!;

              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "9px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                  }}
                >
                  <span>
                    Տող {s.row}, տեղ {s.number} ({s.zone}) —{" "}
                    {money(zoneOf.get(s.zone)?.priceCents ?? 0, currency)}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setSel((current) => current.filter((x) => x !== id))
                    }
                    aria-label={`Հեռացնել ${s.row} տողի ${s.number} տեղը`}
                    title="Հեռացնել տեղը"
                    style={{
                      background: "#c0392b",
                      color: "white",
                      border: 0,
                      borderRadius: 7,
                      width: 30,
                      height: 30,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <strong>Ընդամենը՝ {money(total, currency)}</strong>
        <button className="btn" disabled={sel.length === 0}>
          Շարունակել
        </button>
      </form>
    </div>
  );
}
