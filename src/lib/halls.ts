export type HallSpec = {
  rows: number;
  perRow: number;
  aisleAfter: number; // 0 = no aisle; otherwise an aisle after this seat number
  zoneOf: (row: number) => string;
};

// Builds the seat list of a hall. `col` leaves an empty column where the aisle is.
export function seatRows(hallId: string, spec: HallSpec) {
  const out: {
    hallId: string;
    rowLabel: string;
    number: number;
    zone: string;
    col: number;
  }[] = [];
  for (let r = 1; r <= spec.rows; r++) {
    for (let n = 1; n <= spec.perRow; n++) {
      const col = n + (spec.aisleAfter > 0 && n > spec.aisleAfter ? 1 : 0);
      out.push({
        hallId,
        rowLabel: String(r),
        number: n,
        zone: spec.zoneOf(r),
        col,
      });
    }
  }
  return out;
}
