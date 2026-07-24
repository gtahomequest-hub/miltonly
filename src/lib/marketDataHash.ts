// src/lib/marketDataHash.ts
// Extracted from streetUtils.ts (2026-07) so streetUtils has NO Node-only imports
// and can be imported by the Edge middleware (for deriveIdentity). This is the only
// crypto user; its 3 callers are all Node-runtime (sync/regenerate, generateStreet,
// streetDecision).
import { createHash } from "crypto";

// active-only stats shape — no sold-price-derived fields, since DB1 no longer
// stores them. Changing this hash invalidates existing streetContent rows
// and forces regeneration, which is the intended behaviour after a semantic
// shift like this.
export function calcMarketDataHash(stats: {
  avgListPrice: number;
  totalSold12mo: number;
  avgDOM: number;
  dominantPropertyType: string;
}): string {
  const hashInput = [
    Math.round(stats.avgListPrice / 10000),
    stats.totalSold12mo,
    Math.round(stats.avgDOM),
    stats.dominantPropertyType,
  ].join("|");

  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}
