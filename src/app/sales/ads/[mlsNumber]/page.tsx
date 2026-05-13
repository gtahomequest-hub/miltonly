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
const SLIDER_LIMIT = 10;

const TYPE_DISPLAY_LABEL: Record<string, string> = {
  condo: "Condo",
  detached: "Detached Home",
  semi: "Semi-Detached Home",
  townhouse: "Townhouse",
};

// Plural display label for the LiveListingSlider section kicker.
// Keys match the canonical lowercased propertyType values stored in the DB
// (see /rentals/ads page for the same set of canonical types).
const PROPERTY_TYPE_LABEL_PLURAL: Record<string, string> = {
  detached: "detached homes",
  semi: "semis",
  townhouse: "townhouses",
  condo: "condos",
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

  // Smart-blend slider — top 10 same-property-type active sale listings.
  // Priority:
  //   1. Same neighbourhood, sorted by closest price to the current listing.
  //   2. Other neighbourhoods, sorted by listedAt desc (newest first).
  // Prisma doesn't natively sort by "absolute price distance", so the
  // closest-price sort happens in memory after the same-neighbourhood
  // query. Both queries filter to the current listing's propertyType,
  // active status, sale transactionType, and permAdvertise=true. The
  // current listing's MLS is always excluded.
  const sameNeighbourhood = await prisma.listing.findMany({
    where: {
      transactionType: SALE_TX_TYPE,
      status: ACTIVE_STATUS,
      propertyType: listing.propertyType,
      neighbourhood: listing.neighbourhood,
      mlsNumber: { not: listing.mlsNumber },
      permAdvertise: true,
    },
    orderBy: { listedAt: "desc" }, // tiebreak before in-memory price sort
    take: SLIDER_LIMIT,
  });
  const sortedSameNeighbourhood = [...sameNeighbourhood].sort(
    (a, b) => Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price),
  );

  let sliderListings = sortedSameNeighbourhood;
  if (sliderListings.length < SLIDER_LIMIT) {
    const otherNeighbourhoods = await prisma.listing.findMany({
      where: {
        transactionType: SALE_TX_TYPE,
        status: ACTIVE_STATUS,
        propertyType: listing.propertyType,
        neighbourhood: { not: listing.neighbourhood },
        mlsNumber: { not: listing.mlsNumber },
        permAdvertise: true,
      },
      orderBy: { listedAt: "desc" },
      take: SLIDER_LIMIT - sliderListings.length,
    });
    sliderListings = [...sliderListings, ...otherNeighbourhoods].slice(0, SLIDER_LIMIT);
  }

  const propertyTypeLabel = PROPERTY_TYPE_LABEL_PLURAL[listing.propertyType?.toLowerCase()] || "sale listings";

  // Prisma Decimal/Date fields don't serialize through to a Client
  // Component cleanly — JSON.parse(JSON.stringify(...)) is the cheap fix
  // matching the existing /rentals/ads pattern.
  const listingSerialized = JSON.parse(JSON.stringify(listing));
  const sliderListingsSerialized = JSON.parse(JSON.stringify(sliderListings));

  return (
    <SalesAdsClient
      listing={listingSerialized}
      sliderListings={sliderListingsSerialized}
      propertyTypeLabel={propertyTypeLabel}
    />
  );
}
