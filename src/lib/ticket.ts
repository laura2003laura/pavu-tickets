import { createHmac, timingSafeEqual } from "crypto";

// The QR code holds "<ticketId>.<signature>". Only the server knows the secret,
// so nobody can invent a valid QR code.
const sign = (id: string) => {
  const secret = process.env.TICKET_SECRET;
  if (!secret) throw new Error("TICKET_SECRET is not set in .env");
  return createHmac("sha256", secret).update(id).digest("base64url");
};

export const makeToken = (ticketId: string) => `${ticketId}.${sign(ticketId)}`;

export function readToken(token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(id));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}
