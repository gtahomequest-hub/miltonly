import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { unstable_cache } from "next/cache";

// Revalidate every hour
const CACHE_TTL = 3600;

export const getHeroStats = unstable_cache(
  async () => {
    const [
      allActive,
      detachedStats,
      semiStats,
      condoStats,
      rentalStats,
    ] = await Promise.all([
      prisma.listing.count({ where: { status: "active", price: { gt: 100000 }, city: config.PRISMA_CITY_VALUE, permAdvertise: true } }),
      prisma.listing.aggregate({ where: { status: "active", price: { gt: 100000 }, propertyType: "detached", city: config.PRISMA_CITY_VALUE, permAdvertise: true }, _avg: { price: true }, _count: true }),
      prisma.listing.aggregate({ where: { status: "active", price: { gt: 100000 }, propertyType: "semi", city: config.PRISMA_CITY_VALUE, permAdvertise: true }, _avg: { price: true }, _count: true }),
      prisma.listing.aggregate({ where: { status: "active", price: { gt: 100000 }, propertyType: "condo", city: config.PRISMA_CITY_VALUE, permAdvertise: true }, _avg: { price: true }, _count: true }),
      prisma.listing.aggregate({ where: { transactionType: "For Lease", price: { gt: 500, lt: 10000 }, city: config.PRISMA_CITY_VALUE, permAdvertise: true }, _avg: { price: true }, _count: true }),
    ]);

    return {
      activeCount: allActive,
      avgDetached: Math.round(detachedStats._avg.price || 0),
      detachedCount: detachedStats._count,
      avgSemi: Math.round(semiStats._avg.price || 0),
      semiCount: semiStats._count,
      avgCondo: Math.round(condoStats._avg.price || 0),
      condoCount: condoStats._count,
      avgRent: Math.round(rentalStats._avg.price || 0),
      rentalCount: rentalStats._count,
    };
  },
  ["hero-stats"],
  { revalidate: CACHE_TTL }
);

// getFeaturedListings was REMOVED 2026-09-10 (ruling). It was dead code with zero
// consumers, and its `priceDrops` key returned the CHEAPEST ACTIVE LISTINGS — an
// ascending price sort, not a price change of any kind. A dead function is harmless
// until someone wires it to a section called "price drops", which is precisely the
// section it was named for. A price drop is not derivable from DB1: `lastPriceChangeAt`
// records that a price changed, never what it changed from.

export const getStreetStats = unstable_cache(
  async (streetSlug: string, propertyType?: string) => {
    // Phase 2.6: DB1 sold fields nullified. Stats now aggregate active
    // listings only; sold-to-ask ratios and sold listing arrays are
    // surfaced exclusively via the gated DB2 StreetSoldBlock on street
    // pages. This function keeps the same return shape so call sites
    // continue to work, but soldListings is always empty and soldVsAsk
    // is a neutral 100 (no longer computed from DB1).
    const where: Record<string, unknown> = { streetSlug };
    if (propertyType && propertyType !== "all") {
      where.propertyType = propertyType;
    }

    const [active, agg] = await Promise.all([
      prisma.listing.findMany({
        where: { ...where, status: "active" },
        orderBy: { listedAt: "desc" },
        take: 10,
      }),
      prisma.listing.aggregate({
        where: { ...where, status: "active" },
        _avg: { price: true, daysOnMarket: true },
        _count: true,
      }),
    ]);

    return {
      avgPrice: Math.round(agg._avg.price || 0),
      avgDOM: Math.round(agg._avg.daysOnMarket || 0),
      totalCount: agg._count,
      soldVsAsk: 100,           // neutral — real ratios come from gated DB2 path
      activeListings: active,
      soldListings: [] as never[], // always empty — see header comment
    };
  },
  ["street-stats"],
  { revalidate: CACHE_TTL }
);

export const getTrendingStreets = unstable_cache(
  async () => {
    // Streets with the most active listings right now
    const streetGroups = await prisma.listing.groupBy({
      by: ["streetSlug"],
      where: { status: "active", city: config.PRISMA_CITY_VALUE, streetSlug: { not: "" }, permAdvertise: true },
      _count: true,
      _avg: { price: true },
      orderBy: { _count: { streetSlug: "desc" } },
      take: 20,
    });

    const streets = await Promise.all(
      streetGroups.slice(0, 6).map(async (s) => {
        const sample = await prisma.listing.findFirst({
          where: { streetSlug: s.streetSlug, streetName: { not: null } },
          select: { streetName: true },
        });
        const count = typeof s._count === "number" ? s._count : (s._count as Record<string, number>)?._all ?? 0;
        return {
          slug: s.streetSlug,
          name: sample?.streetName || s.streetSlug,
          activeCount: count,
          avgPrice: Math.round(s._avg.price || 0),
        };
      })
    );

    return streets;
  },
  ["trending-streets"],
  { revalidate: CACHE_TTL }
);

export const getPropertyTypeStats = unstable_cache(
  async () => {
    const types = ["detached", "semi", "townhouse", "condo"];
    const results: Record<string, { avgPrice: number; avgDOM: number; soldVsAsk: number }> = {};

    for (const type of types) {
      const agg = await prisma.listing.aggregate({
        where: { propertyType: type, status: "active", permAdvertise: true },
        _avg: { price: true, daysOnMarket: true },
      });
      results[type] = {
        avgPrice: Math.round(agg._avg.price || 0),
        avgDOM: Math.round(agg._avg.daysOnMarket || 0),
        soldVsAsk: 100,
      };
    }

    return results;
  },
  ["property-type-stats"],
  { revalidate: CACHE_TTL }
);
