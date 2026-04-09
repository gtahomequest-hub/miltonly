import { prisma } from "@/lib/prisma";
import { calcMarketDataHash } from "@/lib/streetUtils";

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
  const soldCount = await prisma.listing.count({
    where: {
      streetSlug,
      status: "sold",
      soldDate: { gt: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000) }, // ~24 months
    },
  });
  const activeCount = await prisma.listing.count({
    where: { streetSlug, status: "active" },
  });

  if (soldCount < 3 && activeCount < 2) {
    await prisma.streetQueue.updateMany({
      where: { streetSlug },
      data: { status: "ineligible" },
    });
    console.log(`Ineligible: ${streetName} — only ${soldCount} sales in 24mo, ${activeCount} active`);
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

  if (currentHash === existing.marketDataHash) return "skip_current";

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (existing.generatedAt < thirtyDaysAgo) return "regenerate";

  return "skip_current";
}

export async function getStreetStats(streetSlug: string) {
  const soldListings = await prisma.listing.findMany({
    where: {
      streetSlug,
      status: "sold",
      soldDate: { gt: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) },
    },
    select: {
      soldPrice: true,
      price: true,
      daysOnMarket: true,
      propertyType: true,
      soldDate: true,
    },
  });

  if (soldListings.length === 0) return null;

  const soldPrices = soldListings.map((l) => l.soldPrice || l.price).filter(Boolean);
  const avgSoldPrice = soldPrices.length > 0
    ? Math.round(soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length)
    : 0;

  const sortedPrices = [...soldPrices].sort((a, b) => a - b);
  const medianSoldPrice = sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 0;

  const doms = soldListings.map((l) => l.daysOnMarket).filter((d): d is number => d !== null);
  const avgDOM = doms.length > 0
    ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length)
    : 0;

  // Sold vs ask percentage
  const ratios = soldListings
    .filter((l) => l.soldPrice && l.price && l.price > 0)
    .map((l) => ((l.soldPrice || 0) / l.price) * 100);
  const soldVsAskPct = ratios.length > 0
    ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 10) / 10
    : 100;

  // Property type breakdown
  const typeCounts: Record<string, number> = {};
  for (const l of soldListings) {
    typeCounts[l.propertyType] = (typeCounts[l.propertyType] || 0) + 1;
  }
  const typeBreakdown = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ propertyType: type, cnt: count }));
  const dominantPropertyType = typeBreakdown[0]?.propertyType || "detached";

  // Active listings
  const activeCount = await prisma.listing.count({
    where: { streetSlug, status: "active" },
  });

  // 6-month splits for price direction
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  const recent6mo = soldListings.filter((l) => l.soldDate && l.soldDate > sixMonthsAgo);
  const prior6mo = soldListings.filter((l) => l.soldDate && l.soldDate <= sixMonthsAgo);

  const avgSoldPrice6mo = recent6mo.length > 0
    ? Math.round(recent6mo.map((l) => l.soldPrice || l.price).reduce((a, b) => a + b, 0) / recent6mo.length)
    : null;
  const avgSoldPricePrior6mo = prior6mo.length > 0
    ? Math.round(prior6mo.map((l) => l.soldPrice || l.price).reduce((a, b) => a + b, 0) / prior6mo.length)
    : null;

  let priceDirection = "remained steady";
  if (avgSoldPrice6mo && avgSoldPricePrior6mo && avgSoldPricePrior6mo > 0) {
    const changePct = Math.round(((avgSoldPrice6mo - avgSoldPricePrior6mo) / avgSoldPricePrior6mo) * 100);
    if (changePct > 0) priceDirection = `risen ${changePct}% in the last 6 months`;
    else if (changePct < 0) priceDirection = `softened ${Math.abs(changePct)}% in the last 6 months`;
  }

  // Monthly trend (24 months)
  const soldAll24 = await prisma.listing.findMany({
    where: {
      streetSlug,
      status: "sold",
      soldDate: { gt: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000) },
    },
    select: { soldPrice: true, price: true, soldDate: true },
  });
  const monthlyMap = new Map<string, { total: number; count: number }>();
  for (const l of soldAll24) {
    if (!l.soldDate) continue;
    const key = `${l.soldDate.toLocaleString("en-US", { month: "short" })} ${l.soldDate.getFullYear()}`;
    const entry = monthlyMap.get(key) || { total: 0, count: 0 };
    entry.total += l.soldPrice || l.price;
    entry.count++;
    monthlyMap.set(key, entry);
  }
  const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    avgPrice: Math.round(data.total / data.count),
    salesCount: data.count,
  }));

  // Neighbourhood and school zone
  const sampleListing = await prisma.listing.findFirst({
    where: { streetSlug },
    select: { neighbourhood: true, schoolZone: true },
  });

  return {
    avgSoldPrice,
    medianSoldPrice,
    totalSold12mo: soldListings.length,
    avgDOM,
    soldVsAskPct,
    activeCount,
    dominantPropertyType,
    typeBreakdown,
    monthlyTrend,
    avgSoldPrice6mo,
    avgSoldPricePrior6mo,
    priceDirection,
    neighbourhood: sampleListing?.neighbourhood || "Milton",
    schoolZone: sampleListing?.schoolZone || null,
  };
}
