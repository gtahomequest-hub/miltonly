import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { calcMarketDataHash } from "@/lib/marketDataHash";

// Post Phase 2.6 (2026-04-17): this module's stats pipeline was restructured
// to stop reading DB1 sold-derived fields. DB1 no longer stores soldPrice or
// soldDate (see migrations/db1/2026-04-17-null-sold-fields.sql + DO-NOT-REPEAT.md).
// Historical sold-price intelligence lives exclusively in DB2 (sold schema)
// and is surfaced via gated DB2 fetchers in src/lib/sold-data.ts. This file
// now aggregates active-listing data only and carries a sold-count (status
// flip, not price-derived) for context. Field names match what they actually
// contain — no more avgSoldPrice labels on active-listing values.

export type StreetDecision =
  | "build"
  | "regenerate"
  | "skip_current"
  | "skip_low_data"
  | "skip_review";

export async function makeStreetDecision(
  streetSlug: string,
  streetName: string
): Promise<StreetDecision> {
  // ── MINIMUM DATA GATE ──
  // DB1 still carries status flips to "sold" even after soldDate nullification;
  // count them by status alone (no date filter — that field is always null now).
  const soldCount = await prisma.listing.count({
    where: {
      streetSlug,
      status: "sold",
    },
  });
  const activeCount = await prisma.listing.count({
    where: { streetSlug, status: "active" },
  });
  const totalListings = await prisma.listing.count({
    where: { streetSlug },
  });

  // Need at least 1 listing of any kind to build a page
  if (totalListings === 0 || (soldCount < 1 && activeCount < 1)) {
    await prisma.streetQueue.updateMany({
      where: { streetSlug },
      data: { status: "ineligible" },
    });
    console.log(`Ineligible: ${streetName} — ${soldCount} sold-status, ${activeCount} active`);
    return "skip_low_data";
  }

  // ── EXISTING PAGE CHECK ──
  const existing = await prisma.streetContent.findUnique({
    where: { streetSlug },
    select: {
      id: true,
      marketDataHash: true,
      generatedAt: true,
      needsReview: true,
      attempts: true,
    },
  });

  if (!existing) return "build";

  if (existing.needsReview && existing.attempts >= 3) return "skip_review";

  // ── STALENESS CHECK ──
  const stats = await getStreetStats(streetSlug);
  if (!stats) return "build";

  const currentHash = calcMarketDataHash(stats);

  // IMPORTANT: guard against null === null matching. A null stored hash means
  // "never generated" or "manually invalidated" — in both cases we must NOT skip.
  if (existing.marketDataHash !== null && currentHash === existing.marketDataHash) {
    return "skip_current";
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (existing.generatedAt < thirtyDaysAgo) return "regenerate";

  return "skip_current";
}

// ─── DEC-ZERO-SALES-TIER (2026-09-03) ────────────────────────────────────────
// The activity gate below used to read five sources, all of them "is this street
// live right now": DB1 active sale listings, DB1 sold-status flips, DB1 active
// leases, and DB3's two 12-month counts. DB2 — the table that actually holds the
// transaction record — was not one of them.
//
// The consequence was not a wrong number, it was a missing page. tasker-court-milton
// has four DB2 records (three For Sale, one For Lease), the most recent 2025-03-01,
// all outside the 12-month window. DB1 has no listing and DB3 has no row, so all
// five sources read zero, getStreetStats returned null, and generateStreetContent
// threw "No stats available" before buildGeneratorInput — which would have found
// those four rows — ever ran. A registry street with a real transaction history
// could not have a page purely because the history was old.
//
// The sixth source is EXISTENCE ONLY. It counts rows. It reads no price, applies
// no date window, and is never rendered — it decides whether a page may be built,
// nothing else. Every downstream k-anon gate is untouched: buildGeneratorInput
// still derives salesCount from the live 12-month range query, so a street that
// enters here with only pre-window history lands at kAnonLevel "zero" and renders
// at tier 'identity-only' or 'area-only' with typicalPrice, priceRange and
// daysOnMarket all null. Below k5 no price appears anywhere, which is the whole
// point: the street gets a page, not a number.
export interface StreetActivitySources {
  /** DB1 listings with status=active and permAdvertise */
  activeListingCount: number;
  /** DB1 listings with status=sold (a status flip; carries no price or date) */
  soldStatusCount: number;
  /** DB1 active listings with leaseStatus=active */
  activeLeaseCount: number;
  /** DB3 analytics.street_sold_stats.sold_count_12months */
  historicalSoldCount: number;
  /** DB3 analytics.street_sold_stats.leased_count_12months */
  historicalLeasedCount: number;
  /** DB2 sold.sold_records row count at ANY date, both transaction types. Existence only. */
  recordedTransactionCount: number;
}

/**
 * Pure activity predicate. Six sources, OR'd. Extracted from the inline gate so
 * the prebuild guard can assert it without a database.
 */
export function hasStreetActivity(s: StreetActivitySources): boolean {
  return (
    s.activeListingCount > 0 ||
    s.soldStatusCount > 0 ||
    s.activeLeaseCount > 0 ||
    s.historicalSoldCount > 0 ||
    s.historicalLeasedCount > 0 ||
    s.recordedTransactionCount > 0
  );
}

/**
 * DB2 existence probe for the sixth gate source. Unioned across sibling slugs for
 * the same reason every other DB2 read is: MLS ingest writes under whichever
 * abbreviation it produced, and a street whose record sits under a sibling slug is
 * no less real. COUNT(*) only — no sold_price, no sold_date, no window.
 * Returns 0 if DB2 is unreachable, keeping the gate exactly as permissive as it
 * was before this source existed.
 */
async function countRecordedTransactions(streetSlug: string): Promise<number> {
  try {
    const { getSoldDb } = await import("@/lib/db");
    const sd = getSoldDb();
    if (!sd) return 0;
    const { resolveSiblingSlugs } = await import("@/lib/street-data");
    const siblingSlugs = await resolveSiblingSlugs(streetSlug);
    const rows = await (sd`
      SELECT COUNT(*)::int AS n
      FROM sold.sold_records
      WHERE street_slug = ANY(${siblingSlugs}::text[])
        AND perm_advertise = TRUE
    ` as unknown as Promise<Array<{ n: number }>>);
    return Number(rows[0]?.n) || 0;
  } catch {
    // DB2 unreachable — fall back to the five-source gate.
    return 0;
  }
}

export async function getStreetStats(streetSlug: string) {
  // Active sale listings.
  const activeListings = await prisma.listing.findMany({
    where: { streetSlug, status: "active", permAdvertise: true },
    select: {
      price: true,
      propertyType: true,
      daysOnMarket: true,
    },
  });
  // Sold-status count (no price/date data — just a count for context).
  const soldCount = await prisma.listing.count({
    where: { streetSlug, status: "sold" },
  });
  // Active lease listings — rentals also signal an active market.
  const activeLeaseCount = await prisma.listing.count({
    where: { streetSlug, status: "active", permAdvertise: true, leaseStatus: "active" },
  });
  // DB3 historical signal — sold + leased counts in the last 12 months.
  // Reads analytics.street_sold_stats; falls back to 0 if DB3 unreachable or row absent.
  let historicalSoldCount = 0;
  let historicalLeasedCount = 0;
  try {
    const { getAnalyticsDb } = await import("@/lib/db");
    const ad = getAnalyticsDb();
    if (ad) {
      const rows = await (ad`
        SELECT
          COALESCE(sold_count_12months, 0)   AS sold_count,
          COALESCE(leased_count_12months, 0) AS leased_count
        FROM analytics.street_sold_stats
        WHERE street_slug = ${streetSlug}
        LIMIT 1
      ` as unknown as Promise<Array<{ sold_count: number; leased_count: number }>>);
      if (rows.length > 0) {
        historicalSoldCount = Number(rows[0].sold_count) || 0;
        historicalLeasedCount = Number(rows[0].leased_count) || 0;
      }
    }
  } catch {
    // DB3 read failed — fall back to DB1-only gate.
  }
  // DB2 existence signal — the sixth source (DEC-ZERO-SALES-TIER, 2026-09-03).
  const recordedTransactionCount = await countRecordedTransactions(streetSlug);
  // Gate: pass if ANY source has activity.
  if (
    !hasStreetActivity({
      activeListingCount: activeListings.length,
      soldStatusCount: soldCount,
      activeLeaseCount,
      historicalSoldCount,
      historicalLeasedCount,
      recordedTransactionCount,
    })
  ) {
    return null;
  }
  const priceSources = activeListings.map((l) => l.price).filter((p): p is number => !!p && p > 0);

  const avgListPrice = priceSources.length > 0
    ? Math.round(priceSources.reduce((a, b) => a + b, 0) / priceSources.length)
    : 0;

  const sortedPrices = [...priceSources].sort((a, b) => a - b);
  const medianListPrice = sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 0;

  const doms = activeListings
    .map((l) => l.daysOnMarket)
    .filter((d): d is number => d !== null && d > 0);
  const avgDOM = doms.length > 0
    ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length)
    : 0;

  // Property-type breakdown from active listings.
  const typeCounts: Record<string, number> = {};
  for (const l of activeListings) {
    typeCounts[l.propertyType] = (typeCounts[l.propertyType] || 0) + 1;
  }
  const typeBreakdown = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ propertyType: type, cnt: count }));
  const dominantPropertyType = typeBreakdown[0]?.propertyType || "detached";

  // Neighbourhood and school zone
  const sampleListing = await prisma.listing.findFirst({
    where: { streetSlug },
    select: { neighbourhood: true, schoolZone: true },
  });

  return {
    avgListPrice,
    medianListPrice,
    totalSold12mo: soldCount,   // status-flip count only — no price data
    avgDOM,
    activeCount: activeListings.length,
    activeLeaseCount,
    historicalSoldCount,
    historicalLeasedCount,
    dominantPropertyType,
    typeBreakdown,
    // Trend/price-direction data moved to DB3 (gated). AI content gets a
    // neutral placeholder so prompts remain stable.
    monthlyTrend: [] as Array<{ month: string; avgPrice: number; salesCount: number }>,
    priceDirection: "remained steady" as const,
    neighbourhood: sampleListing?.neighbourhood || config.CITY_NAME,
    schoolZone: sampleListing?.schoolZone || null,
  };
}
