import { prisma } from "@/lib/prisma";
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
      prisma.listing.count({ where: { status: "active", price: { gt: 100000 }, city: "Milton" } }),
      prisma.listing.aggregate({ where: { status: "active", price: { gt: 100000 }, propertyType: "detached", city: "Milton" }, _avg: { price: true }, _count: true }),
      prisma.listing.aggregate({ where: { status: "active", price: { gt: 100000 }, propertyType: "semi", city: "Milton" }, _avg: { price: true }, _count: true }),
      prisma.listing.aggregate({ where: { status: "active", price: { gt: 100000 }, propertyType: "condo", city: "Milton" }, _avg: { price: true }, _count: true }),
      prisma.listing.aggregate({ where: { transactionType: "For Lease", price: { gt: 500, lt: 10000 }, city: "Milton" }, _avg: { price: true }, _count: true }),
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

export const getFeaturedListings = unstable_cache(
  async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const newThisWeek = await prisma.listing.findMany({
      where: { status: "active", listedAt: { gte: sevenDaysAgo } },
      orderBy: { listedAt: "desc" },
      take: 6,
    });

    // For "price drops" - show active listings sorted by price ascending (best deals)
    const priceDrops = await prisma.listing.findMany({
      where: { status: "active" },
      orderBy: { price: "asc" },
      take: 6,
    });

    // For "open houses" - show newest active listings
    const openHouses = await prisma.listing.findMany({
      where: { status: "active" },
      orderBy: { listedAt: "desc" },
      take: 6,
    });

    return { newThisWeek, priceDrops, openHouses };
  },
  ["featured-listings"],
  { revalidate: CACHE_TTL }
);

export const getStreetStats = unstable_cache(
  async (streetSlug: string, propertyType?: string) => {
    const where: Record<string, unknown> = { streetSlug };
    if (propertyType && propertyType !== "all") {
      where.propertyType = propertyType;
    }

    const [active, sold, agg] = await Promise.all([
      prisma.listing.findMany({
        where: { ...where, status: "active" },
        orderBy: { listedAt: "desc" },
        take: 10,
      }),
      prisma.listing.findMany({
        where: { ...where, status: "sold" },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.listing.aggregate({
        where,
        _avg: { price: true, daysOnMarket: true },
        _count: true,
      }),
    ]);

    // Sold vs ask for this street
    const soldWithPrices = sold.filter((l) => l.soldPrice && l.price > 0);
    let soldVsAsk = 100;
    if (soldWithPrices.length > 0) {
      const ratios = soldWithPrices.map((l) => (l.soldPrice! / l.price) * 100);
      soldVsAsk = Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length);
    }

    return {
      avgPrice: Math.round(agg._avg.price || 0),
      avgDOM: Math.round(agg._avg.daysOnMarket || 0),
      totalCount: agg._count,
      soldVsAsk,
      activeListings: active,
      soldListings: sold,
    };
  },
  ["street-stats"],
  { revalidate: CACHE_TTL }
);

export const getPropertyTypeStats = unstable_cache(
  async () => {
    const types = ["detached", "semi", "townhouse", "condo"];
    const results: Record<string, { avgPrice: number; avgDOM: number; soldVsAsk: number }> = {};

    for (const type of types) {
      const agg = await prisma.listing.aggregate({
        where: { propertyType: type, status: "active" },
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
