import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import RentalsClient from "../rentals/RentalsClient";
import SiteChrome from "@/components/nav/SiteChrome";
import { PUBLIC_LEASE_WHERE, stripVowFields } from "@/lib/listings/vow";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `${config.CITY_NAME} Rentals â€” Find Your Perfect Rental Home in ${config.CITY_NAME} ${config.CITY_PROVINCE_CODE}`,
  description: `Browse every active rental in ${config.CITY_NAME} ${config.CITY_PROVINCE}. Condos, townhouses, detached homes â€” live TREB data, verified landlords, same-day showings guaranteed.`,
  canonical: `${config.SITE_URL}/rent`,
});

export const revalidate = 3600;

const rentCategories = [
  { label: "1 Bed Condo", type: "condo", beds: 1 },
  { label: "1+Den Condo", type: "condo", beds: 2, isDen: true },
  { label: "2 Bed Condo", type: "condo", beds: 2 },
  { label: "3 Bed Condo", type: "condo", beds: 3 },
  { label: "3 Bed Townhouse", type: "townhouse", beds: 3 },
  { label: "3 Bed Semi", type: "semi", beds: 3 },
  { label: "4 Bed Semi", type: "semi", beds: 4 },
  { label: "3 Bed Detached", type: "detached", beds: 3 },
  { label: "4 Bed Detached", type: "detached", beds: 4 },
];

export default async function RentLandingPage() {
  // MC-029: available units only (src/lib/listings/vow.ts), stripped of every VOW-only column
  // before serialisation; "new this week" is counted here so the client holds no list date.
  const listingRows = await prisma.listing.findMany({
    where: PUBLIC_LEASE_WHERE,
    orderBy: { listedAt: "desc" },
    take: 48,
  });
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const newThisWeek = listingRows.filter((l) => l.listedAt >= weekAgo).length;
  const listings = listingRows.map(stripVowFields);

  const totalRentals = await prisma.listing.count({ where: PUBLIC_LEASE_WHERE });

  const avgRent = await prisma.listing.aggregate({
    where: { transactionType: "For Lease", city: config.PRISMA_CITY_VALUE, price: { gt: 500, lt: 10000 }, permAdvertise: true },
    _avg: { price: true },
  });

  const rentAvgs = await Promise.all(
    rentCategories.map(async (cat) => {
      const where: Record<string, unknown> = {
        transactionType: "For Lease", city: config.PRISMA_CITY_VALUE, propertyType: cat.type, bedrooms: cat.beds, price: { gt: 500, lt: 10000 }, permAdvertise: true,
      };
      if (cat.isDen) where.description = { contains: "den", mode: "insensitive" };
      const [agg, count] = await Promise.all([
        prisma.listing.aggregate({ where, _avg: { price: true } }),
        prisma.listing.count({ where }),
      ]);
      return { label: cat.label, type: cat.type, beds: cat.beds, avg: Math.round(agg._avg.price || 0), count };
    })
  );

  const serialized = JSON.parse(JSON.stringify(listings));

  return (
    <SiteChrome>
    <RentalsClient
      listings={serialized}
      newThisWeek={newThisWeek}
      totalRentals={totalRentals}
      avgRent={Math.round(avgRent._avg.price || 2419)}
      rentAvgs={rentAvgs.filter((r) => r.avg > 0)}
    />
    </SiteChrome>
  );
}
