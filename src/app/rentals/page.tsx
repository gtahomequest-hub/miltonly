import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import RentalsClient from "./RentalsClient";

export const metadata = genMeta({
  title: "Milton Rentals — Let Miltonly Find Your Home",
  description: "Browse every active rental in Milton Ontario. Condos, townhouses, detached homes — live TREB data, verified landlords, same-day showings guaranteed.",
  canonical: "https://miltonly.com/rentals",
});

export const revalidate = 3600; // ISR: refresh every hour

export default async function RentalsPage() {
  // Only real "For Lease" listings from TREB
  const listings = await prisma.listing.findMany({
    where: { transactionType: "For Lease", city: "Milton" },
    orderBy: { listedAt: "desc" },
    take: 48,
  });

  const totalRentals = await prisma.listing.count({
    where: { transactionType: "For Lease", city: "Milton" },
  });

  // Avg rent — real lease listings only, filter out mis-priced
  const avgRent = await prisma.listing.aggregate({
    where: { transactionType: "For Lease", city: "Milton", price: { gt: 500, lt: 10000 } },
    _avg: { price: true },
  });

  const serialized = JSON.parse(JSON.stringify(listings));

  return (
    <RentalsClient
      listings={serialized}
      totalRentals={totalRentals}
      avgRent={Math.round(avgRent._avg.price || 2419)}
    />
  );
}
