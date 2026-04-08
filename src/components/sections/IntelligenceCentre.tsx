"use client";

import { useState } from "react";

const tabs = ["Compare", "Street Search", "Condo Search"] as const;
const modes = ["Street vs Street", "Neighbourhood vs Neighbourhood", "Building vs Building", "Listing vs Area Avg", "Buy vs Rent"];
const dims = ["Avg price", "Growth trend", "Days on market", "Sold vs ask %", "Price/sqft", "School rating", "GO walk time", "Rental yield", "Inventory", "Owner ratio"];

export default function IntelligenceCentre() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Compare");
  const [activeMode, setActiveMode] = useState(modes[0]);

  return (
    <section className="bg-[#07111f] px-5 sm:px-11 py-11">
      {/* Header */}
      <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-2">
        Milton Intelligence Centre
      </p>
      <h2 className="text-[24px] font-extrabold text-[#f1f5f9] tracking-[-0.3px] mb-[6px]">
        Data no other Milton site has
      </h2>
      <p className="text-[13px] text-[#334155] mb-5 max-w-xl">
        Compare streets, neighbourhoods and buildings — 10 data dimensions, updated daily from TREB.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[12px] font-semibold px-[18px] py-[7px] rounded-full border transition-all ${
              activeTab === tab
                ? "bg-[#f59e0b] border-[#f59e0b] text-[#07111f]"
                : "border-[#1e3a5f] text-[#475569] hover:text-[#94a3b8]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-[14px] p-[22px]">
        {activeTab === "Compare" && (
          <>
            {/* Mode pills */}
            <div className="flex flex-wrap gap-[7px] mb-[18px]">
              {modes.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMode(m)}
                  className={`text-[11px] font-medium px-[13px] py-[6px] rounded-full border transition-all ${
                    activeMode === m
                      ? "bg-[rgba(245,158,11,0.15)] border-[#f59e0b] text-[#f59e0b] font-bold"
                      : "bg-[#07111f] border-[#1e3a5f] text-[#334155] hover:text-[#64748b]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="grid sm:grid-cols-2 gap-3 mb-[14px]">
              <div>
                <label className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.08em] mb-[6px] block">Left side</label>
                <input
                  type="text"
                  placeholder="e.g. Willmott"
                  className="w-full bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-lg px-3 py-[11px] text-[13px] text-[#cbd5e1] placeholder:text-[#1e3a5f] outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.08em] mb-[6px] block">Right side</label>
                <input
                  type="text"
                  placeholder="e.g. Coates"
                  className="w-full bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-lg px-3 py-[11px] text-[13px] text-[#cbd5e1] placeholder:text-[#1e3a5f] outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
            </div>

            {/* CTA */}
            <button className="w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold rounded-[10px] py-[13px] mb-[14px] hover:bg-[#eab308] transition-colors">
              Compare Now
            </button>

            {/* Dimensions */}
            <div className="flex flex-wrap gap-[6px]">
              {dims.map((d) => (
                <span key={d} className="text-[10px] font-medium text-[#475569] bg-[#07111f] border border-[#1e3a5f] rounded-full px-2.5 py-1">
                  {d}
                </span>
              ))}
            </div>
          </>
        )}

        {activeTab === "Street Search" && (
          <>
            <p className="text-[13px] text-[#475569] mb-4">Search any Milton street for sold prices, trends, and market data</p>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <input type="text" placeholder='Type any Milton street name — e.g. Laurier Ave' className="w-full pl-9 pr-3 py-[11px] bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-lg text-[13px] text-[#cbd5e1] placeholder:text-[#1e3a5f] outline-none focus:border-[#f59e0b] transition-colors" />
              </div>
              <button className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-[11px] rounded-lg shrink-0 hover:bg-[#eab308] transition-colors">Explore</button>
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {["Derry Rd", "Main St E", "Thompson Rd", "Laurier Ave", "Louis St. Laurent"].map((s) => (
                <span key={s} className="text-[11px] text-[#475569] bg-[#07111f] border border-[#1e3a5f] rounded-full px-2.5 py-1 cursor-pointer hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors">{s}</span>
              ))}
            </div>
          </>
        )}

        {activeTab === "Condo Search" && (
          <>
            <p className="text-[13px] text-[#475569] mb-4">Search any Milton condo building for prices, rental yields, and more</p>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                <input type="text" placeholder="Type a condo building name or address" className="w-full pl-9 pr-3 py-[11px] bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-lg text-[13px] text-[#cbd5e1] placeholder:text-[#1e3a5f] outline-none focus:border-[#f59e0b] transition-colors" />
              </div>
              <button className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-[11px] rounded-lg shrink-0 hover:bg-[#eab308] transition-colors">Explore</button>
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {["Bronte Condos", "Main Street Lofts", "Milton Garden", "Ivy Ridge", "Thompson Towers"].map((c) => (
                <span key={c} className="text-[11px] text-[#475569] bg-[#07111f] border border-[#1e3a5f] rounded-full px-2.5 py-1 cursor-pointer hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors">{c}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
