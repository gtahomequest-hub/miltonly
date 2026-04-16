import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import RentalsClient from "./RentalsClient";

export const metadata = genMeta({
  title: "Milton Rentals — Let Miltonly Find Your Home",
  description: "Browse every active rental in Milton Ontario. Condos, townhouses, detached homes — live TREB data, verified landlords, same-day showings guaranteed.",
  canonical: "https://miltonly.com/rentals",
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

export default async function RentalsPage() {
  const listings = await prisma.listing.findMany({
    where: { transactionType: "For Lease", city: "Milton", permAdvertise: true },
    orderBy: { listedAt: "desc" },
    take: 48,
  });

  const totalRentals = await prisma.listing.count({
    where: { transactionType: "For Lease", city: "Milton", permAdvertise: true },
  });

  const avgRent = await prisma.listing.aggregate({
    where: { transactionType: "For Lease", city: "Milton", price: { gt: 500, lt: 10000 }, permAdvertise: true },
    _avg: { price: true },
  });

  const rentAvgs = await Promise.all(
    rentCategories.map(async (cat) => {
      const where: Record<string, unknown> = {
        transactionType: "For Lease", city: "Milton", propertyType: cat.type, bedrooms: cat.beds, price: { gt: 500, lt: 10000 }, permAdvertise: true,
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
    <RentalsClient
      listings={serialized}
      totalRentals={totalRentals}
      avgRent={Math.round(avgRent._avg.price || 2419)}
      rentAvgs={rentAvgs.filter((r) => r.avg > 0)}
    />
  );
}
