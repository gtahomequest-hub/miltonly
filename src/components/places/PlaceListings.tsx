"use client";

// src/components/places/PlaceListings.tsx
// Shared forest nearby-listings island for /mosques/[slug] + /schools/[slug]
// (replaces the byte-identical MosqueListings + SchoolListings). Same data
// contract + show-more behavior; forest styling.

import { useState } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";
import { config } from "@/lib/config";

interface Listing {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string;
  photos: string[];
  listedAt: string;
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
          const days = daysAgo(new Date(l.listedAt));
          return (
            <Link key={l.mlsNumber} href={`/listings/${l.mlsNumber}`} className="pl-lcard">
              <div className="pl-lphoto">
                {l.photos?.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0]} alt={l.address} loading="lazy" />
                )}
                <span className="pl-ltag">
                  {days === 0 ? "New today" : days <= 7 ? "New this week" : `${days}d on market`}
                </span>
              </div>
              <div className="pl-lbody">
                <p className="pl-lprice">{formatPriceFull(l.price)}</p>
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
