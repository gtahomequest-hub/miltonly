// src/lib/ai/hub/hubMeta.ts
// The hub SERP title/meta formula. Searcher-word-order title with NO data values.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40, ruling R4). The description used to carry
// the hub's typical sold price and its 12-month sale count ("typically $X, N sales in the last
// 12 months", or "every sale on file (N sales tracked)" below the k floor). Both are values
// derived from VOW records, and a SERP snippet is served to everyone. The description is now
// written only from what the public may see: the count of homes advertised for sale today (IDX
// active listings) and the count of street guides published in the neighbourhood (registry +
// our own pages). No price, no sale count, no market claim.
//
// Used by the LIVE ROUTE (src/lib/hubLive.ts -> /neighbourhoods/[slug] generateMetadata) and by
// the generators and the backfill, which still pass the sold aggregate. That shape is accepted
// for compatibility and never read: a stored description written by a generator is figure-free
// too.
import { config } from "@/lib/config";

/** The public facts a hub description may state. Both are counts of public things. */
export interface HubMetaFacts {
  /** IDX active sale listings in the neighbourhood today. */
  activeCount?: number | null;
  /** Published street guides in the neighbourhood. */
  streetCount?: number | null;
}

/** The pre-MC-046 generator input. Accepted so the generators compile; never read. */
export interface HubMetaAggregates {
  typicalPrice: number | null;
  salesCount: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildHubMeta(
  name: string,
  facts: HubMetaFacts | HubMetaAggregates,
  profile: "urban" | "rural",
  // Optional per-hub SERP closer. Defaults to the corpus-wide clause; the Timberlea rewrite
  // (GSC 2026-07-18) supplies its own. Everything before it stays shared.
  closer = "a straight read on the neighbourhood",
): { metaTitle: string; metaDescription: string } {
  const surface = profile === "urban" ? "Street" : "Road";
  const walk = profile === "urban" ? "Street-by-street" : "Road-by-road";
  const metaTitle = `${name}, ${config.CITY_NAME}: Homes, Prices and ${surface} Guide`;

  const f: HubMetaFacts = "activeCount" in facts || "streetCount" in facts ? (facts as HubMetaFacts) : {};
  const active = typeof f.activeCount === "number" && f.activeCount > 0 ? f.activeCount : 0;
  const streets = typeof f.streetCount === "number" && f.streetCount > 0 ? f.streetCount : 0;
  const parts: string[] = [];
  if (active > 0) parts.push(`${plural(active, "home", "homes")} for sale today`);
  if (streets > 0) parts.push(plural(streets, `${surface.toLowerCase()} guide`, `${surface.toLowerCase()} guides`));

  const metaDescription = parts.length
    ? `${name}, ${config.CITY_NAME}: ${parts.join(" and ")}. ${walk} guide, live listings, and ${closer}.`
    : `${name}, ${config.CITY_NAME}: live listings and the ${walk.toLowerCase()} read.`;

  return { metaTitle, metaDescription };
}
