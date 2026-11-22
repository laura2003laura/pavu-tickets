// Demo-mode card check. Card data is only validated and then thrown away: it is never stored or logged.
// With real Stripe the card is typed on Stripe's own page and never reaches this server.
const luhn = (digits: string) => {
  let sum = 0,
    dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
};

export function validCard(f: {
  number: string;
  expiry: string;
  cvc: string;
  holder: string;
}) {
  const num = f.number.replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(num) || !luhn(num)) return false;
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(f.expiry.trim());
  if (!m) return false;
  const month = Number(m[1]),
    year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  if (new Date(year, month, 1) <= new Date()) return false; // valid until the end of the month
  if (!/^\d{3,4}$/.test(f.cvc.trim())) return false;
  return f.holder.trim().length >= 2;
}
