import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import RentalsClient from "./RentalsClient";

export const metadata = genMeta({
  title: "Milton Rentals — Let Miltonly Find Your Home",
  description: "Browse every active rental in Milton Ontario. Condos, townhouses, detached homes — live TREB data, verified landlords, same-day showings guaranteed.",
  canonical: "https://miltonly.com/rentals",
});

export default async function RentalsPage() {
  // Only rental/lease listings — status "rented" in our DB means lease/rental transaction
  const listings = await prisma.listing.findMany({
    where: { status: "rented", city: "Milton" },
    orderBy: { listedAt: "desc" },
    take: 24,
  });

  const totalRentals = await prisma.listing.count({
    where: { status: "rented", city: "Milton" },
  });

  // Avg rent — only rental listings under $10K/month (filters out mis-priced)
  const avgRent = await prisma.listing.aggregate({
    where: { status: "rented", city: "Milton", price: { gt: 500, lt: 10000 } },
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
