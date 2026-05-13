// Sales featured page — Server Component. Hit by cold paid Google Ads
// traffic. Fetches the listing by mlsNumber, validates it's active + for
// sale + format-clean, redirects to /rentals on any invalid case so we
// never waste ad spend on dead URLs. Pulls related listings (same
// neighbourhood, falling back to city) and renders the client wrapper.

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
const RELATED_LIMIT = 6;
const RELATED_NEIGHBOURHOOD_MIN = 3;

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

  // Related listings — same neighbourhood first, fall back to city if fewer
  // than RELATED_NEIGHBOURHOOD_MIN matches. Always excludes the current
  // listing's MLS.
  let related = await prisma.listing.findMany({
    where: {
      transactionType: SALE_TX_TYPE,
      status: ACTIVE_STATUS,
      neighbourhood: listing.neighbourhood,
      mlsNumber: { not: listing.mlsNumber },
      permAdvertise: true,
    },
    orderBy: { listedAt: "desc" },
    take: RELATED_LIMIT,
  });
  if (related.length < RELATED_NEIGHBOURHOOD_MIN) {
    related = await prisma.listing.findMany({
      where: {
        transactionType: SALE_TX_TYPE,
        status: ACTIVE_STATUS,
        city: listing.city,
        mlsNumber: { not: listing.mlsNumber },
        permAdvertise: true,
      },
      orderBy: { listedAt: "desc" },
      take: RELATED_LIMIT,
    });
  }

  // Prisma Decimal/Date fields don't serialize through to a Client
  // Component cleanly — JSON.parse(JSON.stringify(...)) is the cheap fix
  // matching the existing /rentals/ads pattern.
  const listingSerialized = JSON.parse(JSON.stringify(listing));
  const relatedSerialized = JSON.parse(JSON.stringify(related));

  return <SalesAdsClient listing={listingSerialized} relatedListings={relatedSerialized} />;
}
