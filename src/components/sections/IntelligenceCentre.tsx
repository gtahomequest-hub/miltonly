"use client";

import { useState } from "react";
import Link from "next/link";

const modes = ["Street vs Street", "Neighbourhood vs Neighbourhood", "Building vs Building", "Listing vs Area Avg", "Buy vs Rent"];
const dims = ["Avg price", "Growth trend", "Days on market", "Sold vs ask %", "Price/sqft", "School rating", "GO walk time", "Rental yield", "Inventory", "Owner ratio"];

type Tab = "compare" | "street" | "condo";

export default function IntelligenceCentre() {
  const [activeTab, setActiveTab] = useState<Tab>("compare");
  const [activeMode, setActiveMode] = useState(modes[0]);
  const [leftInput, setLeftInput] = useState("");
  const [rightInput, setRightInput] = useState("");
  const [streetInput, setStreetInput] = useState("");

  return (
    <section className="bg-[#07111f] px-5 sm:px-11 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-2">
            Milton Intelligence Centre
          </p>
          <h2 className="text-[24px] sm:text-[28px] font-extrabold text-white tracking-[-0.3px] mb-2">
            Data no other Milton site has
          </h2>
          <p className="text-[14px] text-[#94a3b8] max-w-lg mx-auto">
            Compare streets, neighbourhoods and buildings across 10 data dimensions. Updated daily from TREB.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-1 mb-6">
          {([
            { key: "compare" as Tab, label: "Compare" },
            { key: "street" as Tab, label: "Street Search" },
            { key: "condo" as Tab, label: "Condo Search" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-[12px] font-semibold px-5 py-2 rounded-full border transition-all ${
                activeTab === tab.key
                  ? "bg-[#f59e0b] border-[#f59e0b] text-[#07111f]"
                  : "border-[#334155] text-[#cbd5e1] hover:text-white hover:border-[#64748b]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-6 sm:p-8">
          {activeTab === "compare" && (
            <>
              {/* Mode pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {modes.map((m) => (
                  <button
                    key={m}
                    onClick={() => setActiveMode(m)}
                    className={`text-[11px] font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                      activeMode === m
                        ? "bg-[rgba(245,158,11,0.15)] border-[#f59e0b] text-[#f59e0b] font-bold"
                        : "bg-[#07111f] border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#64748b]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end mb-5">
                <div>
                  <label className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.08em] mb-1.5 block">
                    Left side
                  </label>
                  <input
                    type="text"
                    value={leftInput}
                    onChange={(e) => setLeftInput(e.target.value)}
                    placeholder={activeMode.includes("Street") ? "e.g. Laurier Ave" : activeMode.includes("Neighbourhood") ? "e.g. Willmott" : "e.g. Bronte Condos"}
                    className="w-full bg-[#07111f] border-[1.5px] border-[#334155] rounded-lg px-3 py-3 text-[13px] text-white placeholder:text-[#64748b] outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
                <span className="hidden sm:block text-[12px] text-[#64748b] font-bold pb-3">vs</span>
                <div>
                  <label className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.08em] mb-1.5 block">
                    Right side
                  </label>
                  <input
                    type="text"
                    value={rightInput}
                    onChange={(e) => setRightInput(e.target.value)}
                    placeholder={activeMode.includes("Street") ? "e.g. Derry Rd" : activeMode.includes("Neighbourhood") ? "e.g. Coates" : "e.g. Ivy Ridge"}
                    className="w-full bg-[#07111f] border-[1.5px] border-[#334155] rounded-lg px-3 py-3 text-[13px] text-white placeholder:text-[#64748b] outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
              </div>

              {/* CTA */}
              <Link href="/compare" className="block w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold rounded-xl py-3.5 mb-5 hover:bg-[#eab308] transition-colors text-center">
                Compare Now
              </Link>

              {/* Dimensions */}
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold mb-2">Dimensions compared</p>
              <div className="flex flex-wrap gap-1.5">
                {dims.map((d) => (
                  <span key={d} className="text-[10px] font-medium text-[#94a3b8] bg-[#07111f] border border-[#334155] rounded-full px-2.5 py-1">
                    {d}
                  </span>
                ))}
              </div>
            </>
          )}

          {activeTab === "street" && (
            <>
              <p className="text-[13px] text-[#94a3b8] mb-4">
                Search any Milton street for sold prices, trends, and market data.
              </p>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <input
                    type="text"
                    value={streetInput}
                    onChange={(e) => setStreetInput(e.target.value)}
                    placeholder="Type any Milton street name"
                    className="w-full pl-9 pr-3 py-3 bg-[#07111f] border-[1.5px] border-[#334155] rounded-lg text-[13px] text-white placeholder:text-[#64748b] outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
                <Link
                  href={streetInput ? `/streets/${streetInput.toLowerCase().replace(/\s+/g, "-")}-milton` : "/streets"}
                  className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-3 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors flex items-center"
                >
                  Explore
                </Link>
              </div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold mb-2">Popular streets</p>
              <div className="flex flex-wrap gap-1.5">
                {["Derry Rd", "Main St E", "Thompson Rd", "Laurier Ave", "Scott Blvd", "Savoline Blvd"].map((s) => (
                  <Link
                    key={s}
                    href={`/streets/${s.toLowerCase().replace(/\s+/g, "-")}-milton`}
                    className="text-[11px] text-[#cbd5e1] bg-[#07111f] border border-[#334155] rounded-full px-3 py-1 hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </>
          )}

          {activeTab === "condo" && (
            <>
              <p className="text-[13px] text-[#94a3b8] mb-4">
                Search any Milton condo building for prices, rental yields, and maintenance fees.
              </p>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  <input
                    type="text"
                    placeholder="Type a condo building name or address"
                    className="w-full pl-9 pr-3 py-3 bg-[#07111f] border-[1.5px] border-[#334155] rounded-lg text-[13px] text-white placeholder:text-[#64748b] outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
                <Link href="/condos" className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-3 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors flex items-center">
                  Explore
                </Link>
              </div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold mb-2">Popular buildings</p>
              <div className="flex flex-wrap gap-1.5">
                {["Bronte Condos", "Main Street Lofts", "Milton Garden", "Ivy Ridge", "Thompson Towers"].map((c) => (
                  <Link
                    key={c}
                    href={`/condos/${c.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[11px] text-[#cbd5e1] bg-[#07111f] border border-[#334155] rounded-full px-3 py-1 hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
