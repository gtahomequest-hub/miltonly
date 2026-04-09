import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import RentalsClient from "./RentalsClient";

export const metadata = genMeta({
  title: "Milton Rentals — Let Miltonly Find Your Home",
  description: "Browse every active rental in Milton Ontario. Condos, townhouses, detached homes — live TREB data, verified landlords, same-day showings guaranteed.",
  canonical: "https://miltonly.com/rentals",
});

export default async function RentalsPage() {
  const listings = await prisma.listing.findMany({
    where: { status: "rented", city: "Milton" },
    orderBy: { listedAt: "desc" },
    take: 24,
  });

  // Also get active rentals
  const activeRentals = await prisma.listing.findMany({
    where: { status: "active", city: "Milton" },
    orderBy: { listedAt: "desc" },
    take: 24,
  });

  // Combine and prefer active, then rented
  const allListings = [...activeRentals, ...listings].slice(0, 24);

  const totalRentals = await prisma.listing.count({
    where: { status: { in: ["rented", "active"] }, city: "Milton" },
  });

  const avgRent = await prisma.listing.aggregate({
    where: { status: { in: ["rented", "active"] }, city: "Milton", price: { lt: 10000 } },
    _avg: { price: true },
  });

  const serialized = JSON.parse(JSON.stringify(allListings));

  return (
    <RentalsClient
      listings={serialized}
      totalRentals={totalRentals}
      avgRent={Math.round(avgRent._avg.price || 2419)}
    />
  );
}
