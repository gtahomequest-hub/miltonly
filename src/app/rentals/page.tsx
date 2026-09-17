import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import RentalsClient from "./RentalsClient";
import { getRentalsAvailableCount } from "@/lib/rentalsAvailable";
import { resolveRentalScope } from "@/lib/rentalScope";
import SiteChrome from "@/components/nav/SiteChrome";
import { cached } from "@/lib/cache";

// The page reads searchParams (the hub scope), so it is dynamic; `revalidate` was a no-op
// beside force-dynamic and is gone. What it reads is cached instead (MC-018, below).
export const dynamic = 'force-dynamic';

// MC-018 (2026-09-14). MC-016 measured one render of this page at 66,712 DB1 rows scanned: the
// 48 newest leases, an available count, a town-wide average and nine category aggregates, each
// its own query, on every request, with no cache. The bundle now sits in Upstash for
// RENTALS_TTL per scope. Fifteen minutes, not the hour the other stats get, because nothing
// purges it: the listing syncs purge by path and this page has no path cache. A lease that
// lands between two syncs (10:00 and 11:30 UTC) is on the page within fifteen minutes.
const RENTALS_TTL = 900;

type SearchParams = { [key: string]: string | string[] | undefined };

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const scope = await resolveRentalScope(searchParams?.neighbourhood);
  const where = scope ? `${scope.name}, ${config.CITY_NAME}` : `${config.CITY_NAME} ${config.CITY_PROVINCE}`;
  return genMeta({
    title: scope
      ? `${scope.name} Rentals, ${config.CITY_NAME}: Let ${config.SITE_NAME} Find Your Home`
      : `${config.CITY_NAME} Rentals: Let ${config.SITE_NAME} Find Your Home`,
    description: `Browse every active rental in ${where}. Condos, townhouses, detached homes: live TREB data, verified landlords, same-day showings guaranteed.`,
    canonical: `${config.SITE_URL}/rentals`,
  });
}

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

export default async function RentalsPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await resolveRentalScope(searchParams?.neighbourhood);
  const scopeWhere = scope ? { neighbourhood: { in: scope.rawStrings } } : {};

  const { serialized, totalRentals, avgRentValue, rentAvgs } = await cached(`rentals:${scope?.slug ?? "all"}:v1`, RENTALS_TTL, async () => {
    const listings = await prisma.listing.findMany({
      where: { transactionType: "For Lease", city: config.PRISMA_CITY_VALUE, permAdvertise: true, ...scopeWhere },
      orderBy: { listedAt: "desc" },
      take: 48,
    });

    // AVAILABLE, not "ever advertised". This counted every For Lease row regardless of
    // leaseStatus and the page printed the result as "N active rentals" five times over. On
    // 2026-09-10 that was 1,340, of which 224 were already leased: 1,116 were available. One
    // shared function now answers this for /rentals and for the homepage's "available to rent"
    // tile, so the two surfaces cannot disagree about the same word.
    const totalRentals = scope
      ? await prisma.listing.count({
          where: { transactionType: "For Lease", city: config.PRISMA_CITY_VALUE, permAdvertise: true, leaseStatus: "active", ...scopeWhere },
        })
      : await getRentalsAvailableCount();

    const avgRent = await prisma.listing.aggregate({
      where: { transactionType: "For Lease", city: config.PRISMA_CITY_VALUE, price: { gt: 500, lt: 10000 }, permAdvertise: true, ...scopeWhere },
      _avg: { price: true },
    });

    const rentAvgs = await Promise.all(
      rentCategories.map(async (cat) => {
        const where: Record<string, unknown> = {
          transactionType: "For Lease", city: config.PRISMA_CITY_VALUE, propertyType: cat.type, bedrooms: cat.beds, price: { gt: 500, lt: 10000 }, permAdvertise: true, ...scopeWhere,
        };
        if (cat.isDen) where.description = { contains: "den", mode: "insensitive" };
        const [agg, count] = await Promise.all([
          prisma.listing.aggregate({ where, _avg: { price: true } }),
          prisma.listing.count({ where }),
        ]);
        return { label: cat.label, type: cat.type, beds: cat.beds, avg: Math.round(agg._avg.price || 0), count };
      })
    );

    // JSON in, JSON out: the cache stores what the client component receives
    return { serialized: JSON.parse(JSON.stringify(listings)) as Parameters<typeof RentalsClient>[0]["listings"], totalRentals, avgRentValue: avgRent._avg.price, rentAvgs };
  });

  return (
    <SiteChrome>
    <RentalsClient
      listings={serialized}
      totalRentals={totalRentals}
      avgRent={Math.round(avgRentValue || 2419)}
      rentAvgs={rentAvgs.filter((r) => r.avg > 0)}
      scope={scope ? { slug: scope.slug, name: scope.name } : null}
    />
    </SiteChrome>
  );
}
