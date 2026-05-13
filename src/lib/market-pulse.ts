// Aggregate-only "Milton market pulse" helper. Used by the /api/leads
// `market-pulse-unlock` branch (Commit 4j lead magnet) to compute a small
// stats packet for an anonymous visitor who has just submitted CASL consent.
//
// VOW COMPLIANCE — NON-NEGOTIABLE:
//   This module returns AGGREGATE statistics only (COUNT, AVG, MEDIAN,
//   PERCENTILE_CONT, MIN, MAX). It never returns individual sold-record
//   rows. The VOW gate in src/lib/sold-data.ts (canServeRecordsToThisRequest)
//   guards the RECORD fetchers — it does not apply to aggregate counts
//   (see the existing precedent in getMiltonSoldTotals, which calls
//   getSoldDb() for a COUNT-only query without VOW gate).
//
//   K-ANONYMITY enforced at the helper boundary:
//     - sold_count is always returned (a count alone is non-sensitive)
//     - dollar/ratio aggregates (avg, median, avg_dom, avg_sold_to_ask)
//       are returned only when sold_count >= MIN_K_TYPICAL (5).
//     - range fields (min, max) are returned only when
//       sold_count >= MIN_K_RANGE (10). Below that, a single low or
//       high point could be inferable from min/max alone.
//
//   Match-basis fallback chain ensures the helper returns useful stats
//   even when an exact propertyType+bedrooms slice is thin:
//     1. propertyType + same bedrooms + city, last 30 days
//     2. propertyType + bedrooms ±1 + city, last 30 days
//     3. propertyType + city, last 30 days (any bedrooms)
//   If all three slices yield < MIN_K_TYPICAL sales, the helper returns
//   a "no-match" packet with sold_count = the largest count tried and
//   match_basis describing the floor. The card component decides whether
//   to hide itself or render a "personalized report by email" fallback.

import "server-only";
import { requireSoldDb } from "./db";
import { cached, CACHE_TTL } from "./cache";

// k-anonymity thresholds. Locked per Senior 2026-05-13.
const MIN_K_TYPICAL = 5;
const MIN_K_RANGE = 10;

// Period window in days. Locked per spec — last 30 days.
const PERIOD_DAYS = 30;

// Sale transaction type. Sales-only — leases never enter market-pulse
// computation, even by accident.
const SALE_TX_TYPE = "For Sale";

export interface MarketPulseStats {
  /** Always populated. Count of matching sales in the window. */
  sold_count: number;
  /** Average sold price. Null when sold_count < MIN_K_TYPICAL. */
  avg_sold_price: number | null;
  /** Median sold price. Null when sold_count < MIN_K_TYPICAL. */
  median_sold_price: number | null;
  /** Average days on market. Null when sold_count < MIN_K_TYPICAL. */
  avg_dom: number | null;
  /** Average sold-to-ask ratio (0..1, e.g. 0.99 for 99%). Null below k. */
  avg_sold_to_ask: number | null;
  /** Lowest sold price in the window. Null when sold_count < MIN_K_RANGE. */
  min_sold_price: number | null;
  /** Highest sold price in the window. Null when sold_count < MIN_K_RANGE. */
  max_sold_price: number | null;
  /** Window in days the aggregate was computed over (always 30 for now). */
  period_days: number;
  /** Human-readable match-basis string describing the filter slice that
   *  yielded these stats. Examples:
   *    "milton_townhouse_4bed_30d"
   *    "milton_townhouse_3-5bed_30d"
   *    "milton_townhouse_any-bed_30d"
   *    "milton_townhouse_any-bed_30d_below_k" (no slice met k floor) */
  match_basis: string;
}

export interface MarketPulseInput {
  /** Property type slug ("detached" | "semi" | "townhouse" | "condo"). */
  propertyType: string;
  /** Bedrooms count on the originating listing. */
  bedrooms: number;
  /** City slug — matches Listing.city in the operational DB. */
  city: string;
}

/**
 * Raw aggregate query against sold.sold_records. Returns a single row of
 * computed aggregates for the given slice — no individual rows ever leave
 * this function. k-anonymity is applied AFTER the SQL aggregation here,
 * in TypeScript, so the helper boundary is the one source of truth.
 *
 * SQL safety:
 *   All values used in the query are interpolated via the neon tagged
 *   template — no string concatenation, no SQL injection surface.
 */
async function rawAggregate(
  propertyType: string,
  city: string,
  bedsLow: number,
  bedsHigh: number,
): Promise<{
  sold_count: number;
  avg_sold_price: number | null;
  median_sold_price: number | null;
  avg_dom: number | null;
  avg_sold_to_ask: number | null;
  min_sold_price: number | null;
  max_sold_price: number | null;
}> {
  const sold = requireSoldDb();
  const rows = (await sold`
    SELECT
      COUNT(*)::int                                                              AS sold_count,
      AVG(sold_price)::float                                                     AS avg_sold_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::float             AS median_sold_price,
      AVG(days_on_market)::float                                                 AS avg_dom,
      AVG(sold_to_ask_ratio)::float                                              AS avg_sold_to_ask,
      MIN(sold_price)::float                                                     AS min_sold_price,
      MAX(sold_price)::float                                                     AS max_sold_price
    FROM sold.sold_records
    WHERE city = ${city}
      AND property_type = ${propertyType}
      AND beds BETWEEN ${bedsLow} AND ${bedsHigh}
      AND transaction_type = ${SALE_TX_TYPE}
      AND perm_advertise = TRUE
      AND sold_date >= NOW() - (${PERIOD_DAYS} || ' days')::interval
  `) as Array<{
    sold_count: number;
    avg_sold_price: number | null;
    median_sold_price: number | null;
    avg_dom: number | null;
    avg_sold_to_ask: number | null;
    min_sold_price: number | null;
    max_sold_price: number | null;
  }>;
  const r = rows[0] ?? {
    sold_count: 0,
    avg_sold_price: null,
    median_sold_price: null,
    avg_dom: null,
    avg_sold_to_ask: null,
    min_sold_price: null,
    max_sold_price: null,
  };
  return r;
}

/**
 * Compute a public-safe market-pulse stats packet for the given filter slice.
 * Fallback chain widens the bedrooms window if the exact slice is thin.
 * Returns a stable shape — k-anonymity-masked fields are null, not missing.
 *
 * Cached for 6h under a (propertyType, bedrooms, city) key. Stats refresh
 * nightly via the sold-data sync, so 6h staleness is well within tolerance.
 */
export async function getMarketPulse(input: MarketPulseInput): Promise<MarketPulseStats> {
  const { propertyType, bedrooms, city } = input;
  const cityKey = city.toLowerCase();
  const ptKey = propertyType.toLowerCase();
  // Bedrooms are bucketed at the boundaries so a "4-bed" listing's first
  // try is exactly beds=4; the ±1 fallback widens to 3..5; the final
  // fallback drops the bedrooms filter entirely.
  return cached(
    `market-pulse:${cityKey}:${ptKey}:${bedrooms}:${PERIOD_DAYS}d`,
    CACHE_TTL.aggregate,
    async () => {
      const exactSlug = `${cityKey}_${ptKey}_${bedrooms}bed_${PERIOD_DAYS}d`;
      const wideSlug = `${cityKey}_${ptKey}_${Math.max(0, bedrooms - 1)}-${bedrooms + 1}bed_${PERIOD_DAYS}d`;
      const allSlug = `${cityKey}_${ptKey}_any-bed_${PERIOD_DAYS}d`;

      // Try exact first.
      let agg = await rawAggregate(propertyType, city, bedrooms, bedrooms);
      let basis = exactSlug;

      // Bedrooms ±1 widening if exact is below k.
      if (agg.sold_count < MIN_K_TYPICAL) {
        agg = await rawAggregate(propertyType, city, Math.max(0, bedrooms - 1), bedrooms + 1);
        basis = wideSlug;
      }
      // Drop bedrooms filter entirely if still below k.
      if (agg.sold_count < MIN_K_TYPICAL) {
        // bedrooms 0..99 covers any conceivable range without removing the
        // BETWEEN clause structure.
        agg = await rawAggregate(propertyType, city, 0, 99);
        basis = allSlug;
      }
      // If still below k after all fallbacks, mark the basis so the
      // caller can render a "personalized report by email" fallback UI.
      const belowK = agg.sold_count < MIN_K_TYPICAL;
      const finalBasis = belowK ? `${allSlug}_below_k` : basis;

      // K-anonymity gate — applied AFTER the SQL. Dollar/ratio aggregates
      // are gated at MIN_K_TYPICAL; range fields at MIN_K_RANGE.
      const passTypical = agg.sold_count >= MIN_K_TYPICAL;
      const passRange = agg.sold_count >= MIN_K_RANGE;

      return {
        sold_count: agg.sold_count,
        avg_sold_price: passTypical ? agg.avg_sold_price : null,
        median_sold_price: passTypical ? agg.median_sold_price : null,
        avg_dom: passTypical ? agg.avg_dom : null,
        avg_sold_to_ask: passTypical ? agg.avg_sold_to_ask : null,
        min_sold_price: passRange ? agg.min_sold_price : null,
        max_sold_price: passRange ? agg.max_sold_price : null,
        period_days: PERIOD_DAYS,
        match_basis: finalBasis,
      };
    },
  );
}
