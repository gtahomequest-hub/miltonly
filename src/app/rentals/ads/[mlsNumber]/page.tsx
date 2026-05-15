// Rentals featured page — Server Component. Hit by cold paid Google Ads
// traffic. Fetches the listing by mlsNumber, validates it's active for
// lease (leaseStatus='active', NOT status — see schema note: every lease
// row carries status='rented' regardless of lifecycle; leaseStatus is the
// live-marketing gate), and calls notFound() on any invalid case so we
// never waste ad spend on stale URLs. Pulls a broad pool of same-tx-type
// active leases (LiveListingSlider) and renders the client wrapper.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { formatPriceFull, cleanNeighbourhoodName } from "@/lib/format";
import RentalsAdsClient from "./RentalsAdsClient";

export const dynamic = "force-dynamic";

const MLS_RE = /^[A-Z][0-9]{8}$/;
const LEASE_TX_TYPE = "For Lease";
// Lease lifecycle gate. Every lease row carries status='rented' regardless
// of whether it's still marketed; leaseStatus is the live-marketing flag.
// Without this filter, paid clicks would land on already-leased listings
// (173 of 415 lease records as of 2026-05-14) — bad UX + wasted ad spend.
const LIVE_LEASE_STATUS = "active";
// Mirror the slider pool sizing on /sales/ads. Lease inventory is thinner
// (~242 active vs ~480 sale) but 80 still covers each property-type bucket
// with enough cards for the per-type filter pills to be meaningful.
const SLIDER_LIMIT = 80;

const TYPE_DISPLAY_LABEL: Record<string, string> = {
  condo: "Condo",
  detached: "Detached Home",
  semi: "Semi-Detached Home",
  townhouse: "Townhouse",
};

interface PageProps {
  params: Promise<{ mlsNumber: string }>;
}

async function fetchListingForRender(mlsNumber: string) {
  if (!MLS_RE.test(mlsNumber)) return null;
  const row = await prisma.listing.findUnique({ where: { mlsNumber } });
  if (!row) return null;
  if (row.transactionType !== LEASE_TX_TYPE) return null;
  if (row.leaseStatus !== LIVE_LEASE_STATUS) return null;
  if (row.permAdvertise !== true) return null;
  return row;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mlsNumber } = await params;
  const listing = await fetchListingForRender(mlsNumber);
  if (!listing) {
    return {
      title: `${config.CITY_NAME} Rentals | ${config.SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }
  const priceText = `${formatPriceFull(listing.price)}/mo`;
  const streetAddr = listing.address.split(",")[0];
  const typeLabel = TYPE_DISPLAY_LABEL[listing.propertyType?.toLowerCase()] || listing.propertyType;
  const title = `${priceText} · ${streetAddr}, ${listing.city} · ${listing.bedrooms} bed ${typeLabel} for lease`;
  const fallbackDescription = `${listing.bedrooms} bedroom, ${listing.bathrooms} bath ${typeLabel.toLowerCase()} for lease at ${streetAddr} in ${cleanNeighbourhoodName(listing.neighbourhood) || listing.city}. ${priceText}. Tour with ${config.realtor.name}, RE/MAX Hall of Fame.`;
  const description = listing.description
    ? listing.description.slice(0, 155).replace(/\s+\S*$/, "").trim()
    : fallbackDescription;
  const primaryPhoto = listing.photos?.[0];
  return {
    title,
    description,
    alternates: {
      canonical: `${config.SITE_URL}/rentals/ads/${listing.mlsNumber}`,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${config.SITE_URL}/rentals/ads/${listing.mlsNumber}`,
      siteName: config.SITE_NAME,
      ...(primaryPhoto ? { images: [{ url: primaryPhoto }] } : {}),
    },
  };
}

export default async function RentalsAdsListingPage({ params }: PageProps) {
  const { mlsNumber } = await params;

  // Format guard — 404 on malformed URLs so crawlers never chase invalid
  // MLS shapes and paid traffic on a malformed URL gets a clean miss.
  if (!MLS_RE.test(mlsNumber)) notFound();

  const listing = await prisma.listing.findUnique({ where: { mlsNumber } });
  if (!listing) notFound();
  if (listing.transactionType !== LEASE_TX_TYPE) notFound();
  if (listing.leaseStatus !== LIVE_LEASE_STATUS) notFound();
  if (listing.permAdvertise !== true) notFound();

  // Slider pool — top 80 active Milton lease listings across all property
  // types, ordered by recency. Same broad-pool + client-side-filter pattern
  // as /sales/ads. The leaseStatus='active' filter keeps already-leased
  // units out of the carousel.
  const sliderListings = await prisma.listing.findMany({
    where: {
      transactionType: LEASE_TX_TYPE,
      leaseStatus: LIVE_LEASE_STATUS,
      city: listing.city,
      mlsNumber: { not: listing.mlsNumber },
      permAdvertise: true,
    },
    orderBy: { listedAt: "desc" },
    take: SLIDER_LIMIT,
    select: {
      mlsNumber: true,
      address: true,
      price: true,
      bedrooms: true,
      bathrooms: true,
      sqft: true,
      photos: true,
      listedAt: true,
      propertyType: true,
      architecturalStyle: true,
      approximateAge: true,
    },
  });

  const listingSerialized = JSON.parse(JSON.stringify(listing));
  const sliderListingsSerialized = JSON.parse(JSON.stringify(sliderListings));

  return (
    <RentalsAdsClient
      listing={listingSerialized}
      sliderListings={sliderListingsSerialized}
    />
  );
}
