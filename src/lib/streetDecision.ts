import { prisma } from "@/lib/prisma";
import { calcMarketDataHash } from "@/lib/streetUtils";

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

export async function getStreetStats(streetSlug: string) {
  // Active listings only — DB1 sold-derived computation removed post Phase 2.6.
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

  if (activeListings.length === 0 && soldCount === 0) return null;

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
    dominantPropertyType,
    typeBreakdown,
    // Trend/price-direction data moved to DB3 (gated). AI content gets a
    // neutral placeholder so prompts remain stable.
    monthlyTrend: [] as Array<{ month: string; avgPrice: number; salesCount: number }>,
    priceDirection: "remained steady" as const,
    neighbourhood: sampleListing?.neighbourhood || "Milton",
    schoolZone: sampleListing?.schoolZone || null,
  };
}
