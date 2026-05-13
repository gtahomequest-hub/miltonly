// "Milton market pulse" helper. Used by the /api/leads
// `market-pulse-unlock` branch (Commit 4j lead magnet) to compute a small
// stats packet for an anonymous visitor who has just submitted CASL consent.
//
// VOW COMPLIANCE — locked posture (Commit 4j-fix):
//   This module reads ONLY from the analytics schema via the blessed
//   getNeighbourhoodSaleStats() helper in src/lib/sold-data.ts. It does
//   NOT touch the raw VOW sold-records table directly. Phase 1 compliance review
//   specifically approved the analytics.neighbourhood_sold_stats path
//   (pre-computed nightly aggregate). Real-time aggregates against
//   the raw VOW sold-records table were not specifically reviewed, so this commit swaps
//   to the blessed pattern to eliminate audit exposure pre-ads-launch.
//
//   Defence-in-depth k-anonymity at this helper's boundary:
//     - sold_count always returned (a count alone is non-sensitive)
//     - rate aggregates (avg_dom, avg_sold_to_ask, market_score) returned
//       only when sold_count >= MIN_K_TYPICAL (5)
//     - min/max range fields permanently null — the blessed analytics row
//       does not expose them, and the spec's MIN_K_RANGE floor (10) is
//       moot here
//     - Dollar amounts (avg/median prices) intentionally NOT surfaced from
//       this helper. The per-property-type avg columns in the analytics
//       row don't carry per-property-type counts, so k-anonymity can't be
//       enforced per slice. Reverting to neighbourhood-wide non-dollar
//       aggregates is the audit-cleanest posture.

import "server-only";
import { getNeighbourhoodSaleStats } from "./sold-data";

// k-anonymity floor for rate-shaped aggregates. Locked per Senior.
const MIN_K_TYPICAL = 5;

// Window in days. Matches what the analytics compute job writes (90-day
// rolling stats column = `sold_count_90days`). Update both if ops policy
// shifts the window.
const PERIOD_DAYS = 90;

export interface MarketPulseStats {
  /** Always populated. Total sales in this neighbourhood over the period. */
  sold_count: number;
  /** Average sold price — intentionally null in this helper version (per
   *  Commit 4j-fix audit posture). Kept on the type so the client UI
   *  contract stays stable. */
  avg_sold_price: number | null;
  /** Median sold price — same null-by-design treatment as avg_sold_price. */
  median_sold_price: number | null;
  /** Average days on market. Null when sold_count < MIN_K_TYPICAL. */
  avg_dom: number | null;
  /** Average sold-to-ask ratio (0..1, e.g. 0.99 for 99%). Null below k. */
  avg_sold_to_ask: number | null;
  /** Neighbourhood market score (0-100, computed nightly with multi-input
   *  weighting — no single record exposed). Null below k. */
  market_score: number | null;
  /** Min/max range fields. Always null here — the blessed analytics row
   *  doesn't carry them. Kept on the type so the client UI contract is
   *  stable; the optional range row simply never renders. */
  min_sold_price: number | null;
  max_sold_price: number | null;
  /** Window in days the aggregate was computed over (always 90 now). */
  period_days: number;
  /** Human-readable match-basis string describing the analytics slice. */
  match_basis: string;
}

export interface MarketPulseInput {
  /** Property type slug — kept on the input for matchCriteria persistence
   *  + future per-type stat rollout. Not used in the current query (the
   *  blessed analytics row is neighbourhood-wide across all property
   *  types). */
  propertyType: string;
  /** Neighbourhood string — keyed exactly as it appears in
   *  analytics.neighbourhood_sold_stats. Same as the value sold-data
   *  uses (raw TREB neighbourhood string from the raw VOW sold-records table). */
  neighbourhood: string;
}

/**
 * Compute a public-safe market-pulse stats packet for the given neighbourhood.
 * Reads pre-computed aggregates from analytics.neighbourhood_sold_stats via
 * the blessed `getNeighbourhoodSaleStats()` helper. No queries against
 * the raw VOW sold-records table from this code path — that's the Commit 4j-fix swap.
 *
 * If the neighbourhood row is missing from analytics (e.g. neighbourhood
 * never had sales in the nightly window), returns a "below-k" packet with
 * sold_count=0 and all rate fields null. The caller renders a "personalized
 * report by email" fallback.
 */
export async function getMarketPulse(input: MarketPulseInput): Promise<MarketPulseStats> {
  // `propertyType` is part of the input contract for matchCriteria
  // persistence + future per-type rollout, but isn't used in the current
  // query (analytics row is per-neighbourhood across all property types).
  const nbhdKey = input.neighbourhood.trim();

  // sold-data's helper already caches under `nbhd-sale-stats:{neighbourhood}`,
  // so we don't add a second cache layer here — that would just double the
  // staleness without changing performance.
  const stats = await getNeighbourhoodSaleStats(nbhdKey);

  // No row in analytics for this neighbourhood → below-k packet.
  if (!stats) {
    return {
      sold_count: 0,
      avg_sold_price: null,
      median_sold_price: null,
      avg_dom: null,
      avg_sold_to_ask: null,
      market_score: null,
      min_sold_price: null,
      max_sold_price: null,
      period_days: PERIOD_DAYS,
      match_basis: `${nbhdKey}_no_analytics_row_below_k`,
    };
  }

  const passTypical = stats.sold_count_90days >= MIN_K_TYPICAL;
  const basis = `${nbhdKey} · all properties · ${PERIOD_DAYS}d`;
  const finalBasis = passTypical ? basis : `${basis}_below_k`;

  return {
    sold_count: stats.sold_count_90days,
    // Dollar amounts intentionally null — see header comment for rationale.
    avg_sold_price: null,
    median_sold_price: null,
    avg_dom: passTypical ? stats.avg_dom : null,
    avg_sold_to_ask: passTypical ? stats.avg_sold_to_ask : null,
    market_score: passTypical ? stats.market_score : null,
    min_sold_price: null,
    max_sold_price: null,
    period_days: PERIOD_DAYS,
    match_basis: finalBasis,
  };
}
