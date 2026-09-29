// src/components/street-design/data.ts
// MH-011: fictional data for the street-page design preview at /design-preview/street.
// "Aamir Court" does not exist. Nothing here is read from the database, the MLS feed or the
// Town registry, and nothing here is served on any /streets page.

export type Sale = {
  /** ISO month the sale closed, e.g. "2026-08". */
  month: string;
  price: number;
  list: number;
  days: number;
};

export type Home = {
  number: number;
  type: "Detached" | "Semi-detached";
  sale?: Sale;
  forSale?: boolean;
};

export const STREET = {
  name: "Aamir Court",
  slug: "aamir-court",
  neighbourhood: "Hawthorne Village",
  updated: "Sep 28, 2026",
  updatedIso: "2026-09-28",
  /** The first month of the 24-month sold window. */
  windowStart: "Sep 2024",
  homes: 42,
  forSale: 1,
  buildEra: "2001 to 2010",
  videoLength: "1:48",
  videoFilmed: "Sep 2, 2026",
};

const SALES: Record<number, Sale> = {
  2: { month: "2026-08", price: 1212000, list: 1199900, days: 9 },
  5: { month: "2026-07", price: 1085000, list: 1099000, days: 14 },
  8: { month: "2026-07", price: 1158000, list: 1149000, days: 7 },
  11: { month: "2026-05", price: 1049000, list: 1069900, days: 21 },
  14: { month: "2026-04", price: 1265000, list: 1249000, days: 6 },
  19: { month: "2026-03", price: 1098000, list: 1099900, days: 12 },
  21: { month: "2026-01", price: 1132500, list: 1149900, days: 25 },
  24: { month: "2025-11", price: 1189000, list: 1199000, days: 16 },
  27: { month: "2025-09", price: 1040000, list: 1079000, days: 31 },
  30: { month: "2025-06", price: 1175000, list: 1169900, days: 8 },
  33: { month: "2025-04", price: 1210000, list: 1189000, days: 5 },
  36: { month: "2025-02", price: 1119000, list: 1129000, days: 18 },
  39: { month: "2024-12", price: 1068000, list: 1089000, days: 27 },
  41: { month: "2024-10", price: 1099900, list: 1099900, days: 11 },
};

// Odd numbers back onto the trail and are mostly semis; even numbers are detached.
export const HOMES: Home[] = Array.from({ length: 42 }, (_, i) => {
  const n = i + 1;
  return {
    number: n,
    type: n % 2 === 0 ? "Detached" : "Semi-detached",
    sale: SALES[n],
    forSale: n === 17 ? true : undefined,
  };
});

export const SOLD = HOMES.filter((h) => h.sale).sort((a, b) => (a.sale!.month < b.sale!.month ? 1 : -1));

function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// k-anonymity: a point "typical" needs 5 sales, a range needs 10. Suppression is null, never 0.
const prices = SOLD.map((h) => h.sale!.price);
const days = SOLD.map((h) => h.sale!.days);
const ratios = SOLD.map((h) => h.sale!.price / h.sale!.list);
export const TYPICAL = {
  price: prices.length >= 5 ? Math.round(quantile(prices, 0.5) / 1000) * 1000 : null,
  priceLow: prices.length >= 10 ? Math.round(quantile(prices, 0.25) / 1000) * 1000 : null,
  priceHigh: prices.length >= 10 ? Math.round(quantile(prices, 0.75) / 1000) * 1000 : null,
  days: days.length >= 5 ? Math.round(quantile(days, 0.5)) : null,
  saleToList: ratios.length >= 5 ? Math.round(quantile(ratios, 0.5) * 1000) / 10 : null,
};

export const LISTING = {
  number: 17,
  price: 1149900,
  beds: 3,
  baths: 3,
  type: "Semi-detached",
  sqft: "1,500 to 2,000 sq ft",
  listedDays: 12,
  brokerage: "Northgate Realty Inc., Brokerage",
  line: "Backs onto the trail. Finished basement with a side entrance.",
};

export type Change = { date: string; iso: string; kind: string; text: string; registeredOnly?: boolean };

export const CHANGES: Change[] = [
  { date: "Sep 16, 2026", iso: "2026-09-16", kind: "New listing", text: "17 Aamir Court, a semi-detached home, listed for $1,149,900." },
  { date: "Sep 2, 2026", iso: "2026-09-02", kind: "New video", text: "A drive down the street, filmed on a weekday morning." },
  { date: "Aug 12, 2026", iso: "2026-08-12", kind: "Home sold", text: "2 Aamir Court sold 9 days after it was listed.", registeredOnly: true },
  { date: "Jul 21, 2026", iso: "2026-07-21", kind: "Planning application", text: "Minor variance at 30 Aamir Court for a rear deck, file A-2026-044. Decision pending." },
];

export type Fact = { label: string; value: string; note?: string; gated?: boolean };

export const FEATURES: { label: string; count: number }[] = [
  { label: "Finished basement", count: 9 },
  { label: "Pot lights", count: 8 },
  { label: "Double garage", count: 6 },
  { label: "Backs onto the trail", count: 5 },
  { label: "Side or separate entrance", count: 4 },
  { label: "Walk-out basement", count: 2 },
];

export const NOTE = {
  lines: [
    "Aamir Court is a closed loop, so the cars you see belong to the neighbours and the school run.",
    "The semis on the odd side back onto the trail, and buyers ask about those first.",
    "If you own here and wonder where your home sits today, the home report is a fair place to start.",
  ],
  date: "Sep 28, 2026",
};

export const ADJACENT = ["Tamarack Way", "Larkspur Crescent", "Owl Ridge Drive"];

export const money = (n: number) => `$${n.toLocaleString("en-CA")}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
