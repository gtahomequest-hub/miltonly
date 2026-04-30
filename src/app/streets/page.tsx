import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import StreetsGrid from "./StreetsGrid";

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

  // Get the clean street name + neighbourhood for each slug
  const streetData = await Promise.all(
    streets.map(async (s) => {
      const sample = await prisma.listing.findFirst({
        where: { streetSlug: s.streetSlug, streetName: { not: null } },
        select: { streetName: true, neighbourhood: true },
      });

      // Check if this street has active listings
      const activeCount = await prisma.listing.count({
        where: { streetSlug: s.streetSlug, status: "active", permAdvertise: true },
      });

      // Check if it has a published street page
      const hasPage = await prisma.streetContent.findUnique({
        where: { streetSlug: s.streetSlug, status: "published" },
        select: { streetSlug: true, publishedAt: true },
      });

      // Check if recently queued (new street)
      const inQueue = await prisma.streetQueue.findUnique({
        where: { streetSlug: s.streetSlug },
        select: { createdAt: true },
      });

      const isNew = inQueue
        ? Date.now() - new Date(inQueue.createdAt).getTime() < 7 * 86400000
        : false;

      return {
        slug: s.streetSlug,
        name: sample?.streetName || s.streetSlug,
        neighbourhood: sample?.neighbourhood
          ? sample.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "").trim()
          : config.CITY_NAME,
        count: s._count,
        activeCount,
        avgPrice: Math.round(s._avg.price || 0),
        hasPage: !!hasPage,
        isNew,
      };
    })
  );

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
