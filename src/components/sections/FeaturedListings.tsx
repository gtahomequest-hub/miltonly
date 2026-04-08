"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";

interface Listing {
  id: string;
  mlsNumber: string;
  address: string;
  neighbourhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  status: string;
  photos: string[];
  listedAt: Date | string;
}

const listingTabs = ["New this week", "Best value", "Newest"] as const;

interface Props {
  listings: {
    newThisWeek: Listing[];
    priceDrops: Listing[];
    openHouses: Listing[];
  };
}

function getBadge(listing: Listing): { text: string; bg: string; color: string } {
  const days = daysAgo(new Date(listing.listedAt));
  if (days === 0) return { text: "New today", bg: "#07111f", color: "#f59e0b" };
  if (days <= 7) return { text: "New this week", bg: "#07111f", color: "#f59e0b" };
  if (days > 14) return { text: `${days}d on market`, bg: "#64748b", color: "#fff" };
  return { text: `${days}d on market`, bg: "#2563eb", color: "#fff" };
}

function ListingCard({ listing }: { listing: Listing }) {
  const badge = getBadge(listing);
  const days = daysAgo(new Date(listing.listedAt));

  return (
    <Link
      href={`/listings/${listing.mlsNumber}`}
      className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className="h-[148px] relative bg-gradient-to-br from-[#b0c4de] to-[#93a8c4]">
        {listing.photos.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photos[0]} alt={listing.address} className="w-full h-full object-cover" />
        )}
        <span
          className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.text}
        </span>
      </div>
      <div className="p-4">
        <p className="text-[19px] font-extrabold text-[#07111f] tracking-[-0.3px]">
          {formatPriceFull(listing.price)}
        </p>
        <p className="text-[12px] text-[#64748b] mt-[3px] truncate">{listing.address}</p>
        <div className="flex flex-wrap gap-x-[14px] gap-y-1 mt-3 pt-3 border-t border-[#f8fafc]">
          <span className="text-[11px]"><span className="text-[#94a3b8]">Bed </span><span className="text-[#475569] font-bold">{listing.bedrooms}</span></span>
          <span className="text-[11px]"><span className="text-[#94a3b8]">Bath </span><span className="text-[#475569] font-bold">{listing.bathrooms}</span></span>
          {listing.parking > 0 && <span className="text-[11px]"><span className="text-[#94a3b8]">Park </span><span className="text-[#475569] font-bold">{listing.parking}</span></span>}
          <span className="text-[11px] text-[#475569] font-bold capitalize">{listing.propertyType}</span>
          <span className="text-[11px] text-[#475569] font-bold">{days === 0 ? "Listed today" : `${days}d on market`}</span>
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-[6px] group-hover:text-[#2563eb] transition-colors">
          Compare to street avg →
        </p>
      </div>
    </Link>
  );
}

export default function FeaturedListings({ listings }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof listingTabs)[number]>("New this week");

  const currentListings = activeTab === "New this week"
    ? listings.newThisWeek
    : activeTab === "Best value"
    ? listings.priceDrops
    : listings.openHouses;

  return (
    <section className="bg-[#f8fafc] px-5 sm:px-11 py-9">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-[0.12em] mb-[6px]">
            Live TREB data · updated daily
          </p>
          <h2 className="text-[22px] font-extrabold text-[#07111f] tracking-[-0.3px]">
            Featured Milton listings
          </h2>
        </div>
        <Link href="/listings" className="text-[13px] text-[#2563eb] font-semibold hover:underline shrink-0">
          Browse all listings →
        </Link>
      </div>

      <div className="flex gap-1 mb-5">
        {listingTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[12px] font-semibold px-4 py-[6px] rounded-full border transition-all ${
              activeTab === tab
                ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                : "bg-white border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {currentListings.length > 0 ? (
          currentListings.map((l) => <ListingCard key={l.mlsNumber} listing={l} />)
        ) : (
          <p className="text-[13px] text-[#94a3b8] col-span-3 text-center py-8">No listings in this category right now.</p>
        )}
      </div>
    </section>
  );
}
