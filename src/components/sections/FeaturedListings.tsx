"use client";

import { useState } from "react";
import Link from "next/link";

const listingTabs = ["New This Week", "Price Drops", "Open Houses"] as const;

const placeholderListings = [
  { id: "1", address: "142 Laurier Ave", price: "$1,089,000", beds: 4, baths: 3, type: "Detached", daysListed: 3, neighbourhood: "Willmott", tag: "new" as const },
  { id: "2", address: "88 Derry Road W", price: "$749,900", beds: 3, baths: 2, type: "Townhouse", daysListed: 7, neighbourhood: "Coates", tag: "price-drop" as const },
  { id: "3", address: "310 Main St E, Unit 405", price: "$599,000", beds: 2, baths: 2, type: "Condo", daysListed: 1, neighbourhood: "Old Milton", tag: "new" as const },
  { id: "4", address: "55 Clarke Blvd", price: "$1,275,000", beds: 4, baths: 4, type: "Detached", daysListed: 5, neighbourhood: "Clarke", tag: "open-house" as const },
  { id: "5", address: "201 Scott Blvd", price: "$925,000", beds: 3, baths: 3, type: "Semi", daysListed: 2, neighbourhood: "Scott", tag: "new" as const },
  { id: "6", address: "78 Beaty St", price: "$1,150,000", beds: 4, baths: 3, type: "Detached", daysListed: 4, neighbourhood: "Beaty", tag: "price-drop" as const },
];

const tagConfig = {
  "new": { label: "NEW", className: "bg-accent-500 text-white" },
  "price-drop": { label: "PRICE DROP", className: "bg-orange-500 text-white" },
  "open-house": { label: "OPEN HOUSE", className: "bg-brand-500 text-white" },
};

export default function FeaturedListings() {
  const [activeTab, setActiveTab] = useState<(typeof listingTabs)[number]>("New This Week");

  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <span className="section-label text-brand-500">Featured Listings</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
              Milton Homes For Sale
            </h2>
          </div>
          <Link
            href="/listings"
            className="text-brand-500 hover:text-brand-600 font-semibold text-sm shrink-0 flex items-center gap-1"
          >
            View all listings
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8">
          {listingTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? "bg-navy text-white"
                  : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Listing cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {placeholderListings.map((listing) => (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="card card-hover group overflow-hidden"
            >
              <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
                </div>
                <span className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-md ${tagConfig[listing.tag].className}`}>
                  {tagConfig[listing.tag].label}
                </span>
                <button
                  className="absolute top-3 right-3 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-all"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Save listing"
                >
                  <svg className="w-4 h-4 text-neutral-400 hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                </button>
              </div>
              <div className="p-5">
                <p className="text-2xl font-extrabold text-navy">
                  {listing.price}
                </p>
                <p className="text-sm text-neutral-600 font-medium mt-1.5">
                  {listing.address}
                </p>
                <div className="flex items-center gap-3 mt-2.5 text-sm text-neutral-400">
                  <span>{listing.beds} bed</span>
                  <span className="w-1 h-1 bg-neutral-200 rounded-full" />
                  <span>{listing.baths} bath</span>
                  <span className="w-1 h-1 bg-neutral-200 rounded-full" />
                  <span>{listing.type}</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs text-neutral-400">
                    {listing.daysListed}d on market
                  </span>
                  <span className="text-xs text-brand-500 font-semibold">
                    Compare to street avg
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
