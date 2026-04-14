"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";

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

export default function MosqueListings({
  listings,
  mosqueName,
}: {
  listings: Listing[];
  mosqueName: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? listings : listings.slice(0, 6);

  if (listings.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-[14px] text-[#94a3b8] mb-4">
          No active listings near {mosqueName} right now
        </p>
        <Link
          href="/listings"
          className="inline-block text-[13px] font-bold text-[#f59e0b] hover:underline"
        >
          Browse all Milton listings
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((l) => {
          const days = daysAgo(new Date(l.listedAt));
          return (
            <Link
              key={l.mlsNumber}
              href={`/listings/${l.mlsNumber}`}
              className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden hover:shadow-md transition-shadow group"
            >
              <div className="h-[140px] relative bg-gradient-to-br from-[#b0c4de] to-[#93a8c4]">
                {l.photos?.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.photos[0]}
                    alt={l.address}
                    className="w-full h-full object-cover"
                  />
                )}
                <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#07111f] text-[#f59e0b]">
                  {days === 0
                    ? "New today"
                    : days <= 7
                    ? "New this week"
                    : `${days}d on market`}
                </span>
              </div>
              <div className="p-4">
                <p className="text-[18px] font-extrabold text-[#07111f]">
                  {formatPriceFull(l.price)}
                </p>
                <p className="text-[12px] text-[#475569] mt-0.5 truncate">
                  {l.address}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-[#94a3b8]">
                  {l.bedrooms && <span>{l.bedrooms} bed</span>}
                  {l.bathrooms && <span>&middot; {l.bathrooms} bath</span>}
                  <span className="capitalize">&middot; {l.propertyType}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {listings.length > 6 && !showAll && (
        <div className="text-center mt-6">
          <button
            onClick={() => setShowAll(true)}
            className="text-[13px] font-bold text-[#07111f] bg-white border border-[#e2e8f0] px-6 py-2.5 rounded-xl hover:border-[#07111f] transition-colors"
          >
            Show all {listings.length} listings
          </button>
        </div>
      )}
    </>
  );
}
