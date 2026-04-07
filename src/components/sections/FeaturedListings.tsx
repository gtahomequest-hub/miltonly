"use client";

import { useState } from "react";
import Link from "next/link";

const listingTabs = ["New This Week", "Price Drops", "Open Houses"] as const;

// Placeholder listings — will be replaced with TREB API data
const placeholderListings = [
  {
    id: "1",
    address: "142 Laurier Ave",
    price: "$1,089,000",
    beds: 4,
    baths: 3,
    type: "Detached",
    daysListed: 3,
    neighbourhood: "Willmott",
  },
  {
    id: "2",
    address: "88 Derry Road W",
    price: "$749,900",
    beds: 3,
    baths: 2,
    type: "Townhouse",
    daysListed: 7,
    neighbourhood: "Coates",
  },
  {
    id: "3",
    address: "310 Main St E, Unit 405",
    price: "$599,000",
    beds: 2,
    baths: 2,
    type: "Condo",
    daysListed: 1,
    neighbourhood: "Old Milton",
  },
  {
    id: "4",
    address: "55 Clarke Blvd",
    price: "$1,275,000",
    beds: 4,
    baths: 4,
    type: "Detached",
    daysListed: 5,
    neighbourhood: "Clarke",
  },
  {
    id: "5",
    address: "201 Scott Blvd",
    price: "$925,000",
    beds: 3,
    baths: 3,
    type: "Semi-Detached",
    daysListed: 2,
    neighbourhood: "Scott",
  },
  {
    id: "6",
    address: "78 Beaty St",
    price: "$1,150,000",
    beds: 4,
    baths: 3,
    type: "Detached",
    daysListed: 4,
    neighbourhood: "Beaty",
  },
];

export default function FeaturedListings() {
  const [activeTab, setActiveTab] =
    useState<(typeof listingTabs)[number]>("New This Week");

  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900">
              Featured Milton Listings
            </h2>
            <p className="text-neutral-600 mt-1">
              Updated daily from TREB. Personalised to your search.
            </p>
          </div>
          <Link
            href="/listings"
            className="text-brand-600 hover:text-brand-700 font-semibold text-sm shrink-0"
          >
            View all listings &rarr;
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-neutral-100">
          {listingTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
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
              className="group bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Photo placeholder */}
              <div className="aspect-[4/3] bg-neutral-100 relative">
                <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
                </div>
                {listing.daysListed <= 3 && (
                  <span className="absolute top-3 left-3 bg-accent-500 text-white text-xs font-semibold px-2 py-1 rounded">
                    NEW
                  </span>
                )}
                {/* Heart button */}
                <button
                  className="absolute top-3 right-3 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center transition-colors"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Save listing"
                >
                  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                </button>
              </div>

              {/* Card details */}
              <div className="p-4">
                <p className="text-xl font-bold text-neutral-900">
                  {listing.price}
                </p>
                <p className="text-sm text-neutral-700 font-medium mt-1">
                  {listing.address}
                </p>
                <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
                  <span>{listing.beds} bed</span>
                  <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                  <span>{listing.baths} bath</span>
                  <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                  <span>{listing.type}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                  <span className="text-xs text-neutral-400">
                    {listing.daysListed} days listed
                  </span>
                  <span className="text-xs text-brand-600 font-medium">
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
