// Phase 4.1 Step 5 — Input payload builder for the street description generator.
//
// Maps raw DB1/DB2/DB3 data into the StreetGeneratorInput shape the model
// consumes. Called by the spot-check script (Step 4.1.8) and the backfill
// (Step 4.1.9). Never called at page-render time.
//
// K-anonymity gates applied per field (suppression produces null, not 0):
//   - aggregates.typicalPrice        — null if salesCount < 5
//   - aggregates.priceRange          — null if salesCount < 10
//   - byType[k].typicalPrice         — null if salesForType < 5
//   - byType[k].priceRange           — null if salesForType < 10
//   - quarterlyTrend                 — omitted if salesCount < 5
//
// Fields omitted per kickoff (no pipeline source, do not fabricate):
//   - primaryBuilder   (remarks-scan pipeline not yet built)
//   - dominantStyle    (not aggregated in DB)
//   - lotSize          (not aggregated in DB)
//
// Fields populated from hardcoded reference data (geo.ts / schools.ts):
//   - nearby.*         (Milton POIs + school coords where on file)
//   - commute.*        (4 fixed drive destinations + Toronto via GO formula)

// Server-scoped by construction: uses Prisma + Neon serverless HTTP clients,
// neither of which work in a browser bundle. Not using the `server-only`
// package as a guard because it throws in Node-script test contexts
// (tsx / npx) and is redundant with the runtime failure surface anyway.

import type { Listing } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getAnalyticsDb, getSoldDb } from "@/lib/db";
import {
  expandStreetName,
  shortNameFor,
  monthlyToQuarterly,
  resolveSiblingSlugs,
  type RawMonthly,
} from "@/lib/street-data";
import { deriveIdentity, registeredDirectionsFor, type Direction } from "@/lib/streetUtils";
import { cleanNeighbourhoodName, roundPriceForProse } from "@/lib/format";
import { formatCADShort } from "@/lib/charts/theme";
import {
  haversineKm,
  driveMinutes,
  walkMinutes,
  hasValidCoords,
  GROCERIES,
  MOSQUES,
  PARKS,
  HIGHWAY_ONRAMPS,
  HOSPITAL,
  GO_STATION,
  COMMUTE_FIXED,
  GO_TRAIN_MINUTES,
  UNION_TO_DOWNTOWN_TTC_MINUTES,
  NEIGHBOURHOOD_CENTROIDS,
  type POI,
} from "@/lib/geo";
import { schools } from "@/lib/schools";
import { extractStreetName, ruralSideRoadName } from "@/lib/streetUtils";
import { NoCentroidError } from "@/lib/ai/errors";
import { getNeighbourhoodComparable } from "@/lib/ai/neighbourhoodLookup";
import type { StreetGeneratorInput } from "@/types/street-generator";

// K-anonymity thresholds. Parallel to the same constants in street-data.ts.
const K_ANON_PRICE = 5;
const K_ANON_RANGE = 10;

// ---------------------------------------------------------------------------
// Raw DB row shapes (kept local; not re-exported to avoid cross-module coupling)
// ---------------------------------------------------------------------------

interface RawSoldStats {
  sold_count_12months: number;
  leased_count_12months: number;
  avg_sold_price: string | null;
  avg_dom: string | null;
}

interface RawTypeAgg {
  property_type: string;
  n: number;
  avg_price: string | null;
  min_price: string | null;
  max_price: string | null;
}

interface RawLeaseByBed {
  bed: number | string;
  n: number;
  typical: string | null;
}

// Per-row lease record for sample-based grounded content (Part 4, 2026-05-09).
// Pulled from DB2 sold.sold_records; cap=10 most-recent in 12mo window.
interface RawLeaseRecord {
  mls_number: string;
  address: string;
  list_price: string | null;
  sold_price: string | null;
  beds: number | null;
  baths: string | null;
  sqft_range: string | null;
  days_on_market: number | null;
  property_type: string | null;
  sold_date: Date;
  lease_term: string | null;
  furnished: string | null;
}

interface RawRangeRow {
  n: number;
  lo: string | null;
  hi: string | null;
  // Workstream 2 / Step 5 (2026-05-28): extend the live For-Sale aggregate
  // query to also return AVG(sold_price) and AVG(days_on_market). Prior
  // code pulled these from analytics.street_sold_stats which can be stale
  // relative to the live sold.sold_records table — observed on
  // centennial-forest-drive-milton where analytics said sold_count=10 but
  // the live query returns 9. The mismatch caused priceRange=null when the
  // analytics-reported salesCount was 10 (k threshold met by analytics,
  // but the live MIN/MAX query found only 9 rows so the range was
  // suppressed). Sourcing all sales-side aggregates from the SAME live
  // query guarantees salesCount, typicalPrice, priceRange, and
  // daysOnMarket are mutually consistent.
  avg_price: string | null;
  avg_dom: string | null;
}

interface RawCrossCandidate {
  street_slug: string;
  avg_sold_price: string | null;
}

interface RawCrossDominantType {
  street_slug: string;
  property_type: string;
  n: number;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function buildGeneratorInput(slug: string): Promise<StreetGeneratorInput> {
  // Step 13m-1 — resolve sibling slugs that map to the same identity. All
  // DB2/DB3/DB1 queries that used to filter by `street_slug = slug` now
  // filter by `street_slug IN (siblingSlugs)` so the generator sees
  // per-identity data rather than per-slug data fragmented across
  // abbreviation/direction variants.
  const siblingSlugs = await resolveSiblingSlugs(slug);

  // Parallel fetch — all per-identity queries go in one round-trip batch.
  const [
    allListings,
    streetContent,
    soldStatsRows,
    monthlyRows,
    soldSalesByType,
    soldLeasesByType,
    leasesByBed,
    leasesPerRow,
    soldRangeRows,
    soldCoordsRows,
    soldNeighbourhoodRows,
    crossCandidates,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: { streetSlug: { in: siblingSlugs }, permAdvertise: true },
      orderBy: { listedAt: "desc" },
    }),
    prisma.streetContent.findFirst({ where: { streetSlug: { in: siblingSlugs } } }),
    queryAnalytics<RawSoldStats>(
      (db) => db`SELECT sold_count_12months, leased_count_12months, avg_sold_price, avg_dom
                 FROM analytics.street_sold_stats WHERE street_slug = ANY(${siblingSlugs}::text[])
                 ORDER BY sold_count_12months DESC NULLS LAST LIMIT 1`
    ),
    queryAnalytics<RawMonthly>(
      (db) => db`SELECT year, month, avg_sold_price, sold_count, avg_dom, avg_sold_to_ask
                 FROM analytics.street_monthly_stats WHERE street_slug = ANY(${siblingSlugs}::text[])
                 ORDER BY year, month`
    ),
    querySold<RawTypeAgg>(
      (db) => db`SELECT property_type,
                         COUNT(*)::int AS n,
                         AVG(sold_price) AS avg_price,
                         MIN(sold_price) AS min_price,
                         MAX(sold_price) AS max_price
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND perm_advertise = TRUE
                    AND transaction_type = 'For Sale'
                    AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt
                  GROUP BY property_type`
    ),
    querySold<RawTypeAgg>(
      (db) => db`SELECT property_type,
                         COUNT(*)::int AS n,
                         AVG(sold_price) AS avg_price,
                         MIN(sold_price) AS min_price,
                         MAX(sold_price) AS max_price
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND perm_advertise = TRUE
                    AND transaction_type = 'For Lease'
                    AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt
                  GROUP BY property_type`
    ),
    querySold<RawLeaseByBed>(
      (db) => db`SELECT COALESCE(beds, 0)::int AS bed,
                         COUNT(*)::int AS n,
                         AVG(sold_price) AS typical
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND perm_advertise = TRUE
                    AND transaction_type = 'For Lease'
                    AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt
                  GROUP BY bed
                  ORDER BY bed`
    ),
    // Per-row recent lease records (Part 4, 2026-05-09). Cap=10 most-recent
    // in 12mo window. Feeds buildLeaseSampleRecords which applies k-anon
    // gating before exposing to the prompt input.
    querySold<RawLeaseRecord>(
      (db) => db`SELECT mls_number, address, list_price, sold_price,
                        beds, baths, sqft_range, days_on_market,
                        property_type, sold_date, lease_term, furnished
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND perm_advertise = TRUE
                    AND transaction_type = 'For Lease'
                    AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt
                  ORDER BY sold_date DESC
                  LIMIT 10`
    ),
    querySold<RawRangeRow>(
      (db) => db`SELECT COUNT(*)::int AS n,
                         MIN(sold_price) AS lo,
                         MAX(sold_price) AS hi,
                         AVG(sold_price) AS avg_price,
                         AVG(days_on_market) AS avg_dom
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND perm_advertise = TRUE
                    AND transaction_type = 'For Sale'
                    AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt`
    ),
    querySold<{ lat: string | null; lng: string | null }>(
      (db) => db`SELECT lat, lng FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND lat IS NOT NULL AND lng IS NOT NULL
                  LIMIT 1`
    ),
    // Neighbourhood fallback: streets with no current DB1 active listings
    // (expired / sold-only) still have neighbourhood strings on their DB2
    // historical records. Pull the top 3 most-common neighbourhood values
    // across all sibling variants.
    querySold<{ neighbourhood: string }>(
      (db) => db`SELECT neighbourhood
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                  GROUP BY neighbourhood
                  ORDER BY COUNT(*) DESC
                  LIMIT 3`
    ),
    // Comparison-street candidates: all k≥5 streets town-wide. GEOGRAPHIC
    // scoping happens in buildCrossStreets (batch-001 fix, 2026-07-19):
    // candidates are filtered to the subject's own neighbourhood(s) plus
    // centroid-adjacent ones before ranking. Exclude all siblings of this
    // identity so a comparison suggestion never points back at itself.
    queryAnalytics<RawCrossCandidate>(
      (db) => db`SELECT street_slug, avg_sold_price
                 FROM analytics.street_sold_stats
                 WHERE sold_count_12months >= ${K_ANON_PRICE}
                   AND avg_sold_price IS NOT NULL
                   AND street_slug <> ALL(${siblingSlugs}::text[])`
    ),
  ]);

  // ─── Street identity ────────────────────────────────────────────────
  const sample = allListings[0];
  // Step 13h — rural-address exception (see src/lib/streetUtils.ts).
  const rawName =
    ruralSideRoadName(slug) ??
    streetContent?.streetName ??
    sample?.streetName ??
    extractStreetName(sample?.address ?? deslugify(slug));
  // Chain order matters: expand first, then strip the suffix from the expanded
  // form so shortNameFor's STREET_SUFFIXES set sees canonical tokens instead
  // of abbreviated variants. Prevents "Aird Crt" slipping into input.street.shortName.
  const streetName = expandStreetName(rawName);
  const shortName = shortNameFor(streetName);
  const type = deriveStreetType(streetName);
  // Step 13m-1 identity metadata.
  const identity = deriveIdentity(slug);
  const identityKey = identity?.identityKey ?? `${slug}|`;
  const direction: Direction = (identity?.direction ?? "") as Direction;
  // Per-direction stats for dual-column candidate identities. Populated only
  // when the identity's (base, suffix) is a REGISTERED_DIRECTIONS entry per
  // the Milton Street Directory. All direction slugs for the identity merge
  // at identity time; this query splits them back out by looking at each
  // sibling slug's own direction (parsed from the slug), since MLS
  // raw_vow_data->>'StreetDirection' is nearly always null in DB2.
  const registeredDirs = identity
    ? registeredDirectionsFor(identity.base, identity.suffixCanonical)
    : null;
  const __sd = getSoldDb();
  const perSlugStatsRaw = registeredDirs && __sd
    ? await (__sd`
        SELECT street_slug,
               COUNT(*) FILTER (WHERE transaction_type='For Sale')::int AS n_sales,
               AVG(sold_price) FILTER (WHERE transaction_type='For Sale') AS avg_sale,
               MIN(sold_price) FILTER (WHERE transaction_type='For Sale') AS min_sale,
               MAX(sold_price) FILTER (WHERE transaction_type='For Sale') AS max_sale,
               MODE() WITHIN GROUP (ORDER BY property_type) FILTER (WHERE transaction_type='For Sale') AS dominant_type
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt
          GROUP BY street_slug
      ` as unknown as Promise<Array<{ street_slug: string; n_sales: number; avg_sale: string | null; min_sale: string | null; max_sale: string | null; dominant_type: string | null }>>).catch(() => [])
    : [];
  // Aggregate per-slug stats into per-direction buckets. Each sibling slug's
  // direction comes from deriveIdentity(slug).direction (slug-level metadata).
  const perDir = new Map<Direction, { n_sales: number; sum_avg: number; min_sale: number | null; max_sale: number | null; types: Map<string, number> }>();
  for (const row of perSlugStatsRaw) {
    const dir = (deriveIdentity(row.street_slug)?.direction ?? "") as Direction;
    if (!registeredDirs!.has(dir)) continue;
    if (row.n_sales === 0) continue;
    if (!perDir.has(dir)) perDir.set(dir, { n_sales: 0, sum_avg: 0, min_sale: null, max_sale: null, types: new Map() });
    const bucket = perDir.get(dir)!;
    bucket.n_sales += row.n_sales;
    if (row.avg_sale != null) bucket.sum_avg += Number(row.avg_sale) * row.n_sales;
    if (row.min_sale != null) {
      const lo = Number(row.min_sale);
      bucket.min_sale = bucket.min_sale == null ? lo : Math.min(bucket.min_sale, lo);
    }
    if (row.max_sale != null) {
      const hi = Number(row.max_sale);
      bucket.max_sale = bucket.max_sale == null ? hi : Math.max(bucket.max_sale, hi);
    }
    if (row.dominant_type) {
      bucket.types.set(row.dominant_type, (bucket.types.get(row.dominant_type) ?? 0) + row.n_sales);
    }
  }
  const directionalStats = Array.from(perDir.entries()).map(([direction, b]) => {
    const weightedAvg = b.n_sales > 0 ? Math.round(b.sum_avg / b.n_sales) : null;
    const lo = b.min_sale != null ? Math.round(b.min_sale) : null;
    const hi = b.max_sale != null ? Math.round(b.max_sale) : null;
    let dominant: string | undefined;
    let dominantN = 0;
    for (const [t, n] of Array.from(b.types.entries())) {
      if (n > dominantN) { dominant = t; dominantN = n; }
    }
    return {
      direction,
      salesCount: b.n_sales,
      typicalPrice: weightedAvg && b.n_sales >= K_ANON_PRICE ? weightedAvg : null,
      priceRange: lo != null && hi != null && b.n_sales >= K_ANON_RANGE
        ? { low: lo, high: hi }
        : null,
      dominantType: dominant,
    };
  });
  let neighbourhoods = dedupe(
    allListings
      .map((l) => cleanNeighbourhoodName(l.neighbourhood))
      .filter((n) => n.length > 0)
  );
  // Fallback: if DB1 yields no neighbourhoods (no current active listings),
  // derive from DB2 sold_records via the top-N most-common neighbourhood
  // values. Keeps identity coverage for streets whose inventory has cleared.
  // DB2 strings may use a format cleanNeighbourhoodName misses ("1051 - Walker",
  // no 2-letter code after the numeric prefix); strip any remaining "NNN - "
  // leading pattern locally. Flagged as a cleanNeighbourhoodName regex gap in
  // format.ts — fix deferred to a Phase 4.1 follow-up to avoid scope creep.
  if (neighbourhoods.length === 0 && soldNeighbourhoodRows.length > 0) {
    neighbourhoods = dedupe(
      soldNeighbourhoodRows
        .map((r) => stripLeadingCodePrefix(cleanNeighbourhoodName(r.neighbourhood)))
        .filter((n) => n.length > 0)
    );
  }

  // ─── Centroid (DB1 listings → DB2 sold sample → neighbourhood lookup) ─
  // Primary: per-listing lat/lng (DB1 or DB2). Currently 0% populated across
  // all of Milton; kept in place so future coord enrichment lifts straight in.
  // Fallback: the street's dominant neighbourhood string → hardcoded
  // NEIGHBOURHOOD_CENTROIDS lookup. If neither resolves, throw NoCentroidError.
  const centroid = resolveCentroid(
    slug,
    allListings,
    soldCoordsRows[0] ?? null,
    neighbourhoods,
    soldNeighbourhoodRows,
  );

  // ─── Aggregates ─────────────────────────────────────────────────────
  // Workstream 2 / Step 5 (2026-05-28): sales-side aggregates now come
  // from the LIVE sold.sold_records range query (soldRangeRows) so that
  // salesCount, typicalPrice, priceRange, and daysOnMarket are mutually
  // consistent. analytics.street_sold_stats can be stale (centennial
  // example: analytics=10 but live=9), creating a k-threshold mismatch
  // where salesCount advertised k>=10 but priceRange's MIN/MAX query
  // found <10 rows and suppressed itself. leasesCount stays sourced from
  // analytics because no live "For Lease" count is in soldRangeRows.
  const stats = soldStatsRows[0] ?? null;
  const rangeRow = soldRangeRows[0] ?? null;
  const salesCount = rangeRow?.n ?? 0;
  const leasesCount = stats?.leased_count_12months ?? 0;
  const txCount = salesCount + leasesCount;

  const typicalRaw = num(rangeRow?.avg_price ?? null);
  const typicalPrice = salesCount >= K_ANON_PRICE && typicalRaw !== null ? typicalRaw : null;

  const loRaw = num(rangeRow?.lo ?? null);
  const hiRaw = num(rangeRow?.hi ?? null);
  const priceRange =
    rangeRow && rangeRow.n >= K_ANON_RANGE && loRaw !== null && hiRaw !== null
      ? { low: loRaw, high: hiRaw }
      : null;

  const domRaw = num(rangeRow?.avg_dom ?? null);
  // D3 ruling (2026-07-20, batch-003 gate): a DOM "average" below n=5 is a
  // single-digit-sample artifact published as a statistic. Suppress like the
  // k-anon price gates — null means the prompt/validator/meta all omit it.
  const daysOnMarket =
    domRaw !== null && salesCount >= K_ANON_PRICE ? Math.round(domRaw) : null;

  const kAnonLevel: "full" | "thin" | "zero" =
    txCount === 0 ? "zero" : salesCount >= K_ANON_PRICE ? "full" : "thin";

  // ─── byType (union of sales + leases + active-listing types) ────────
  const byType = buildByType(soldSalesByType, soldLeasesByType, allListings);
// ─── neighbourhoodComparable (Track 2 Pass 1 — Block C lookup) ──────
  // Sequential after byType so dominantPropertyType is derivable. One extra
  // DB3 round-trip outside the parallel batch above; ~50-100ms cost.
  const neighbourhoodComparable = await resolveNeighbourhoodComparable(
    allListings,
    soldNeighbourhoodRows,
    byType,
  );
  // ─── leaseActivity.byBed (optional) ─────────────────────────────────
  const leaseActivity = buildLeaseActivity(leasesByBed, leasesCount);

  // ─── leaseActivity.recentRecords + rangeStats (Part 4, k-anon gated) ─
  const sampleResult = buildLeaseSampleRecords(leasesPerRow, leasesCount);
  if (leaseActivity && sampleResult?.recentRecords) {
    leaseActivity.recentRecords = sampleResult.recentRecords;
  }
  if (leaseActivity && sampleResult?.rangeStats) {
    leaseActivity.rangeStats = sampleResult.rangeStats;
  }

  // ─── Coverage instrumentation (Part 4 step 6.5) ─────────────────────
  // Side-effect log for empirical k-anon coverage measurement. Failure to
  // write here MUST NOT block generation — fire-and-forget try/catch.
  void recordLeaseCoverage(slug, leasesCount, sampleResult).catch((e) =>
    console.warn(`[lease-coverage-log] write failed for ${slug}: ${(e as Error).message}`),
  );

  // ─── quarterlyTrend (optional; k-anon gated) ────────────────────────
  // Track 2 Pass 1 — DEC-PASS1-QUARTERTREND-FILTER (2026-05-27).
  // Single-trade quarters (count=1) are anchoring landmines: the model
  // narrates outlier prices ("high-$1Ms", "softened to $X") that can never
  // round-trip through the validator's ±4% tolerance, causing 5-attempt
  // retry storms (aird-court, derry-road in the 11-street batch). Filter
  // count=1 out of trend input so the model can only narrate multi-trade
  // signal. Validator stays consistent — both sides see the same filtered
  // trend. Streets with no count>=2 quarters fall back to undefined and
  // the prompt's no-trend path triggers naturally.
  // B13 (docs/tickets/monthly-to-quarter-future-labels.md, 2026-07-20): a
  // quarter that has not ENDED as of generation time must never reach the
  // prompt as a trend point — the model narrates trend input as completed
  // history ("climbing to $984,500 in Q3 2026" written 18 days into Q3).
  // Filtered here at the consumption seam so the render-side quarterly
  // charts (which may legitimately show quarter-to-date bars) are untouched.
  const quarterlyTrend =
    salesCount >= K_ANON_PRICE
      ? dropUnfinishedQuarters(
          monthlyToQuarterly(monthlyRows).map((q) => ({
            quarter: q.quarter,
            typical: q.value,
            count: q.count,
          })),
        ).filter((q) => q.count >= 2)
      : undefined;

  // ─── nearby (parks, schools, mosques, grocery, hospital, GO, highway) ─
  const nearby = buildNearby(centroid);

  // ─── commute (5 fixed destinations) ─────────────────────────────────
  const commute = buildCommute(centroid);

  // ─── activeListingsCount ────────────────────────────────────────────
  const activeListingsCount = allListings.filter((l) => l.status === "active").length;

  // ─── crossStreets (comparison streets, neighbourhood-scoped; see helper)
  const crossStreets = await buildCrossStreets(
    typicalRaw,
    crossCandidates,
    siblingSlugs,
    collectSubjectNeighbourhoodStrings(allListings, soldNeighbourhoodRows),
    centroid,
  );

  // ─── Compose output. primaryBuilder / dominantStyle / lotSize omitted
  //     because no pipeline source exists yet — absent rather than fabricated.
  const input: StreetGeneratorInput = {
    street: {
      name: streetName,
      slug,
      shortName,
      type,
      identityKey,
      siblingSlugs,
      direction,
    },
    neighbourhoods,
    aggregates: {
      // txCount (sales + leases blended) removed from the payload 2026-07-19
      // (batch-001 fix): exposing a pre-blended pool count legitimized "N
      // total transactions" claims via the numeric-grounding whitelist. It is
      // still computed locally above for kAnonLevel derivation.
      salesCount,
      leasesCount,
      typicalPrice,
      priceRange,
      daysOnMarket,
      kAnonLevel,
    },
    byType,
    nearby,
    commute,
    activeListingsCount,
    crossStreets,
  };
  // directionalStats only populated on multi-sibling identities with ≥1
  // per-direction bucket carrying real sales. Omitted otherwise so single-
  // direction pages don't carry an empty field.
  if (directionalStats.length > 1) input.directionalStats = directionalStats;
  if (leaseActivity) input.leaseActivity = leaseActivity;
  if (quarterlyTrend && quarterlyTrend.length > 0) input.quarterlyTrend = quarterlyTrend;
 if (neighbourhoodComparable) input.neighbourhoodComparable = neighbourhoodComparable;
  return input;
}

// ---------------------------------------------------------------------------
// DB query helpers — wrap Neon's typing quirks + handle errors uniformly.
// ---------------------------------------------------------------------------

type SqlClient = NonNullable<ReturnType<typeof getAnalyticsDb>>;

function queryAnalytics<T>(build: (db: SqlClient) => unknown): Promise<T[]> {
  const ad = getAnalyticsDb();
  if (!ad) return Promise.resolve([] as T[]);
  return (build(ad) as Promise<T[]>).catch(() => [] as T[]);
}
function querySold<T>(build: (db: SqlClient) => unknown): Promise<T[]> {
  const sd = getSoldDb();
  if (!sd) return Promise.resolve([] as T[]);
  return (build(sd) as Promise<T[]>).catch(() => [] as T[]);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function dedupe<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }

/** Strip a leading "NNN - " numeric-code pattern that cleanNeighbourhoodName
 *  in format.ts currently misses (its regex requires a 2-4 letter code after
 *  the dash; real data has formats like "1051 - Walker" with no middle code). */
function stripLeadingCodePrefix(s: string): string {
  return s.replace(/^\s*\d+\s*-\s*/, "").trim();
}

function deslugify(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === config.SLUG_SUFFIX) {
    parts.pop();
  }
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Recognised street-type suffixes (long forms only — expandStreetName has
// already expanded any abbreviations in streetName before we see it).
const STREET_TYPES = new Set([
  "avenue", "street", "road", "drive", "court", "crescent", "boulevard",
  "lane", "way", "place", "trail", "line", "circle", "terrace",
  "heights", "gate", "common", "park", "ridge", "grove", "close", "walk", "hill",
  "highway",
]);

/** Walk tokens left-to-right; the last token that matches STREET_TYPES
 *  is the street's type. "Main Street East" → "street" (not "east"). */
function deriveStreetType(streetName: string): string {
  const tokens = streetName.split(/\s+/).filter(Boolean);
  let found: string | null = null;
  for (const tok of tokens) {
    const key = tok.toLowerCase().replace(/\.$/, "");
    if (STREET_TYPES.has(key)) found = key;
  }
  return found ?? "street";
}

function resolveCentroid(
  slug: string,
  listings: Listing[],
  soldCoord: { lat: string | null; lng: string | null } | null,
  cleanedNeighbourhoods: string[],
  rawSoldNeighbourhoods: Array<{ neighbourhood: string }>,
): { lat: number; lng: number } {
  // 1. Per-listing coords from DB1 (preferred; future-proof if a geocoder runs).
  const valid = listings.filter((l) => hasValidCoords(l.latitude, l.longitude));
  if (valid.length > 0) {
    const lat = valid.reduce((s, l) => s + l.latitude, 0) / valid.length;
    const lng = valid.reduce((s, l) => s + l.longitude, 0) / valid.length;
    return { lat, lng };
  }
  // 2. Per-listing coords from DB2 (future-proof; currently 0% populated).
  const lat = num(soldCoord?.lat ?? null);
  const lng = num(soldCoord?.lng ?? null);
  if (lat !== null && lng !== null && hasValidCoords(lat, lng)) {
    return { lat, lng };
  }
  // 3. Neighbourhood centroid lookup. Try the DB1/DB2 RAW neighbourhood
  //    strings first (NEIGHBOURHOOD_CENTROIDS is keyed by raw TREB form), then
  //    fall back to cleaned neighbourhoods as a last resort in case a raw-form
  //    lookup misses but the cleaned value happens to match.
  const dominantRaw = pickDominantNeighbourhood(listings, rawSoldNeighbourhoods);
  if (dominantRaw && NEIGHBOURHOOD_CENTROIDS[dominantRaw]) {
    return NEIGHBOURHOOD_CENTROIDS[dominantRaw];
  }
  for (const n of cleanedNeighbourhoods) {
    if (NEIGHBOURHOOD_CENTROIDS[n]) return NEIGHBOURHOOD_CENTROIDS[n];
  }
  const reason = dominantRaw
    ? `no NEIGHBOURHOOD_CENTROIDS match for "${dominantRaw}"`
    : `no listings and no DB2 sold records with a neighbourhood string`;
  throw new NoCentroidError(slug, reason);
}

function pickDominantNeighbourhood(
  listings: Listing[],
  soldRows: Array<{ neighbourhood: string }>,
): string | null {
  const counts: Record<string, number> = {};
  for (const l of listings) {
    if (l.neighbourhood) counts[l.neighbourhood] = (counts[l.neighbourhood] ?? 0) + 1;
  }
  // DB2 rows are already ordered by frequency DESC (see query); only fall back
  // to them if DB1 is empty.
  if (Object.keys(counts).length === 0) {
    for (const r of soldRows) {
      if (r.neighbourhood) return r.neighbourhood;
    }
    return null;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}
function pickDominantPropertyType(byType: StreetGeneratorInput["byType"]): string | null {
  let dominant: string | null = null;
  let dominantCount = 0;
  for (const [type, data] of Object.entries(byType)) {
    if (data.count > dominantCount) {
      dominantCount = data.count;
      dominant = type;
    }
  }
  return dominant;
}

async function resolveNeighbourhoodComparable(
  listings: Listing[],
  soldRows: Array<{ neighbourhood: string }>,
  byType: StreetGeneratorInput["byType"],
): Promise<StreetGeneratorInput["neighbourhoodComparable"]> {
  const rawNeighbourhood = pickDominantNeighbourhood(listings, soldRows);
  if (!rawNeighbourhood) return undefined;

  const dominantType = pickDominantPropertyType(byType);
  if (!dominantType) return undefined;

  const result = await getNeighbourhoodComparable(rawNeighbourhood, dominantType);
  return result ?? undefined;
}
// ---------------------------------------------------------------------------
// byType — union of sales + leases + active-listing types with count rule:
//   count = salesForType > 0 ? salesForType : leasesForType
// (matches examples A/B/C: sales-dominant streets use sale counts; lease-only
// streets use lease counts; zero-data streets report 0 on active-only types)
// ---------------------------------------------------------------------------

function buildByType(
  sales: RawTypeAgg[],
  leases: RawTypeAgg[],
  allListings: Listing[],
): StreetGeneratorInput["byType"] {
  const keys = new Set<string>();
  sales.forEach((t) => keys.add(t.property_type));
  leases.forEach((t) => keys.add(t.property_type));
  allListings
    .filter((l) => l.status === "active")
    .forEach((l) => keys.add(l.propertyType));

  const out: StreetGeneratorInput["byType"] = {};
  for (const key of Array.from(keys)) {
    const saleAgg = sales.find((t) => t.property_type === key);
    const leaseAgg = leases.find((t) => t.property_type === key);
    const salesForType = saleAgg?.n ?? 0;
    const leasesForType = leaseAgg?.n ?? 0;
    const count = salesForType > 0 ? salesForType : leasesForType;

    const typicalRaw = num(saleAgg?.avg_price ?? null);
    const typicalPrice =
      salesForType >= K_ANON_PRICE && typicalRaw !== null ? typicalRaw : null;

    const lo = num(saleAgg?.min_price ?? null);
    const hi = num(saleAgg?.max_price ?? null);
    const priceRange =
      salesForType >= K_ANON_RANGE && lo !== null && hi !== null
        ? { low: lo, high: hi }
        : null;

    const kFlag: "full" | "thin" | "zero" =
      count === 0 ? "zero" : salesForType >= K_ANON_PRICE ? "full" : "thin";

    out[key] = { count, typicalPrice, priceRange, kFlag };
  }
  return out;
}

// ---------------------------------------------------------------------------
// leaseActivity — only populated if the street has any lease activity
// and per-bed data is available.
// ---------------------------------------------------------------------------

function buildLeaseActivity(
  rows: RawLeaseByBed[],
  leasesCount: number,
): StreetGeneratorInput["leaseActivity"] | undefined {
  if (leasesCount === 0 || rows.length === 0) return undefined;
  const byBed: Record<string, { count: number; typicalRent: number }> = {};
  for (const r of rows) {
    const typical = num(r.typical);
    // D3 ruling (2026-07-20): single-record per-bed rents suppressed — one
    // lease is an identifiable tenancy, not a "typical rent". n >= 2 required.
    if (r.n >= 2 && typical !== null) {
      const bedKey = String(r.bed ?? 0);
      byBed[bedKey] = { count: r.n, typicalRent: typical };
    }
  }
  if (Object.keys(byBed).length === 0) return undefined;
  return { byBed };
}

// ---------------------------------------------------------------------------
// PII redaction for lease-record addresses passed to the prompt.
// Strips trailing ", City, ON Postal" pattern + unit suffix. Keeps street
// number + street name. Per Part 4 spec (2026-05-09).
//
// Examples:
//   "830 Megson Terrace 622, Milton, ON L9T 9M7"  → "830 Megson Terrace"
//   "45 Main Street W, Milton, ON L9T 1A1"        → "45 Main Street W"
//   "12 Maple Ave Unit 5, Milton, ON L9T 4Z2"     → "12 Maple Ave"
// ---------------------------------------------------------------------------
export function redactAddressForPrompt(addr: string): string {
  if (!addr) return "";
  // Take only the first comma-separated segment (drops City/Province/Postal).
  let segment = addr.split(",")[0].trim();
  // Strip trailing "Unit N" / "Apt N" / "Suite N" / "# N" patterns.
  segment = segment.replace(/\s+(?:unit|apt|suite|#)\s*\S+\s*$/i, "");
  // Strip trailing bare unit number (1-4 digits at end, after street name).
  // Pattern: "830 Megson Terrace 622" → strip the "622". Look for word
  // boundary + 1-4 digits at end-of-string, but only if there's at least a
  // street name (1+ word) preceding the unit number — not the leading "830".
  segment = segment.replace(/\s+\d{1,4}\s*$/, (match, _offset, full) => {
    // Don't strip if the only digits are at position 0 (the street number).
    const remaining = full.slice(0, full.lastIndexOf(match));
    return /[a-zA-Z]/.test(remaining) ? "" : match;
  });
  return segment.trim();
}

// ---------------------------------------------------------------------------
// buildLeaseSampleRecords — assemble per-row records + range stats with
// k-anon gating (Part 4, 2026-05-09).
//
// Three-tier gate:
//   - count < 5  : return undefined (aggregation-only fallback preserves
//     existing behavior on thin streets)
//   - count 5-9  : return recentRecords only (no rangeStats; min/max
//     requires k≥10 per existing K_ANON_RANGE discipline)
//   - count ≥ 10 : return both recentRecords + rangeStats
// ---------------------------------------------------------------------------
function buildLeaseSampleRecords(
  rows: RawLeaseRecord[],
  leasesCount: number,
): {
  recentRecords?: NonNullable<StreetGeneratorInput["leaseActivity"]>["recentRecords"];
  rangeStats?: { min: number; max: number };
} | undefined {
  if (leasesCount < K_ANON_PRICE) return undefined;
  if (rows.length === 0) return undefined;

  const records = rows
    .map((r) => {
      const listPrice = num(r.list_price);
      const soldPrice = num(r.sold_price);
      if (listPrice === null || soldPrice === null) return null;
      const baths = num(r.baths);
      const sd = r.sold_date instanceof Date ? r.sold_date : new Date(r.sold_date);
      return {
        mlsNumber: r.mls_number,
        address: redactAddressForPrompt(r.address),
        listPrice,
        soldPrice,
        beds: r.beds ?? 0,
        baths: baths ?? 0,
        sqftRange: r.sqft_range,
        daysOnMarket: r.days_on_market ?? 0,
        propertyType: r.property_type ?? "Unknown",
        soldMonth: `${sd.getUTCFullYear()}-${String(sd.getUTCMonth() + 1).padStart(2, "0")}`,
        leaseTerm: r.lease_term,
        furnished: r.furnished,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (records.length === 0) return undefined;

  // rangeStats only when k≥10 (existing K_ANON_RANGE discipline applies).
  let rangeStats: { min: number; max: number } | undefined;
  if (leasesCount >= K_ANON_RANGE) {
    const prices = records.map((r) => r.soldPrice).sort((a, b) => a - b);
    if (prices.length > 0) {
      rangeStats = { min: prices[0], max: prices[prices.length - 1] };
    }
  }

  return { recentRecords: records, rangeStats };
}

// ---------------------------------------------------------------------------
// Coverage instrumentation (Part 4 step 6.5).
// Records per-street lease coverage as a side-effect of buildGeneratorInput
// so we can empirically measure k-anon gate fire rates after Part 4 ships.
// Table: analytics.street_lease_coverage_log — created via one-shot
// migration script (scripts/migrate-create-lease-coverage-log.ts).
//
// Append-only: each generation run writes a new row with recorded_at
// timestamp. Query latest state via DISTINCT ON (street_slug) ORDER BY
// recorded_at DESC.
// ---------------------------------------------------------------------------
async function recordLeaseCoverage(
  streetSlug: string,
  leasesCount12mo: number,
  sampleResult:
    | {
        recentRecords?: unknown;
        rangeStats?: { min: number; max: number };
      }
    | undefined,
): Promise<void> {
  const ad = getAnalyticsDb();
  if (!ad) return;
  const hasRecentRecords = !!sampleResult?.recentRecords;
  const hasRangeStats = !!sampleResult?.rangeStats;
  const fallbackReason = hasRecentRecords
    ? null
    : leasesCount12mo < K_ANON_PRICE
      ? "below_k5"
      : "k_met_but_no_records"; // edge: k satisfied but per-row query returned 0
  await ad`
    INSERT INTO analytics.street_lease_coverage_log
      (street_slug, lease_count_12mo, has_recent_records, has_range_stats, fallback_reason, recorded_at)
    VALUES (${streetSlug}, ${leasesCount12mo}, ${hasRecentRecords}, ${hasRangeStats}, ${fallbackReason}, NOW())
  `;
}

// ---------------------------------------------------------------------------
// nearby — real haversine from centroid for every POI with known coords.
// Schools without hardcoded coords return distanceMin: null (honest signal,
// never synthetic).
// ---------------------------------------------------------------------------

function buildNearby(
  centroid: { lat: number; lng: number },
): StreetGeneratorInput["nearby"] {
  const c = centroid;

  const parksOut = PARKS.map((p) => {
    const km = haversineKm(c.lat, c.lng, p.lat, p.lng);
    const walkMin = walkMinutes(km);
    return {
      name: p.name,
      distanceMin: walkMin <= 20 ? walkMin : driveMinutes(km),
      walkable: walkMin <= 15, // ≤ 1.25 km roughly
    };
  })
    .sort((a, b) => a.distanceMin - b.distanceMin)
    .slice(0, 5);

  const schoolsWithCoords = schools.filter((s): s is typeof s & { lat: number; lng: number } =>
    typeof s.lat === "number" && typeof s.lng === "number"
  );
  const schoolsAll = schools.map((s) => {
    if (typeof s.lat === "number" && typeof s.lng === "number") {
      const km = haversineKm(c.lat, c.lng, s.lat, s.lng);
      const min = km < 1.5 ? walkMinutes(km) : driveMinutes(km);
      return { name: s.name, level: s.level, board: s.boardName, distanceMin: min, _board: s.board };
    }
    return { name: s.name, level: s.level, board: s.boardName, distanceMin: null, _board: s.board };
  });

  const nearestSchools = schoolsAll
    .slice() // copy
    .sort((a, b) => (a.distanceMin ?? Infinity) - (b.distanceMin ?? Infinity));

  const schoolsPublic = nearestSchools
    .filter((s) => s._board === "public")
    .slice(0, 4)
    .map(({ name, level, board, distanceMin }) => ({ name, level, board, distanceMin }));
  const schoolsCatholic = nearestSchools
    .filter((s) => s._board === "catholic")
    .slice(0, 4)
    .map(({ name, level, board, distanceMin }) => ({ name, level, board, distanceMin }));

  // Use the nearest school by REAL distance to help the generator if it wants
  // to mention the catchment. If we have zero schools with coords, all
  // schoolsPublic.distanceMin will be null.
  void schoolsWithCoords; // silence lint; kept for potential future filtering.

  const mosquesOut = MOSQUES.map((m) => ({
    name: m.name,
    distanceMin: driveMinutes(haversineKm(c.lat, c.lng, m.lat, m.lng)),
  }))
    .sort((a, b) => a.distanceMin - b.distanceMin)
    .slice(0, 3);

  const groceryOut = GROCERIES.map((g) => ({
    name: g.name,
    distanceMin: driveMinutes(haversineKm(c.lat, c.lng, g.lat, g.lng)),
  }))
    .sort((a, b) => a.distanceMin - b.distanceMin)
    .slice(0, 4);

  const hospitalKm = haversineKm(c.lat, c.lng, HOSPITAL.lat, HOSPITAL.lng);
  const hospital = { name: HOSPITAL.name, distanceMin: driveMinutes(hospitalKm) };

  const goKm = haversineKm(c.lat, c.lng, GO_STATION.lat, GO_STATION.lng);
  const goStation = {
    name: GO_STATION.name,
    distanceMin: walkMinutes(goKm) <= 20 ? walkMinutes(goKm) : driveMinutes(goKm),
  };

  // Pick nearer of two 401 on-ramps.
  const nearestRamp = HIGHWAY_ONRAMPS.map((r) => ({
    ramp: r,
    km: haversineKm(c.lat, c.lng, r.lat, r.lng),
  })).sort((a, b) => a.km - b.km)[0];
  const highway = {
    name: nearestRamp.ramp.name,
    onrampDistanceMin: driveMinutes(nearestRamp.km),
  };

  return {
    parks: parksOut,
    schoolsPublic,
    schoolsCatholic,
    mosques: mosquesOut,
    grocery: groceryOut,
    hospital,
    goStation,
    highway,
  };
}

// ---------------------------------------------------------------------------
// commute — 4 fixed-drive destinations + Toronto downtown via GO/TTC formula.
// Toronto formula (per kickoff): toGOStationMinutes + GO_TRAIN_MINUTES (48) +
// UNION_TO_DOWNTOWN_TTC_MINUTES (12).
// ---------------------------------------------------------------------------

function buildCommute(
  centroid: { lat: number; lng: number },
): StreetGeneratorInput["commute"] {
  const c = centroid;
  const goKm = haversineKm(c.lat, c.lng, GO_STATION.lat, GO_STATION.lng);
  const goWalkMin = walkMinutes(goKm);
  const goDriveMin = driveMinutes(goKm);
  // Walk-to-GO if under ~15 min (≤ 1.25 km); else drive-to-GO.
  // TODO(Phase 4.4): at neighbourhood-centroid resolution, the 15-minute
  // street-level spread in toTorontoDowntown collapses to 2-4 min. Per-
  // street geocoding restores the real differentiation (the 67 / 82 gap
  // between walk-to-GO and drive-to-GO streets shown in the examples).
  const toGOMin = goWalkMin <= 15 ? goWalkMin : goDriveMin;
  const goMethod = goWalkMin <= 15 ? "GO+TTC (walk to GO)" : "GO+TTC (drive to GO)";

  const fixed = Object.fromEntries(
    COMMUTE_FIXED.map((d) => [d.label, { method: d.method, minutes: d.minutes }])
  ) as Record<
    "toMississauga" | "toOakville" | "toBurlington" | "toPearson",
    { method: string; minutes: number }
  >;

  return {
    toTorontoDowntown: {
      method: goMethod,
      minutes: toGOMin + GO_TRAIN_MINUTES + UNION_TO_DOWNTOWN_TTC_MINUTES,
    },
    toMississauga: fixed.toMississauga,
    toOakville: fixed.toOakville,
    toBurlington: fixed.toBurlington,
    toPearson: fixed.toPearson,
  };
}

// ---------------------------------------------------------------------------
// crossStreets — MARKET-COMPARISON streets, geographically scoped.
//
// Batch-001 root-cause fix (2026-07-19): the prior heuristic ranked ALL k≥5
// streets town-wide by LARGEST price delta, which deterministically selected
// the same extreme-priced outliers (Wettlaufer/Apple at the top, Martin/
// Millside at the bottom) as "alternatives" for nearly every mid-market
// street, across mutually exclusive neighbourhoods.
//
// New selection:
//   1. Allowed geography = the subject's own raw DB2/DB1 neighbourhood
//      strings, plus any NEIGHBOURHOOD_CENTROIDS entry within
//      ADJACENT_NEIGHBOURHOOD_KM of the subject centroid (adjacent-
//      neighbourhood tolerance).
//   2. Candidates (k≥5, town-wide) are kept only if DB2 shows sold records
//      for them inside the allowed geography.
//   3. Rank by SMALLEST absolute price delta ABOVE a minimum spread, take
//      top 2 (batch-002 fix, 2026-07-20). The prior largest-delta-first
//      ranking inside the geo set re-selected the same town-extreme streets
//      (Wettlaufer/Millside/Pringle) for most of urban Milton, because the
//      2km adjacency tolerance reaches several small neighbourhoods and the
//      extreme always wins a max-delta sort. Smallest-delta-above-spread
//      picks the NEAREST meaningfully different street instead: a real
//      alternative at a genuinely different price point, without
//      deterministic convergence on outliers.
//   4. No in-geography candidate above the spread → return []. The prompts'
//      empty-crossStreets path (qualitative alternatives, zero street names,
//      enforced by the invented_cross_street rule) handles suppression.
//
// The entries are COMPARISON streets, not physical connectors — the prompts
// and the adjacency_claim validator rule enforce that framing. Each entry
// also carries its OWN dominant DB2 neighbourhood (batch-002 fix) so prose
// location claims about a comparator are grounded in data, never inferred —
// enforced by the comparator_neighbourhood_claim validator rule.
// ---------------------------------------------------------------------------

const ADJACENT_NEIGHBOURHOOD_KM = 2.0;

// A comparator must differ from the subject by at least this much to count
// as "a different price point" — and among qualifying candidates the
// SMALLEST delta wins, so picks stay in the subject's own market tier.
const MIN_COMPARATOR_SPREAD_ABS = 75_000;
const MIN_COMPARATOR_SPREAD_PCT = 0.10;

/** B13 pure helper (exported for unit tests): keep only quarters that have
 *  fully ENDED as of `now`. Labels arrive in monthlyToQuarterly's
 *  "Q3 '26" form (4-digit years tolerated). Unparseable labels are dropped
 *  (fail-closed: never present an unknown period as history). */
export function dropUnfinishedQuarters<T extends { quarter: string }>(
  quarters: T[],
  now: Date = new Date(),
): T[] {
  return quarters.filter((q) => {
    const m = q.quarter.match(/Q([1-4])\s*'?(\d{2,4})/);
    if (!m) return false;
    const qn = parseInt(m[1], 10);
    let year = parseInt(m[2], 10);
    if (year < 100) year += 2000;
    // Start of the NEXT quarter (UTC). The quarter has ended iff that
    // instant is not in the future.
    const nextQuarterStart =
      qn === 4
        ? Date.UTC(year + 1, 0, 1)
        : Date.UTC(year, qn * 3, 1);
    return nextQuarterStart <= now.getTime();
  });
}

/** Pure ranking helper (exported for unit tests): candidates with
 *  |price - subjectPrice| >= max($75K, 10% of subject), sorted by smallest
 *  delta first, top 2. */
export function rankComparatorCandidates(
  subjectPrice: number,
  candidates: Array<{ slug: string; price: number }>,
): Array<{ slug: string; price: number; delta: number }> {
  const minSpread = Math.max(
    MIN_COMPARATOR_SPREAD_ABS,
    subjectPrice * MIN_COMPARATOR_SPREAD_PCT,
  );
  return candidates
    .map((c) => ({ ...c, delta: Math.abs(c.price - subjectPrice) }))
    .filter((c) => c.delta >= minSpread)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2);
}

function collectSubjectNeighbourhoodStrings(
  listings: Listing[],
  soldRows: Array<{ neighbourhood: string }>,
): string[] {
  const out = new Set<string>();
  for (const l of listings) if (l.neighbourhood) out.add(l.neighbourhood);
  for (const r of soldRows) if (r.neighbourhood) out.add(r.neighbourhood);
  return Array.from(out);
}

async function buildCrossStreets(
  subjectPrice: number | null,
  candidates: RawCrossCandidate[],
  siblingSlugs: string[],
  subjectNeighbourhoods: string[],
  centroid: { lat: number; lng: number },
): Promise<StreetGeneratorInput["crossStreets"]> {
  if (subjectPrice === null || candidates.length === 0) return [];
  if (subjectNeighbourhoods.length === 0) return [];

  // Allowed geography: subject's raw neighbourhood strings + centroid-adjacent
  // neighbourhoods (NEIGHBOURHOOD_CENTROIDS is keyed by raw TREB form, the
  // same form DB2 sold_records.neighbourhood carries).
  const allowed = new Set<string>(subjectNeighbourhoods);
  for (const [name, c] of Object.entries(NEIGHBOURHOOD_CENTROIDS)) {
    if (haversineKm(centroid.lat, centroid.lng, c.lat, c.lng) <= ADJACENT_NEIGHBOURHOOD_KM) {
      allowed.add(name);
    }
  }
  const allowedNames = Array.from(allowed);

  // Batch-002 N6: pull the FULL neighbourhood distribution for every
  // candidate that touches the allowed geography, so we can (a) exclude
  // multi-neighbourhood arterials (Fourth Line: Bowes 9 / Beaty 8 / rural 6 —
  // a poor "street" comparator whose label is ambiguous) and (b) verify the
  // candidate's DOMINANT neighbourhood centroid is genuinely near the subject
  // (belt over the string-set filter that admitted a 5.5km comparator).
  const inGeoRows = await querySold<{ street_slug: string; neighbourhood: string; n: number }>(
    (db) => db`SELECT street_slug, neighbourhood, COUNT(*)::int AS n
               FROM sold.sold_records
               WHERE street_slug IN (
                 SELECT DISTINCT street_slug FROM sold.sold_records
                 WHERE neighbourhood = ANY(${allowedNames}::text[])
               )
                 AND street_slug <> ALL(${siblingSlugs}::text[])
               GROUP BY street_slug, neighbourhood`
  );
  const DOMINANT_SHARE_MIN = 0.7;
  const bySlug = new Map<string, Array<{ neighbourhood: string; n: number }>>();
  for (const r of inGeoRows) {
    (bySlug.get(r.street_slug) ?? bySlug.set(r.street_slug, []).get(r.street_slug)!)
      .push({ neighbourhood: r.neighbourhood, n: r.n });
  }
  const inGeo = new Set<string>();
  for (const [candSlug, rows] of Array.from(bySlug.entries())) {
    const total = rows.reduce((s, r) => s + r.n, 0);
    const dominant = rows.slice().sort((a, b) => b.n - a.n)[0];
    if (total === 0 || dominant.n / total < DOMINANT_SHARE_MIN) continue; // arterial / split identity
    if (!allowed.has(dominant.neighbourhood)) continue; // dominant must be in-geography, not a minority overlap
    const dc = NEIGHBOURHOOD_CENTROIDS[dominant.neighbourhood];
    if (dc && haversineKm(centroid.lat, centroid.lng, dc.lat, dc.lng) > ADJACENT_NEIGHBOURHOOD_KM) continue;
    inGeo.add(candSlug);
  }
  if (inGeo.size === 0) return [];

  const inGeoCandidates = candidates
    .filter((c) => inGeo.has(c.street_slug))
    .map((c) => ({ slug: c.street_slug, price: num(c.avg_sold_price) }))
    .filter((c): c is { slug: string; price: number } => c.price !== null);
  const ranked = rankComparatorCandidates(subjectPrice, inGeoCandidates);

  if (ranked.length === 0) return [];

  const picks = ranked.map((r) => r.slug);
  const [dominantRows, comparatorNbhdRows] = await Promise.all([
    querySold<RawCrossDominantType>(
      (db) => db`SELECT street_slug, property_type, COUNT(*)::int AS n
                 FROM sold.sold_records
                 WHERE street_slug = ANY(${picks})
                   AND perm_advertise = TRUE
                   AND transaction_type = 'For Sale'
                   AND sold_date >= NOW() - INTERVAL '12 months'
                    AND sold_date <= NOW() -- B13: future-dated rows never reach the prompt
                 GROUP BY street_slug, property_type`
    ),
    // Each comparator's OWN dominant neighbourhood string, so the prompt can
    // state its location from data instead of inferring it (batch-002 fix).
    querySold<{ street_slug: string; neighbourhood: string | null }>(
      (db) => db`SELECT street_slug,
                        MODE() WITHIN GROUP (ORDER BY neighbourhood) AS neighbourhood
                 FROM sold.sold_records
                 WHERE street_slug = ANY(${picks})
                   AND neighbourhood IS NOT NULL
                 GROUP BY street_slug`
    ),
  ]);
  const nbhdByStreet: Record<string, string> = {};
  for (const r of comparatorNbhdRows) {
    if (!r.neighbourhood) continue;
    const clean = stripLeadingCodePrefix(cleanNeighbourhoodName(r.neighbourhood));
    if (clean.length > 0) nbhdByStreet[r.street_slug] = clean;
  }

  const dominantByStreet: Record<string, string> = {};
  const grouped: Record<string, RawCrossDominantType[]> = {};
  for (const r of dominantRows) {
    (grouped[r.street_slug] ||= []).push(r);
  }
  for (const s of Object.keys(grouped)) {
    grouped[s].sort((a, b) => b.n - a.n);
    dominantByStreet[s] = grouped[s][0]?.property_type ?? "mixed";
  }

  return ranked.map((r) => {
    const dominantType = dominantByStreet[r.slug] ?? "mixed";
    const roundedPrice = formatCADShort(roundPriceForProse(r.price));
    const entry: StreetGeneratorInput["crossStreets"][number] = {
      slug: r.slug,
      shortName: shortNameFor(expandStreetName(deslugify(r.slug))),
      distinctivePattern: `${dominantType} trading around ${roundedPrice}`,
      typicalPrice: r.price,
    };
    // Only attach a neighbourhood when DB2 actually names one — the prompts
    // and comparator_neighbourhood_claim rule treat an absent field as
    // "no location claim permitted".
    if (nbhdByStreet[r.slug]) entry.neighbourhood = nbhdByStreet[r.slug];
    return entry;
  });
}

// Re-export POI so the type system lines up when someone wants to thread a
// different centroid source later; otherwise unused.
export type { POI };
