import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import StreetsGrid from "./StreetsGrid";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `${config.CITY_NAME} Streets, Price Data for Every Street`,
  description: `Browse every ${config.CITY_NAME} ${config.CITY_PROVINCE} street with real estate data. Average prices, days on market, active listings. Street-level intelligence powered by TREB.`,
  canonical: `${config.SITE_URL}/streets`,
});

export default async function StreetsIndexPage() {
  // Get all unique streets with listing counts and avg prices
  const streets = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    _avg: { price: true },
    where: { city: config.PRISMA_CITY_VALUE, permAdvertise: true },
    orderBy: { _count: { streetSlug: "desc" } },
  });

  // Hotfix 2026-05-09: replaced per-street N+1 loop (4 queries × 431 streets =
  // ~1,724 concurrent queries) with 4 bulk queries. The N+1 pattern exhausted
  // the Vercel serverless → Neon connection pool post-Path-A redeploy and
  // triggered Application error: digest 306433527.
  const slugs = streets.map((s) => s.streetSlug);

  // Bulk #1: sample streetName + neighbourhood per slug
  const samples = await prisma.listing.findMany({
    where: { streetSlug: { in: slugs }, streetName: { not: null } },
    distinct: ["streetSlug"],
    select: { streetSlug: true, streetName: true, neighbourhood: true },
  });
  const sampleMap = new Map(samples.map((r) => [r.streetSlug, r]));

  // Bulk #2: active counts per slug
  const activeRows = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    where: { streetSlug: { in: slugs }, status: "active", permAdvertise: true },
  });
  const activeMap = new Map(activeRows.map((r) => [r.streetSlug, r._count]));

  // Bulk #3: published street pages
  const publishedRows = await prisma.streetContent.findMany({
    where: { streetSlug: { in: slugs }, status: "published" },
    select: { streetSlug: true },
  });
  const publishedSet = new Set(publishedRows.map((r) => r.streetSlug));

  // Bulk #4: recently queued (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const queuedRows = await prisma.streetQueue.findMany({
    where: { streetSlug: { in: slugs }, createdAt: { gte: sevenDaysAgo } },
    select: { streetSlug: true },
  });
  const newSet = new Set(queuedRows.map((r) => r.streetSlug));

  const streetData = streets.map((s) => {
    const sample = sampleMap.get(s.streetSlug);
    return {
      slug: s.streetSlug,
      name: sample?.streetName || s.streetSlug,
      neighbourhood: sample?.neighbourhood
        ? sample.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "").trim()
        : config.CITY_NAME,
      count: s._count,
      activeCount: activeMap.get(s.streetSlug) ?? 0,
      avgPrice: Math.round(s._avg.price || 0),
      hasPage: publishedSet.has(s.streetSlug),
      isNew: newSet.has(s.streetSlug),
    };
  });

  // Get unique neighbourhoods for filter chips
  const neighbourhoods = Array.from(new Set(streetData.map((s) => s.neighbourhood)))
    .filter((n) => n && n !== config.CITY_NAME)
    .sort();

  const publishedCount = await prisma.streetContent.count({ where: { status: "published" } });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="px-5 sm:px-11 py-8">
        <p className="text-[10px] text-[#f59e0b] font-semibold uppercase tracking-[0.12em] mb-1">
          Street Intelligence
        </p>
        <h1 className="text-[24px] font-extrabold text-[#07111f] tracking-[-0.3px] mb-2">
          Every {config.CITY_NAME} Street
        </h1>
        <p className="text-[13px] text-[#64748b] mb-8">
          {streetData.length} streets with live price data · {publishedCount} full street reports published · Updated daily from TREB
        </p>

        <StreetsGrid streets={streetData} neighbourhoods={neighbourhoods} />
      </div>
    </div>
  );
}
