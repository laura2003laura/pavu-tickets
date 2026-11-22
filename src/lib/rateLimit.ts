// Simple in-memory limiter (per server process). Enough for a demo / single server;
// use Redis or a database table if the site runs on several instances.
const hits = new Map<string, { n: number; reset: number }>();

export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000)
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return true;
  }
  h.n++;
  return h.n <= max;
}

export const clearLimit = (key: string) => void hits.delete(key);
