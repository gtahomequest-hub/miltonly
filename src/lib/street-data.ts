// Street page data — ACTIVE-LISTING aggregates only.
//
// VOW compliance (Phase 2.6 — 2026-04-17): this function was previously
// computing sold-derived aggregates (avgSoldPrice, soldVsAskPct,
// overUnderAsking, individual soldListings) from DB1's Listing table and
// shipping them into the public render tree. On low-volume streets those
// aggregates back-calculate to individual sold prices — a VOW violation
// per the project-wide k-anonymity rule in DO-NOT-REPEAT.md.
//
// Option C fix: DB1 as a sold-data source is ripped out of public pages.
// The new StreetSoldBlock (fed from DB2 via gated sold-data.ts fetchers,
// with VowGate + k-anonymity) is the sole path for any sold-data display.
// This module now returns only active-listing aggregates + safe counts.

import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { extractStreetName as cleanStreetName } from "@/lib/streetUtils";

export interface StreetPageData {
  slug: string;
  streetName: string;
  neighbourhoods: string[];
  // Active-listing aggregates (public, safe)
  avgListPrice: number;        // of active listings only
  medianPrice: number;         // of active listings only
  avgDOM: number;              // of active listings only
  // Counts — safe aggregates
  activeCount: number;
  rentedCount: number;
  totalSold12mo: number;       // count only, no sold-price inference
  // By type (active-listing averages)
  byType: Record<string, { count: number; avgPrice: number; activeCount: number }>;
  // Listings — active only. No soldListings field.
  activeListings: unknown[];
  allListings: unknown[];      // retained for consumers that need list shape; active+rented only (no sold)
  // Distributions — computed from active listings only
  priceDistribution: { range: string; count: number; pct: number }[];
  domDistribution: { range: string; count: number; pct: number }[];
  // Nearby streets — active-listing avg only
  nearbyStreets: { slug: string; name: string; avgPrice: number; count: number }[];
  lastUpdated: string;
}

function extractStreetName(address: string): string {
  return cleanStreetName(address);
}

export const getStreetPageData = unstable_cache(
  async (slug: string): Promise<StreetPageData | null> => {
    const allListings = await prisma.listing.findMany({
      where: { streetSlug: slug, permAdvertise: true },
      orderBy: { listedAt: "desc" },
    });

    if (allListings.length === 0) return null;

    const active = allListings.filter((l) => l.status === "active");
    const sold = allListings.filter((l) => l.status === "sold");
    const rented = allListings.filter((l) => l.status === "rented");
    const streetName = allListings[0].streetName || extractStreetName(allListings[0].address);
    const neighbourhoods = Array.from(new Set(allListings.map((l) => l.neighbourhood)));

    // ----- Active-only aggregates (public-safe) -----
    const activePrices = active.map((l) => l.price).sort((a, b) => a - b);
    const avgListPrice = active.length > 0
      ? Math.round(active.reduce((s, l) => s + l.price, 0) / active.length)
      : 0;
    const medianPrice = activePrices.length > 0
      ? activePrices[Math.floor(activePrices.length / 2)]
      : 0;

    // DOM from active listings only (current days-on-market, not final sold DOM).
    const activeWithDOM = active.filter((l) => l.daysOnMarket && l.daysOnMarket > 0);
    const avgDOM = activeWithDOM.length > 0
      ? Math.round(activeWithDOM.reduce((s, l) => s + (l.daysOnMarket || 0), 0) / activeWithDOM.length)
      : 0;

    // By-type aggregates — active listings only.
    const types = ["detached", "semi", "townhouse", "condo", "other"];
    const byType: StreetPageData["byType"] = {};
    for (const t of types) {
      const activeOfType = active.filter((l) => l.propertyType === t);
      if (activeOfType.length > 0) {
        byType[t] = {
          count: activeOfType.length,
          avgPrice: Math.round(activeOfType.reduce((s, l) => s + l.price, 0) / activeOfType.length),
          activeCount: activeOfType.length,
        };
      }
    }

    // Price distribution — active listings only.
    const buckets = [
      { range: "Under $500K", min: 0, max: 500000 },
      { range: "$500K–$700K", min: 500000, max: 700000 },
      { range: "$700K–$1M", min: 700000, max: 1000000 },
      { range: "$1M–$1.5M", min: 1000000, max: 1500000 },
      { range: "Over $1.5M", min: 1500000, max: Infinity },
    ];
    const priceDistribution = buckets.map((b) => {
      const count = active.filter((l) => l.price >= b.min && l.price < b.max).length;
      return { range: b.range, count, pct: active.length > 0 ? Math.round((count / active.length) * 100) : 0 };
    });

    // DOM distribution — active listings only.
    const domBuckets = [
      { range: "< 7 days", min: 0, max: 7 },
      { range: "7–14 days", min: 7, max: 14 },
      { range: "14–30 days", min: 14, max: 30 },
      { range: "30+ days", min: 30, max: Infinity },
    ];
    const domDistribution = domBuckets.map((b) => {
      const count = activeWithDOM.filter((l) => (l.daysOnMarket || 0) >= b.min && (l.daysOnMarket || 0) < b.max).length;
      return { range: b.range, count, pct: activeWithDOM.length > 0 ? Math.round((count / activeWithDOM.length) * 100) : 0 };
    });

    // Nearby streets — active-listing avg price only.
    const nearbyRaw = await prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: true,
      _avg: { price: true },
      where: {
        neighbourhood: { in: neighbourhoods },
        streetSlug: { not: slug },
        status: "active",
        permAdvertise: true,
      },
      orderBy: { _count: { streetSlug: "desc" } },
      take: 6,
    });

    const nearbyStreets = await Promise.all(
      nearbyRaw.map(async (s) => {
        const sample = await prisma.listing.findFirst({
          where: { streetSlug: s.streetSlug },
          select: { streetName: true, address: true },
        });
        return {
          slug: s.streetSlug,
          name: sample?.streetName || extractStreetName(sample?.address || s.streetSlug),
          avgPrice: Math.round(s._avg.price || 0),
          count: s._count,
        };
      })
    );

    // Expose active + rented via allListings for downstream components that
    // want to iterate over every publicly-safe listing. Sold listings are
    // deliberately excluded — use the gated DB2 pipeline for sold display.
    const publicListings = [...active, ...rented];

    return {
      slug,
      streetName,
      neighbourhoods,
      avgListPrice,
      medianPrice,
      avgDOM,
      activeCount: active.length,
      rentedCount: rented.length,
      totalSold12mo: sold.length, // count only — safe aggregate
      byType,
      activeListings: active as never[],
      allListings: publicListings as never[],
      priceDistribution,
      domDistribution,
      nearbyStreets,
      lastUpdated: new Date().toISOString().split("T")[0],
    };
  },
  ["street-page-data"],
  { revalidate: 3600 }
);
