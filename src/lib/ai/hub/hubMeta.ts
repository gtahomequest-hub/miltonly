// src/lib/ai/hub/hubMeta.ts
// The hub SERP title/meta formula, proven by the Timberlea rewrite (GSC
// 2026-07-18 keyword report) and mirrored from the street-template ladder:
// searcher-word-order title with NO data values; the live-data hook lives in
// the DESCRIPTION (k-safe typical price + sold count, transaction-count
// fallback when the price is k-anon suppressed).
//
// Used by BOTH generators (urban/rural) at generation time and by the
// one-shot backfill script (scripts/backfill-hub-meta.ts) so stored strings
// are identical regardless of which path wrote them.
import { config } from "@/lib/config";

export interface HubMetaAggregates {
  typicalPrice: number | null; // null = k-anon suppressed
  salesCount: number;
}

export function buildHubMeta(
  name: string,
  aggregates: HubMetaAggregates,
  profile: "urban" | "rural",
): { metaTitle: string; metaDescription: string } {
  const surface = profile === "urban" ? "Street" : "Road";
  const walk = profile === "urban" ? "Street-by-street" : "Road-by-road";
  const metaTitle = `${name}, ${config.CITY_NAME} — Homes, Prices & ${surface} Guide`;

  const p = aggregates.typicalPrice;
  const n = aggregates.salesCount;
  const rounded = p != null && p > 0 ? Math.round(p / 5000) * 5000 : null;
  const sales = (count: number) => `${count} sale${count === 1 ? "" : "s"}`;

  const hook =
    rounded != null
      ? `typically $${rounded.toLocaleString("en-CA")}${n > 0 ? `, ${sales(n)} in the last 12 months` : ""}`
      : n > 0
        ? `every sale on file (${sales(n)} tracked)`
        : null;

  const metaDescription = hook
    ? `${name} homes for sale and what they really sell for — ${hook}. ${walk} guide, live listings, and a straight market read.`
    : `${name}, ${config.CITY_NAME} — live listings and the ${walk.toLowerCase()} read.`;

  return { metaTitle, metaDescription };
}
