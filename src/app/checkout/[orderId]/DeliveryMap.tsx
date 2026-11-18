"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { YEREVAN_BOUNDS as B, YEREVAN_CENTER, inYerevan } from "@/lib/yerevan";

type Props = { onPick: (lat: number, lng: number, address?: string) => void };

// Map of Yerevan (OpenStreetMap tiles). Click to mark the delivery place.
export default function DeliveryMap({ onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const locate = useRef<() => void>(() => {});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let map: any;
    let gone = false;
    (async () => {
      const mod: any = await import("leaflet");
      const L = mod.default ?? mod;
      if (gone || !el.current) return;

      map = L.map(el.current, {
        center: YEREVAN_CENTER,
        zoom: 13,
        minZoom: 11,
        maxBounds: [[B.latMin - 0.05, B.lngMin - 0.08], [B.latMax + 0.05, B.lngMax + 0.08]],
        maxBoundsViscosity: 1,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const icon = L.divIcon({ className: "pin", html: "📍", iconSize: [28, 28], iconAnchor: [14, 26] });
      let marker: any = null;

      const place = async (lat: number, lng: number) => {
        if (!inYerevan(lat, lng)) {
          setMsg("Առաքումը հասանելի է միայն Երևանում։ Նշիր կետ քաղաքի սահմաններում։");
          return;
        }
        setMsg("");
        if (marker) marker.setLatLng([lat, lng]);
        else marker = L.marker([lat, lng], { icon }).addTo(map);
        pick.current(lat, lng); // coordinates are ready immediately
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hy`,
          );
          const j = await r.json();
          if (!gone && j?.display_name) pick.current(lat, lng, String(j.display_name).slice(0, 200));
        } catch {} // address can always be typed by hand
      };

      map.on("click", (e: any) => place(e.latlng.lat, e.latlng.lng));
      locate.current = () => {
        if (!navigator.geolocation) return setMsg("Դիրքի որոշումը հասանելի չէ այս սարքում։");
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const { latitude, longitude } = p.coords;
            if (!inYerevan(latitude, longitude)) return setMsg("Դու Երևանից դուրս ես, նշիր կետը ձեռքով։");
            map.setView([latitude, longitude], 16);
            place(latitude, longitude);
          },
          () => setMsg("Չհաջողվեց որոշել դիրքը։ Նշիր կետը ձեռքով։"),
        );
      };
    })();
    return () => {
      gone = true;
      map?.remove();
    };
  }, []);

  return (
    <div>
      <div ref={el} className="map" />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn ghost" onClick={() => locate.current()}>Օգտագործել իմ դիրքը</button>
        {msg && <span className="err" style={{ fontSize: 14 }}>{msg}</span>}
      </div>
    </div>
  );
}
