// src/lib/ai/neighbourhoodLookup.ts
//
// Block C — Pass 1 — Track 2 two-block content architecture.
//
// Fetches neighbourhood-comparable stats from DB3 (analytics.neighbourhood_sold_stats)
// for use in the neighbourhoodComparable section. Returns null when:
//   - DB3 client unavailable / read fails
//   - No row exists for the neighbourhood
//   - The street's dominant property type's column is null (DB3 enforced k-anon)
//   - sold_count_12months < 5 (below thin threshold)
//
// DB3 schema constraint (Pass 1):
//   Sale-side prices are segmented by property TYPE only.
//   Bedroom dimension exists only on lease columns (avg_leased_price_<N>bed).
//   Pass 1 returns `filterByBedroomCount: null` for this reason.
//   Block D (deferred) extends DB3 with bedroom-segmented sold columns.
//
// "Whole-nbhd" fallback is NOT implemented in Pass 1 — there's no aggregate
// "avg sold across all types" column. Falling back to a different type column
// (e.g. semi-detached avg when detached null) would mix populations and lie
// about the comparable. Returns null instead.
//
// Pass 1 nullable fields documented in types/street-generator.ts:
//   - filterByBedroomCount, mostRecentSoldAt, priceRange  → always null
//   - typicalSoldPrice, daysOnMarket, priceChangeYoy, soldToAsk → from DB3

import type { StreetGeneratorInput } from "@/types/street-generator";

type NeighbourhoodComparable = NonNullable<StreetGeneratorInput["neighbourhoodComparable"]>;

// Property-type → DB3 column. Handles both "town" and "townhouse" as inputs.
const TYPE_TO_COLUMN: Record<string, "avg_sold_detached" | "avg_sold_semi" | "avg_sold_town" | "avg_sold_condo"> = {
  detached:  "avg_sold_detached",
  semi:      "avg_sold_semi",
  town:      "avg_sold_town",
  townhouse: "avg_sold_town",
  condo:     "avg_sold_condo",
};

interface Db3Row {
  neighbourhood: string;
  avg_sold_detached: string | null;
  avg_sold_semi: string | null;
  avg_sold_town: string | null;
  avg_sold_condo: string | null;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
  sold_count_12months: number;
  price_change_yoy: string | null;
}

function deriveKAnonLevel(count: number): "full" | "thin" | "zero" {
  if (count >= 10) return "full";
  if (count >= 5)  return "thin";
  return "zero";
}

function parseNumeric(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function parseNumericRounded(value: string | null): number | null {
  const n = parseNumeric(value);
  return n !== null ? Math.round(n) : null;
}
export async function getNeighbourhoodComparable(
  neighbourhood: string,
  dominantPropertyType: string,
): Promise<NeighbourhoodComparable | null> {
  // Empty/invalid inputs — bail early.
  if (!neighbourhood || !dominantPropertyType) return null;

  const column = TYPE_TO_COLUMN[dominantPropertyType.toLowerCase()];
  if (!column) {
    // Property type not in our DB3 mapping — return null rather than guess.
    return null;
  }

  let rows: Db3Row[] = [];
  try {
    const { getAnalyticsDb } = await import("@/lib/db");
    const ad = getAnalyticsDb();
    if (!ad) return null;

    rows = await (ad`
      SELECT
        neighbourhood,
        avg_sold_detached,
        avg_sold_semi,
        avg_sold_town,
        avg_sold_condo,
        avg_dom,
        avg_sold_to_ask,
        COALESCE(sold_count_12months, 0) AS sold_count_12months,
        price_change_yoy
      FROM analytics.neighbourhood_sold_stats
      WHERE neighbourhood = ${neighbourhood}
      LIMIT 1
    ` as unknown as Promise<Db3Row[]>);
  } catch {
    // DB3 unreachable — return null, caller treats as "no neighbourhood data."
    return null;
  }

  if (rows.length === 0) return null;
  const row = rows[0];

  // k-anonymity gate on the aggregate count.
  const sampleSize = Number(row.sold_count_12months) || 0;
  if (sampleSize < 5) return null;

  // Pull the type-specific average. Null means DB3 already suppressed it for
  // per-type k-anon — return null rather than falling back to a different type.
  const typicalSoldPrice = parseNumeric(row[column]);
  if (typicalSoldPrice === null) return null;

  // Clean display form (batch-002 fix, 2026-07-20): the raw DB3 string
  // ("1027 - CL Clarke") was reaching the prompt verbatim and the model
  // published it ("Across 1027 - CL Clarke, comparable homes..."). Strip the
  // MLS district prefix; fall back to the raw value if cleaning empties it.
  const { cleanNeighbourhoodName } = await import("@/lib/format");
  const cleanedNeighbourhood =
    cleanNeighbourhoodName(row.neighbourhood).replace(/^\s*\d+\s*-\s*/, "").trim() ||
    row.neighbourhood;

  return {
    neighbourhood: cleanedNeighbourhood,
    filterByPropertyType: dominantPropertyType.toLowerCase(),
    filterByBedroomCount: null,                            // Pass 1: deferred to Block D
    fallbackApplied: "type-only",                          // Pass 1 always type-only
    sampleSize,                                            // neighbourhood total, all types
    windowMonths: 12,
    mostRecentSoldAt: null,                                // Pass 1: deferred to Pass 2
    typicalSoldPrice: Math.round(typicalSoldPrice),
    priceRange: null,                                      // Pass 1: deferred to Pass 2
   daysOnMarket: parseNumericRounded(row.avg_dom),
    priceChangeYoy: parseNumeric(row.price_change_yoy),
    soldToAsk: parseNumeric(row.avg_sold_to_ask),
    kAnonLevel: deriveKAnonLevel(sampleSize),
  };
}