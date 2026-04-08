"use client";

import { useState } from "react";
import Link from "next/link";

const listingTabs = ["New this week", "Price drops", "Open houses"] as const;

const listings = [
  {
    id: "1", price: "$1,189,000", address: "142 Laurier Ave, Willmott",
    beds: 4, baths: 3, park: 2, type: "Detached", daysText: "Listed today",
    tag: "New today", tagBg: "#07111f", tagText: "#f59e0b", imgBg: "#b0c4de",
  },
  {
    id: "2", price: "$874,900", address: "38 Derry Rd E, Coates",
    beds: 3, baths: 2, park: 1, type: "Townhouse", daysText: "14 days on market",
    tag: "↓ Price drop $25K", tagBg: "#ef4444", tagText: "#fff", imgBg: "#93a8c4",
  },
  {
    id: "3", price: "$1,449,000", address: "91 Thompson Rd S, Clarke",
    beds: 5, baths: 4, park: 2, type: "Detached", daysText: "3 days on market",
    tag: "Open house Sun 2–4pm", tagBg: "#2563eb", tagText: "#fff", imgBg: "#7b91ad",
  },
];

export default function FeaturedListings() {
  const [activeTab, setActiveTab] = useState<(typeof listingTabs)[number]>("New this week");

  return (
    <section className="bg-[#f8fafc] px-5 sm:px-11 py-9">
      {/* Header */}
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

      {/* Tabs */}
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

      {/* Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {listings.map((l) => (
          <Link key={l.id} href={`/listings/${l.id}`} className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden hover:shadow-md transition-shadow group">
            {/* Image */}
            <div className="h-[148px] relative" style={{ background: l.imgBg }}>
              <span
                className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: l.tagBg, color: l.tagText }}
              >
                {l.tag}
              </span>
            </div>
            {/* Body */}
            <div className="p-4">
              <p className="text-[19px] font-extrabold text-[#07111f] tracking-[-0.3px]">{l.price}</p>
              <p className="text-[12px] text-[#64748b] mt-[3px]">{l.address}</p>
              <div className="flex flex-wrap gap-x-[14px] gap-y-1 mt-3 pt-3 border-t border-[#f8fafc]">
                {[
                  { label: "Bed", value: l.beds },
                  { label: "Bath", value: l.baths },
                  { label: "Park", value: l.park },
                  { label: "", value: l.type },
                  { label: "", value: l.daysText },
                ].map((d, i) => (
                  <span key={i} className="text-[11px]">
                    {d.label && <span className="text-[#94a3b8] font-medium">{d.label} </span>}
                    <span className="text-[#475569] font-bold">{d.value}</span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-[#94a3b8] mt-[6px] group-hover:text-[#2563eb] transition-colors">
                Compare to street avg →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
