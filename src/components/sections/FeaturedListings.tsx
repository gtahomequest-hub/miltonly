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
  sqft?: number | null;
}

type FunctionalTab = "New this week" | "Best value" | "Newest";

const listingTabs: { label: string; visual: boolean }[] = [
  { label: "New this week", visual: false },
  { label: "Open House", visual: true },
  { label: "Best value", visual: false },
  { label: "Newest", visual: false },
  { label: "Under $800K", visual: true },
];

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
        {listing.sqft && (
          <p className="text-[12px] text-[#475569] mt-1.5 font-medium">
            {listing.sqft.toLocaleString()} sqft  ·  <span className="text-[#f59e0b]">${Math.round(listing.price / listing.sqft)}/sqft</span>
          </p>
        )}
        <p className="text-[11px] text-[#475569] mt-[6px] font-semibold group-hover:text-[#f59e0b] transition-colors">
          Compare to street avg →
        </p>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* TODO: open showing modal */ }}
          className="mt-3 w-full text-center text-[12px] font-bold py-2 rounded-lg bg-[#f59e0b] text-[#07111f] hover:bg-[#fbbf24] transition-colors"
        >
          📅 Book a showing
        </button>
      </div>
    </Link>
  );
}

export default function FeaturedListings({ listings }: Props) {
  const [activeTab, setActiveTab] = useState<FunctionalTab>("New this week");

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
            Live TREB data · updated every 15 min
          </p>
          <h2 className="text-[22px] font-extrabold text-[#07111f] tracking-[-0.3px]">
            Hand-picked Milton listings
          </h2>
          <p className="text-[14px] text-[#64748b] mt-2 max-w-[640px]">
            Aamir personally vets every listing. Real photos, real square footage, real numbers — no stock images, no inflated estimates.
          </p>
        </div>
        <Link href="/listings" className="text-[13px] text-[#f59e0b] font-semibold hover:underline shrink-0">
          Browse all listings →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {listingTabs.map((tab) => {
          const isActive = !tab.visual && activeTab === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => { if (!tab.visual) setActiveTab(tab.label as FunctionalTab); }}
              className={`text-[12px] font-semibold px-4 py-[6px] rounded-full border transition-all ${
                isActive
                  ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                  : "bg-white border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 mb-5 bg-white border border-[#e2e8f0] rounded-[12px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-[#475569]">
          <span className="font-bold text-[#07111f]">Save this search</span> — get an email when a new home matching your filters hits the market.
        </p>
        <button
          type="button"
          className="text-[12px] font-bold px-4 py-2 rounded-full bg-[#07111f] text-[#f59e0b] border border-[#07111f] hover:bg-[#0c1e35] transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          🔔 Set up alerts →
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {currentListings.length > 0 ? (
          currentListings.map((l) => <ListingCard key={l.mlsNumber} listing={l} />)
        ) : (
          <p className="text-[13px] text-[#94a3b8] col-span-3 text-center py-8">No listings in this category right now.</p>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="tel:+16478399090"
          className="text-[14px] font-bold px-6 py-3 rounded-full bg-[#f59e0b] text-[#07111f] hover:bg-[#fbbf24] transition-colors text-center"
        >
          📞 Tour any of these with Aamir
        </a>
        <a
          href="/listings"
          className="text-[14px] font-bold px-6 py-3 rounded-full bg-white text-[#07111f] border-2 border-[#07111f] hover:bg-[#f8fafc] transition-colors text-center"
        >
          Browse all listings →
        </a>
      </div>
    </section>
  );
}
