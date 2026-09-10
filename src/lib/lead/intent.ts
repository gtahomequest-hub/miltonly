// One intent vocabulary, normalized once.
//
// estimateLeadValue (src/lib/leads.ts) understands exactly "rent" | "buy" | "sell" and
// returns 0 for anything else. Fourteen surfaces send fourteen spellings — "buyer",
// "renter", "seller", "home-valuation", "list-rental" — and every one of them was shipping
// a 0 value to Meta's optimizer. Rather than edit fourteen call sites and hope the
// fifteenth remembers, the ingest path normalizes here and the raw token is still stored on
// the row, so nothing about existing analytics changes.

import { estimateLeadValue, type LeadIntent } from "@/lib/leads";

const MAP: Record<string, LeadIntent> = {
  // already correct
  buy: "buy",
  sell: "sell",
  rent: "rent",
  // buy side
  buyer: "buy",
  buyers: "buy",
  "buyer-question": "buy",
  watcher: "buy",
  investor: "buy",
  "first-time-buyer": "buy",
  "market-pulse-unlock": "buy",
  // sell side
  seller: "sell",
  "home-valuation": "sell",
  "list-rental": "sell",
  landlord: "sell",
  // rent side
  renter: "rent",
  tenant: "rent",
};

/** The economic bucket. Unknown tokens fall to "buy" rather than to a 0 value: a lead that
 *  reached a form is worth more than nothing, and a silent 0 is the defect this replaces. */
export function normalizeIntent(raw: string | undefined | null): LeadIntent {
  const key = (raw ?? "").trim().toLowerCase();
  return MAP[key] ?? "buy";
}

/** True when the caller already sent a token the value model understands. Used by the
 *  prebuild test to hold the older surfaces to the vocabulary. */
export function isCanonicalIntent(raw: string | undefined | null): boolean {
  const key = (raw ?? "").trim().toLowerCase();
  return key === "buy" || key === "sell" || key === "rent";
}

export function leadValueFor(raw: string | undefined | null): number {
  return estimateLeadValue(normalizeIntent(raw));
}
