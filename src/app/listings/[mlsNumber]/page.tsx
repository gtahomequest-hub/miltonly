import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";
import type { Metadata } from "next";
import ListingDetailClient from "./ListingDetailClient";
import FooterSection from "@/components/sections/FooterSection";

interface Props { params: { mlsNumber: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!l) return { title: "Listing Not Found" };
  const isRental = l.transactionType === "For Lease";
  return {
    title: `${l.address.split(",")[0]} — ${formatPriceFull(l.price)}${isRental ? "/mo" : ""} · ${l.bedrooms}bd ${l.bathrooms}ba ${l.propertyType}`,
    description: `${isRental ? "For rent" : "For sale"}: ${l.propertyType} at ${l.address}. ${l.bedrooms} beds, ${l.bathrooms} baths${l.parking ? ", " + l.parking + " parking" : ""}. ${formatPriceFull(l.price)}${isRental ? "/month" : ""}. MLS® ${l.mlsNumber}.`,
    alternates: { canonical: `https://miltonly.com/listings/${l.mlsNumber}` },
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const listing = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!listing) notFound();

  // Similar listings — match transaction type so rentals show rentals, sales show sales
  const similar = await prisma.listing.findMany({
    where: {
      propertyType: listing.propertyType,
      transactionType: listing.transactionType,
      mlsNumber: { not: listing.mlsNumber },
      city: "Milton",
      permAdvertise: true,
    },
    orderBy: { listedAt: "desc" },
    take: 4,
  });

  const serialized = JSON.parse(JSON.stringify(listing));
  const serializedSimilar = JSON.parse(JSON.stringify(similar));

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Breadcrumbs */}
      <div className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11 py-3">
        <div className="flex items-center gap-2 text-[11px] text-[#94a3b8] max-w-6xl mx-auto">
          <Link href="/" className="hover:text-[#07111f]">Miltonly</Link>
          <span>›</span>
          <Link href="/listings" className="hover:text-[#07111f]">Milton</Link>
          <span>›</span>
          <span className="text-[#64748b]">{listing.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "")}</span>
          <span>›</span>
          <span className="text-[#475569] font-medium">{listing.address.split(",")[0]}</span>
        </div>
      </div>

      <ListingDetailClient listing={serialized} similar={serializedSimilar} />
      <FooterSection />
    </div>
  );
}
