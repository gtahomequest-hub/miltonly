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
import { analyticsDb, soldDb } from "@/lib/db";
import {
  expandStreetName,
  shortNameFor,
  monthlyToQuarterly,
  resolveSiblingSlugs,
  type RawMonthly,
} from "@/lib/street-data";
import { deriveIdentity, type Direction } from "@/lib/streetUtils";
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

interface RawRangeRow {
  n: number;
  lo: string | null;
  hi: string | null;
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
                  GROUP BY bed
                  ORDER BY bed`
    ),
    querySold<RawRangeRow>(
      (db) => db`SELECT COUNT(*)::int AS n,
                         MIN(sold_price) AS lo,
                         MAX(sold_price) AS hi
                  FROM sold.sold_records
                  WHERE street_slug = ANY(${siblingSlugs}::text[])
                    AND perm_advertise = TRUE
                    AND transaction_type = 'For Sale'
                    AND sold_date >= NOW() - INTERVAL '12 months'`
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
    // TODO: real crossStreet selection heuristic is part of prospecting
    // intelligence layer; this is a Phase 4.1 fallback — pick top-2 by abs
    // typicalPrice delta from k≥5 streets. Exclude all siblings of this
    // identity so a cross-street suggestion never points back at itself.
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
  // Per-direction stats for dual-column candidate identities. We query DB2
  // with GROUP BY raw_vow_data->>'StreetDirection' scoped to this identity's
  // siblings. Each row becomes a DirectionalStats entry. Empty when the
  // identity has a single direction (or when no data is present per direction).
  const directionalStatsRaw = siblingSlugs.length > 1 && soldDb
    ? await (soldDb`
        SELECT UPPER(COALESCE(raw_vow_data->>'StreetDirection', '')) AS dir,
               COUNT(*) FILTER (WHERE transaction_type='For Sale')::int AS n_sales,
               AVG(sold_price) FILTER (WHERE transaction_type='For Sale') AS avg_sale,
               MIN(sold_price) FILTER (WHERE transaction_type='For Sale') AS min_sale,
               MAX(sold_price) FILTER (WHERE transaction_type='For Sale') AS max_sale,
               MODE() WITHIN GROUP (ORDER BY property_type) FILTER (WHERE transaction_type='For Sale') AS dominant_type
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND sold_date >= NOW() - INTERVAL '12 months'
          GROUP BY UPPER(COALESCE(raw_vow_data->>'StreetDirection', ''))
          ORDER BY dir
      ` as unknown as Promise<Array<{ dir: string; n_sales: number; avg_sale: string | null; min_sale: string | null; max_sale: string | null; dominant_type: string | null }>>).catch(() => [])
    : [];
  const VALID_DIRS = new Set<Direction>(["", "N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  const directionalStats = directionalStatsRaw
    .filter((r) => VALID_DIRS.has(r.dir as Direction) && r.n_sales > 0)
    .map((r) => {
      const avg = r.avg_sale != null ? Math.round(Number(r.avg_sale)) : null;
      const lo = r.min_sale != null ? Math.round(Number(r.min_sale)) : null;
      const hi = r.max_sale != null ? Math.round(Number(r.max_sale)) : null;
      return {
        direction: r.dir as Direction,
        salesCount: r.n_sales,
        typicalPrice: avg && r.n_sales >= K_ANON_PRICE ? avg : null,
        priceRange: lo != null && hi != null && r.n_sales >= K_ANON_RANGE
          ? { low: lo, high: hi }
          : null,
        dominantType: r.dominant_type ?? undefined,
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
  const stats = soldStatsRows[0] ?? null;
  const salesCount = stats?.sold_count_12months ?? 0;
  const leasesCount = stats?.leased_count_12months ?? 0;
  const txCount = salesCount + leasesCount;

  const typicalRaw = num(stats?.avg_sold_price ?? null);
  const typicalPrice = salesCount >= K_ANON_PRICE && typicalRaw !== null ? typicalRaw : null;

  const rangeRow = soldRangeRows[0] ?? null;
  const loRaw = num(rangeRow?.lo ?? null);
  const hiRaw = num(rangeRow?.hi ?? null);
  const priceRange =
    rangeRow && rangeRow.n >= K_ANON_RANGE && loRaw !== null && hiRaw !== null
      ? { low: loRaw, high: hiRaw }
      : null;

  const domRaw = num(stats?.avg_dom ?? null);
  const daysOnMarket = domRaw !== null ? Math.round(domRaw) : null;

  const kAnonLevel: "full" | "thin" | "zero" =
    txCount === 0 ? "zero" : salesCount >= K_ANON_PRICE ? "full" : "thin";

  // ─── byType (union of sales + leases + active-listing types) ────────
  const byType = buildByType(soldSalesByType, soldLeasesByType, allListings);

  // ─── leaseActivity.byBed (optional) ─────────────────────────────────
  const leaseActivity = buildLeaseActivity(leasesByBed, leasesCount);

  // ─── quarterlyTrend (optional; k-anon gated) ────────────────────────
  const quarterlyTrend =
    salesCount >= K_ANON_PRICE
      ? monthlyToQuarterly(monthlyRows).map((q) => ({
          quarter: q.quarter,
          typical: q.value,
          count: q.count,
        }))
      : undefined;

  // ─── nearby (parks, schools, mosques, grocery, hospital, GO, highway) ─
  const nearby = buildNearby(centroid);

  // ─── commute (5 fixed destinations) ─────────────────────────────────
  const commute = buildCommute(centroid);

  // ─── activeListingsCount ────────────────────────────────────────────
  const activeListingsCount = allListings.filter((l) => l.status === "active").length;

  // ─── crossStreets (2 picks via abs-delta; second query for dominant type)
  const crossStreets = await buildCrossStreets(slug, typicalRaw, crossCandidates);

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
      txCount,
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
  return input;
}

// ---------------------------------------------------------------------------
// DB query helpers — wrap Neon's typing quirks + handle errors uniformly.
// ---------------------------------------------------------------------------

type SqlClient = NonNullable<typeof analyticsDb>;

function queryAnalytics<T>(build: (db: SqlClient) => unknown): Promise<T[]> {
  if (!analyticsDb) return Promise.resolve([] as T[]);
  return (build(analyticsDb) as Promise<T[]>).catch(() => [] as T[]);
}
function querySold<T>(build: (db: SqlClient) => unknown): Promise<T[]> {
  if (!soldDb) return Promise.resolve([] as T[]);
  return (build(soldDb) as Promise<T[]>).catch(() => [] as T[]);
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
  if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === "milton") {
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
    if (r.n > 0 && typical !== null) {
      const bedKey = String(r.bed ?? 0);
      byBed[bedKey] = { count: r.n, typicalRent: typical };
    }
  }
  if (Object.keys(byBed).length === 0) return undefined;
  return { byBed };
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
// crossStreets — temporary Phase 4.1 heuristic.
// Pick top 2 from DB3 candidates by absolute typicalPrice delta, then run a
// single DB2 query across those 2 slugs to derive the dominant product type.
//
// TODO: real crossStreet selection heuristic is part of prospecting
// intelligence layer; this is a Phase 4.1 fallback.
// ---------------------------------------------------------------------------

async function buildCrossStreets(
  subjectSlug: string,
  subjectPrice: number | null,
  candidates: RawCrossCandidate[],
): Promise<StreetGeneratorInput["crossStreets"]> {
  if (subjectPrice === null || candidates.length === 0) return [];

  const ranked = candidates
    .map((c) => ({ slug: c.street_slug, price: num(c.avg_sold_price) }))
    .filter((c): c is { slug: string; price: number } => c.price !== null)
    .map((c) => ({ ...c, delta: Math.abs(c.price - subjectPrice) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);

  if (ranked.length === 0) return [];

  const picks = ranked.map((r) => r.slug);
  const dominantRows = await querySold<RawCrossDominantType>(
    (db) => db`SELECT street_slug, property_type, COUNT(*)::int AS n
               FROM sold.sold_records
               WHERE street_slug = ANY(${picks})
                 AND perm_advertise = TRUE
                 AND transaction_type = 'For Sale'
                 AND sold_date >= NOW() - INTERVAL '12 months'
               GROUP BY street_slug, property_type`
  );

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
    return {
      slug: r.slug,
      shortName: shortNameFor(expandStreetName(deslugify(r.slug))),
      distinctivePattern: `${dominantType} trading around ${roundedPrice}`,
      typicalPrice: r.price,
    };
  });
}

// Re-export POI so the type system lines up when someone wants to thread a
// different centroid source later; otherwise unused.
export type { POI };
