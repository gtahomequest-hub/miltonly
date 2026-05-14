// Sales featured page — Server Component. Hit by cold paid Google Ads
// traffic. Fetches the listing by mlsNumber, validates it's active + for
// sale + format-clean, redirects to /rentals on any invalid case so we
// never waste ad spend on dead URLs. Pulls a smart-blend slate of up to 10
// same-property-type sale listings (LiveListingSlider) and renders the
// client wrapper.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { formatPriceFull, cleanNeighbourhoodName } from "@/lib/format";
import SalesAdsClient from "./SalesAdsClient";

export const dynamic = "force-dynamic";

const MLS_RE = /^[A-Z][0-9]{8}$/;
const SALE_TX_TYPE = "For Sale";
const ACTIVE_STATUS = "active";
// Commit 4l: bumped from 10 → 80. The slider now ships with filter pills
// (Similar / Detached / Semi / Townhouse / Condo / All Milton) that operate
// against the full pool client-side. 80 covers each property-type bucket
// with enough cards for the "Detached"/"Semi" filters to be meaningful in
// a typical Milton inventory.
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

// Helpers shared by generateMetadata + the page render. Avoids two DB
// roundtrips for the same mlsNumber.
async function fetchListingForRender(mlsNumber: string) {
  if (!MLS_RE.test(mlsNumber)) return null;
  const row = await prisma.listing.findUnique({ where: { mlsNumber } });
  if (!row) return null;
  if (row.status !== ACTIVE_STATUS) return null;
  if (row.transactionType !== SALE_TX_TYPE) return null;
  return row;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mlsNumber } = await params;
  const listing = await fetchListingForRender(mlsNumber);
  if (!listing) {
    // Listings that redirect get a noindex placeholder so crawlers don't
    // chase invalid MLS URLs back into the redirect.
    return {
      title: `${config.CITY_NAME} Real Estate | ${config.SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }
  const priceText = formatPriceFull(listing.price);
  const streetAddr = listing.address.split(",")[0];
  const typeLabel = TYPE_DISPLAY_LABEL[listing.propertyType?.toLowerCase()] || listing.propertyType;
  const title = `${priceText} · ${streetAddr}, ${listing.city} · ${listing.bedrooms} bed ${typeLabel}`;
  const fallbackDescription = `${listing.bedrooms} bedroom, ${listing.bathrooms} bath ${typeLabel.toLowerCase()} at ${streetAddr} in ${cleanNeighbourhoodName(listing.neighbourhood) || listing.city}. Listed at ${priceText}. Book a showing with ${config.realtor.name}, RE/MAX Hall of Fame.`;
  const description = listing.description
    ? listing.description.slice(0, 155).replace(/\s+\S*$/, "").trim()
    : fallbackDescription;
  const primaryPhoto = listing.photos?.[0];
  return {
    title,
    description,
    alternates: {
      canonical: `${config.SITE_URL}/sales/ads/${listing.mlsNumber}`,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${config.SITE_URL}/sales/ads/${listing.mlsNumber}`,
      siteName: config.SITE_NAME,
      ...(primaryPhoto ? { images: [{ url: primaryPhoto }] } : {}),
    },
  };
}

export default async function SalesAdsListingPage({ params }: PageProps) {
  const { mlsNumber } = await params;

  // Format guard — kill traffic to malformed URLs cleanly per spec.
  if (!MLS_RE.test(mlsNumber)) redirect("/rentals");

  const listing = await prisma.listing.findUnique({ where: { mlsNumber } });
  if (!listing) redirect("/rentals");
  if (listing.status !== ACTIVE_STATUS) redirect("/rentals");
  if (listing.transactionType !== SALE_TX_TYPE) redirect("/rentals");

  // Slider pool — top 80 active Milton sale listings across all property
  // types, ordered by recency. The slider component filters client-side
  // (Similar / Detached / Semi / Townhouse / Condo / All Milton pills), so
  // it needs a broad enough pool that each per-type bucket has 5-10 cards.
  // Field selection trims the payload to what the slider actually renders.
  const sliderListings = await prisma.listing.findMany({
    where: {
      transactionType: SALE_TX_TYPE,
      status: ACTIVE_STATUS,
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
      // 4l-fix: similar-listings matcher uses architecturalStyle as the
      // TRREB-native storeys signal (2-Storey vs Bungalow vs Backsplit 3 etc.)
      // and approximateAge consolidated into 4 buckets. Both are selected
      // for every slider candidate so the client-side matcher can tier on them.
      architecturalStyle: true,
      approximateAge: true,
    },
  });

  // Prisma Decimal/Date fields don't serialize through to a Client
  // Component cleanly — JSON.parse(JSON.stringify(...)) is the cheap fix
  // matching the existing /rentals/ads pattern.
  const listingSerialized = JSON.parse(JSON.stringify(listing));
  const sliderListingsSerialized = JSON.parse(JSON.stringify(sliderListings));

  return (
    <SalesAdsClient
      listing={listingSerialized}
      sliderListings={sliderListingsSerialized}
    />
  );
}
