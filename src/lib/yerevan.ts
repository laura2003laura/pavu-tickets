// Approximate bounding box of Yerevan, used by the delivery map (client) and validation (server).
export const YEREVAN_BOUNDS = {
  latMin: 40.06,
  latMax: 40.27,
  lngMin: 44.37,
  lngMax: 44.63,
};
export const YEREVAN_CENTER: [number, number] = [40.1792, 44.5086];

export const inYerevan = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= YEREVAN_BOUNDS.latMin &&
  lat <= YEREVAN_BOUNDS.latMax &&
  lng >= YEREVAN_BOUNDS.lngMin &&
  lng <= YEREVAN_BOUNDS.lngMax;
