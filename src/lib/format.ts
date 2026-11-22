export const money = (cents: number, currency: string) =>
  `${(cents / 100).toFixed(0)} ${currency === "AMD" ? "֏" : currency}`;

export const day = (d: Date) =>
  d.toLocaleDateString("hy-AM", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Yerevan",
  });

export const time = (d: Date) =>
  d.toLocaleTimeString("hy-AM", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Yerevan",
  });

const GRADIENTS = [
  "#8f6bff,#c04cb0",
  "#ff9447,#c04cb0",
  "#c04cb0,#5a3bd0",
  "#5a3bd0,#8f6bff",
  "#ff9447,#e0556f",
  "#4b7bff,#8f6bff",
];
export const gradient = (id: string) =>
  GRADIENTS[
    [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % GRADIENTS.length
  ];

export const SCAN_LABEL: Record<string, string> = {
  SUCCESS: "Թույլատրված",
  ALREADY_USED: "Արդեն օգտագործված",
  INVALID_SIGNATURE: "Կեղծ QR",
  CANCELLED: "Չեղարկված",
  WRONG_EVENT: "Այլ միջոցառում",
  NOT_FOUND: "Չի գտնվել",
};
