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
//
// AND, since the stale-meta pass, by the LIVE ROUTE at request time
// (src/lib/hubLive.ts -> the /neighbourhoods/[slug] generateMetadata). That is
// now the only path a reader's meta description comes from: the stored
// HubContent.metaDescription is no longer served. It was written once at
// generation time and every figure in it drifted — 16 of 22 prices and 21 of 21
// sale counts, all of them overstating a market that has since cooled, and two
// of them (Brookville / Haltonville, Milton North) publishing a typical price
// into the SERP that their own sub-k page is forbidden to state.
//
// ONE SOURCE, ONE ROUNDING is the whole point: round5k below is exported and is
// the only place a hub display price is rounded — the meta hook, the hero stat
// tile, and the vs-Milton comparison row all pass through it, so the number in
// the search result and the number on the page cannot diverge again.
import { config } from "@/lib/config";

export interface HubMetaAggregates {
  typicalPrice: number | null; // null = k-anon suppressed
  salesCount: number;
}

/** THE display rounding for every hub price, on every surface. */
export const round5k = (n: number): number => Math.round(n / 5000) * 5000;

/** k-gated live typical, rounded for display. null stays null — never a zero. */
export function hubDisplayTypical(typicalPrice: number | null | undefined): number | null {
  return typicalPrice != null && typicalPrice > 0 ? round5k(typicalPrice) : null;
}

export function buildHubMeta(
  name: string,
  aggregates: HubMetaAggregates,
  profile: "urban" | "rural",
  // Optional per-hub SERP closer. Defaults to the corpus-wide clause; the
  // Timberlea rewrite (GSC 2026-07-18) supplies its own. Everything before it —
  // the title, the template, the hook, the rounding — stays shared.
  closer = "a straight market read",
): { metaTitle: string; metaDescription: string } {
  const surface = profile === "urban" ? "Street" : "Road";
  const walk = profile === "urban" ? "Street-by-street" : "Road-by-road";
  const metaTitle = `${name}, ${config.CITY_NAME} — Homes, Prices & ${surface} Guide`;

  const rounded = hubDisplayTypical(aggregates.typicalPrice);
  const n = aggregates.salesCount;
  const sales = (count: number) => `${count} sale${count === 1 ? "" : "s"}`;

  const hook =
    rounded != null
      ? `typically $${rounded.toLocaleString("en-CA")}${n > 0 ? `, ${sales(n)} in the last 12 months` : ""}`
      : n > 0
        ? `every sale on file (${sales(n)} tracked)`
        : null;

  const metaDescription = hook
    ? `${name} homes for sale and what they really sell for — ${hook}. ${walk} guide, live listings, and ${closer}.`
    : `${name}, ${config.CITY_NAME} — live listings and the ${walk.toLowerCase()} read.`;

  return { metaTitle, metaDescription };
}
