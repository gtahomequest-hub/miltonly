"use client";

// src/components/places/PlaceListings.tsx
// Shared forest nearby-listings island for /mosques/[slug] + /schools/[slug]
// (replaces the byte-identical MosqueListings + SchoolListings). Same data
// contract + show-more behavior; forest styling.
//
// MC-036: the rows are cards from getListingCards (src/lib/listingsV2Data.ts), the gated
// mapper, so `address` is already "Address on request" for a withheld listing and the raw
// address is not in the payload to print. The interface below is the subset of
// ListingCardData this island reads.

import { useState } from "react";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";
import ListingBrokerage from "@/components/listings/ListingBrokerage";
import { config } from "@/lib/config";

interface Listing {
  mlsNumber: string;
  /** Gated server-side: the placeholder, never the raw address, for a withheld listing. */
  address: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string;
  photos: string[];
  listOfficeName?: string | null;
  // No listedAt (MC-029): a card carries no VOW-only column.
}

export default function PlaceListings({
  listings,
  placeName,
}: {
  listings: Listing[];
  placeName: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? listings : listings.slice(0, 6);

  if (listings.length === 0) {
    return (
      <div className="pl-lempty">
        <p style={{ marginBottom: 12 }}>No active listings near {placeName} right now</p>
        <Link href="/listings">Browse all {config.CITY_NAME} listings</Link>
      </div>
    );
  }

  return (
    <>
      <div className="pl-lgrid">
        {visible.map((l) => {
          return (
            <Link key={l.mlsNumber} href={`/listings/${l.mlsNumber}`} className="pl-lcard">
              <div className="pl-lphoto">
                {l.photos?.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0]} alt={l.address} loading="lazy" />
                )}
              </div>
              <div className="pl-lbody">
                <p className="pl-lprice" data-price>
                  {formatPriceFull(l.price)}
                  <ListingBrokerage name={l.listOfficeName} />
                </p>
                <p className="pl-laddr">{l.address}</p>
                <div className="pl-lspecs">
                  {l.bedrooms != null && <span>{l.bedrooms} bed</span>}
                  {l.bathrooms != null && <span>· {l.bathrooms} bath</span>}
                  <span>· {l.propertyType}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {listings.length > 6 && !showAll && (
        <div className="pl-lmore">
          <button onClick={() => setShowAll(true)}>Show all {listings.length} listings</button>
        </div>
      )}
    </>
  );
}
