"use client";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Res = {
  ok: boolean;
  result: string;
  event?: string;
  type?: string;
  seat?: string;
  usedAt?: string;
};

const MSG: Record<string, string> = {
  SUCCESS: "Տոմսը վավեր է, մուտքը թույլատրված է",
  ALREADY_USED: "Տոմսն արդեն օգտագործված է",
  INVALID_SIGNATURE: "Կեղծ կամ սխալ QR կոդ",
  CANCELLED: "Տոմսը չեղարկված է",
  WRONG_EVENT: "Տոմսը այլ միջոցառման համար է",
  NOT_FOUND: "Տոմսը չի գտնվել",
  NETWORK: "Կապի սխալ, սկանավորիր նորից",
  CAMERA: "Տեսախցիկը հասանելի չէ։ Թույլ տուր տեսախցիկի օգտագործումը",
};

export default function Scanner({
  events,
}: {
  events: { id: string; title: string }[];
}) {
  const [res, setRes] = useState<Res | null>(null);
  const [eventId, setEventId] = useState(events[0].id);
  const eventRef = useRef(eventId);
  const last = useRef({ text: "", at: 0 });

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const scanner = new Html5Qrcode("reader");
    const startP = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        async (text) => {
          const now = Date.now();
          if (
            busy ||
            (text === last.current.text && now - last.current.at < 3000)
          )
            return;
          busy = true;
          last.current = { text, at: now };
          try {
            const r = await fetch("/api/checkin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: text, eventId: eventRef.current }),
            });
            const data = await r.json();
            if (!cancelled) setRes(data);
          } catch {
            last.current = { text: "", at: 0 }; // allow an immediate retry
            if (!cancelled) setRes({ ok: false, result: "NETWORK" });
          } finally {
            busy = false;
          }
        },
        () => {},
      )
      .then(() => true)
      .catch(() => {
        if (!cancelled) setRes({ ok: false, result: "CAMERA" });
        return false;
      });
    return () => {
      cancelled = true;
      // wait for start() to finish before stopping, so the camera is always released
      startP
        .then((ok) =>
          ok ? scanner.stop().then(() => scanner.clear()) : undefined,
        )
        .catch(() => {});
    };
  }, []);

  return (
    <>
      <label style={{ maxWidth: 420, marginBottom: 16 }}>
        Միջոցառում
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            eventRef.current = e.target.value;
            setRes(null);
          }}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      <div id="reader" />
      {res && (
        <div className={`res ${res.ok ? "ok" : "bad"}`} role="status">
          {MSG[res.result] ?? "Սխալ"}
          {res.event && (
            <small>
              {res.event}, {res.type}
            </small>
          )}
          {res.seat && <small>{res.seat}</small>}
          {res.usedAt && (
            <small>
              Առաջին մուտքը՝ {new Date(res.usedAt).toLocaleString("hy-AM")}
            </small>
          )}
        </div>
      )}
    </>
  );
}
