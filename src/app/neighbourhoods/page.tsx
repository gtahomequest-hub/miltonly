import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `${config.CITY_NAME} Neighbourhoods â€” Prices, Schools & Market Data`,
  description: `Explore every ${config.CITY_NAME} ${config.CITY_PROVINCE} neighbourhood. Compare average home prices, active listings, top streets, school zones and GO train access. Live TREB data.`,
  canonical: `${config.SITE_URL}/neighbourhoods`,
});

export const revalidate = 3600;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function cleanHoodName(raw: string): string {
  return raw.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
}

export default async function NeighbourhoodsPage() {
  const hoodGroups = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    _count: true,
    _avg: { price: true },
    where: { city: config.PRISMA_CITY_VALUE, permAdvertise: true },
    orderBy: { _count: { neighbourhood: "desc" } },
  });

  const hoods = await Promise.all(
    hoodGroups
      .filter((h) => h._count >= 5)
      .map(async (h) => {
        const name = cleanHoodName(h.neighbourhood);

        const activeCount = await prisma.listing.count({
          where: { neighbourhood: h.neighbourhood, status: "active", permAdvertise: true },
        });

        const topStreets = await prisma.listing.groupBy({
          by: ["streetSlug"],
          _count: true,
          where: { neighbourhood: h.neighbourhood, permAdvertise: true },
          orderBy: { _count: { streetSlug: "desc" } },
          take: 3,
        });

        const streetNames = await Promise.all(
          topStreets.map(async (s) => {
            const sample = await prisma.listing.findFirst({
              where: { streetSlug: s.streetSlug, streetName: { not: null } },
              select: { streetName: true },
            });
            return sample?.streetName || s.streetSlug;
          })
        );

        return {
          name,
          fullName: h.neighbourhood,
          slug: toSlug(name),
          totalListings: h._count,
          activeCount,
          avgPrice: Math.round(h._avg.price || 0),
          topStreets: streetNames,
        };
      })
  );

  const totalActive = hoods.reduce((s, h) => s + h.activeCount, 0);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="bg-[#07111f] px-5 sm:px-11 py-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] text-[#f59e0b] font-semibold uppercase tracking-[0.12em] mb-2">
            Neighbourhood Intelligence
          </p>
          <h1 className="text-[28px] sm:text-[36px] font-extrabold text-[#f8f9fb] tracking-[-0.5px]">
            {config.CITY_NAME} Neighbourhoods
          </h1>
          <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3">
            {hoods.length} neighbourhoods with live price data &middot; {totalActive} active listings &middot; Updated daily from TREB
          </p>
        </div>
      </div>

      <div className="px-5 sm:px-11 py-8">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hoods.map((h) => (
            <Link
              key={h.slug}
              href={`/neighbourhoods/${h.slug}`}
              className="group bg-white rounded-xl border border-[#e2e8f0] p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-[18px] font-extrabold text-[#07111f] group-hover:text-[#2563eb] transition-colors">
                  {h.name}
                </h2>
                {h.activeCount > 0 && (
                  <span className="text-[10px] font-bold text-[#15803d] bg-[#f0fdf4] px-2 py-0.5 rounded-full">
                    {h.activeCount} active
                  </span>
                )}
              </div>

              <p className="text-[26px] font-extrabold text-[#07111f] mb-1">
                {formatPriceFull(h.avgPrice)}
              </p>
              <p className="text-[11px] text-[#94a3b8] mb-4">
                Average price &middot; {h.totalListings} listings
              </p>

              {h.topStreets.length > 0 && (
                <div className="border-t border-[#f1f5f9] pt-3">
                  <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5">
                    Top streets
                  </p>
                  <p className="text-[12px] text-[#64748b]">
                    {h.topStreets.join(" Â· ")}
                  </p>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
