"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createSeatScene } from "@/lib/seatScene";

type Seat = {
  id: string;
  row: string;
  number: number;
  col: number;
  zone: string;
  taken: boolean;
};

export default function SeatView3D({
  seats,
  zoneNames,
  selectedId,
}: {
  seats: Seat[];
  zoneNames: string[];
  selectedId: string | null;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"seat" | "hall">("seat");
  const state = useRef({ selectedId, mode });
  state.current = { selectedId, mode };

  useEffect(() => {
    if (!mount.current) return;
    return createSeatScene(
      THREE,
      mount.current,
      seats,
      zoneNames,
      () => state.current,
    );
  }, [seats, zoneNames]);

  const seat = seats.find((s) => s.id === selectedId);

  return (
    <div className="view3d">
      <div ref={mount} />
      <div className="bar">
        <span className="tag">
          {seat
            ? `Շարք ${seat.row}, տեղ ${seat.number}`
            : "Ընտրիր տեղ՝ տեսարանը տեսնելու համար"}
          {seat && mode === "seat" ? " · քաշիր՝ շուրջդ նայելու համար" : ""}
        </span>
        <button
          type="button"
          className="btn ghost"
          style={{
            padding: "6px 14px",
            background: "rgba(0,0,0,.55)",
            color: "#fff",
            borderColor: "transparent",
          }}
          onClick={() => setMode(mode === "seat" ? "hall" : "seat")}
        >
          {mode === "seat" ? "Դահլիճի ընդհանուր տեսք" : "Տեսարան տեղից"}
        </button>
      </div>
    </div>
  );
}
