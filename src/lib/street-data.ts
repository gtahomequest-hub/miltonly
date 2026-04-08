import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

export interface StreetPageData {
  slug: string;
  streetName: string;
  neighbourhoods: string[];
  // Hero stats
  avgSoldPrice: number;
  avgListPrice: number;
  medianPrice: number;
  totalSold12mo: number;
  activeCount: number;
  rentedCount: number;
  avgDOM: number;
  soldVsAskPct: number;
  // By type
  byType: Record<string, { count: number; avgPrice: number; activeCount: number }>;
  // Listings
  activeListings: unknown[];
  soldListings: unknown[];
  allListings: unknown[];
  // Price distribution
  priceDistribution: { range: string; count: number; pct: number }[];
  // DOM distribution
  domDistribution: { range: string; count: number; pct: number }[];
  // Over/under asking
  overUnderAsking: { aboveCount: number; atCount: number; belowCount: number; totalSold: number; avgOverPct: number };
  // Nearby streets
  nearbyStreets: { slug: string; name: string; avgPrice: number; count: number }[];
  // Last updated
  lastUpdated: string;
}

function extractStreetName(address: string): string {
  return address
    .replace(/^\d+\s*/, "")
    .replace(/,\s*Milton.*$/i, "")
    .replace(/,\s*ON.*$/i, "")
    .replace(/\s+\d+\s*,.*$/, "")
    .replace(/\s+Unit.*$/i, "")
    .trim();
}

export const getStreetPageData = unstable_cache(
  async (slug: string): Promise<StreetPageData | null> => {
    const allListings = await prisma.listing.findMany({
      where: { streetSlug: slug },
      orderBy: { listedAt: "desc" },
    });

    if (allListings.length === 0) return null;

    const active = allListings.filter((l) => l.status === "active");
    const sold = allListings.filter((l) => l.status === "sold");
    const rented = allListings.filter((l) => l.status === "rented");
    const streetName = extractStreetName(allListings[0].address);
    const neighbourhoods = Array.from(new Set(allListings.map((l) => l.neighbourhood)));

    // Prices
    const allPrices = allListings.map((l) => l.price).sort((a, b) => a - b);
    const avgListPrice = active.length > 0
      ? Math.round(active.reduce((s, l) => s + l.price, 0) / active.length) : 0;
    const soldPrices = sold.map((l) => l.soldPrice || l.price).sort((a, b) => a - b);
    const avgSoldPrice = sold.length > 0
      ? Math.round(soldPrices.reduce((s, p) => s + p, 0) / soldPrices.length)
      : Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length);
    const medianPrice = allPrices.length > 0 ? allPrices[Math.floor(allPrices.length / 2)] : 0;

    // DOM
    const withDOM = allListings.filter((l) => l.daysOnMarket && l.daysOnMarket > 0);
    const avgDOM = withDOM.length > 0
      ? Math.round(withDOM.reduce((s, l) => s + (l.daysOnMarket || 0), 0) / withDOM.length) : 0;

    // Sold vs ask
    const soldWithBoth = sold.filter((l) => l.soldPrice && l.price > 0);
    let soldVsAskPct = 100;
    if (soldWithBoth.length > 0) {
      soldVsAskPct = Math.round(
        soldWithBoth.reduce((s, l) => s + (l.soldPrice! / l.price) * 100, 0) / soldWithBoth.length
      );
    }

    // By type
    const types = ["detached", "semi", "townhouse", "condo", "other"];
    const byType: StreetPageData["byType"] = {};
    for (const t of types) {
      const ofType = allListings.filter((l) => l.propertyType === t);
      if (ofType.length > 0) {
        byType[t] = {
          count: ofType.length,
          avgPrice: Math.round(ofType.reduce((s, l) => s + l.price, 0) / ofType.length),
          activeCount: ofType.filter((l) => l.status === "active").length,
        };
      }
    }

    // Price distribution
    const buckets = [
      { range: "Under $500K", min: 0, max: 500000 },
      { range: "$500K–$700K", min: 500000, max: 700000 },
      { range: "$700K–$1M", min: 700000, max: 1000000 },
      { range: "$1M–$1.5M", min: 1000000, max: 1500000 },
      { range: "Over $1.5M", min: 1500000, max: Infinity },
    ];
    const priceDistribution = buckets.map((b) => {
      const count = allListings.filter((l) => l.price >= b.min && l.price < b.max).length;
      return { range: b.range, count, pct: allListings.length > 0 ? Math.round((count / allListings.length) * 100) : 0 };
    });

    // DOM distribution
    const domBuckets = [
      { range: "< 7 days", min: 0, max: 7 },
      { range: "7–14 days", min: 7, max: 14 },
      { range: "14–30 days", min: 14, max: 30 },
      { range: "30+ days", min: 30, max: Infinity },
    ];
    const domDistribution = domBuckets.map((b) => {
      const count = withDOM.filter((l) => (l.daysOnMarket || 0) >= b.min && (l.daysOnMarket || 0) < b.max).length;
      return { range: b.range, count, pct: withDOM.length > 0 ? Math.round((count / withDOM.length) * 100) : 0 };
    });

    // Over/under asking
    const aboveCount = soldWithBoth.filter((l) => l.soldPrice! > l.price).length;
    const belowCount = soldWithBoth.filter((l) => l.soldPrice! < l.price).length;
    const atCount = soldWithBoth.length - aboveCount - belowCount;
    const avgOverPct = soldVsAskPct - 100;

    // Nearby streets
    const nearbyRaw = await prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: true,
      _avg: { price: true },
      where: {
        neighbourhood: { in: neighbourhoods },
        streetSlug: { not: slug },
      },
      orderBy: { _count: { streetSlug: "desc" } },
      take: 6,
    });

    const nearbyStreets = await Promise.all(
      nearbyRaw.map(async (s) => {
        const sample = await prisma.listing.findFirst({
          where: { streetSlug: s.streetSlug },
          select: { address: true },
        });
        return {
          slug: s.streetSlug,
          name: extractStreetName(sample?.address || s.streetSlug),
          avgPrice: Math.round(s._avg.price || 0),
          count: s._count,
        };
      })
    );

    return {
      slug,
      streetName,
      neighbourhoods,
      avgSoldPrice,
      avgListPrice,
      medianPrice,
      totalSold12mo: sold.length,
      activeCount: active.length,
      rentedCount: rented.length,
      avgDOM,
      soldVsAskPct,
      byType,
      activeListings: active as never[],
      soldListings: sold as never[],
      allListings: allListings as never[],
      priceDistribution,
      domDistribution,
      overUnderAsking: { aboveCount, atCount, belowCount, totalSold: soldWithBoth.length, avgOverPct },
      nearbyStreets,
      lastUpdated: new Date().toISOString().split("T")[0],
    };
  },
  ["street-page-data"],
  { revalidate: 3600 }
);
