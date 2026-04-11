import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import StreetsGrid from "./StreetsGrid";

export const metadata = genMeta({
  title: "Milton Streets — Price Data for Every Street",
  description: "Browse every Milton Ontario street with real estate data. Average prices, days on market, active listings. Street-level intelligence powered by TREB.",
  canonical: "https://miltonly.com/streets",
});

export default async function StreetsIndexPage() {
  // Get all unique streets with listing counts and avg prices
  const streets = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    _avg: { price: true },
    where: { city: "Milton" },
    orderBy: { _count: { streetSlug: "desc" } },
  });

  // Get the clean street name for each slug from the Listing table
  const streetData = await Promise.all(
    streets.slice(0, 100).map(async (s) => {
      const sample = await prisma.listing.findFirst({
        where: { streetSlug: s.streetSlug, streetName: { not: null } },
        select: { streetName: true, neighbourhood: true },
      });

      return {
        slug: s.streetSlug,
        name: sample?.streetName || s.streetSlug,
        neighbourhood: sample?.neighbourhood || "Milton",
        count: s._count,
        avgPrice: Math.round(s._avg.price || 0),
      };
    })
  );

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="px-5 sm:px-11 py-8">
        <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-[0.12em] mb-1">
          Street Intelligence
        </p>
        <h1 className="text-[24px] font-extrabold text-[#07111f] tracking-[-0.3px] mb-2">
          Every Milton Street
        </h1>
        <p className="text-[13px] text-[#64748b] mb-8">
{streetData.length} streets with live price data · Updated daily from TREB
        </p>

        <StreetsGrid streets={streetData} />
      </div>
    </div>
  );
}
