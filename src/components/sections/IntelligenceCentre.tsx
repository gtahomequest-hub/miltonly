"use client";

import { useState } from "react";

const tabs = ["Compare", "Street Search", "Condo Search"] as const;

const compareModes = [
  "Street vs Street",
  "Neighbourhood vs Neighbourhood",
  "Building vs Building",
  "Listing vs Area Avg",
  "Buy vs Rent",
];

export default function IntelligenceCentre() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Compare");
  const [activeMode, setActiveMode] = useState(compareModes[0]);

  return (
    <section className="relative overflow-hidden">
      {/* Match hero background exactly */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800 to-neutral-900" />
      <div className="absolute inset-0 bg-black/30" />
      {/* Subtle gradient glow behind content */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-500/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative section-container py-16 sm:py-20 lg:py-24">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-400 uppercase tracking-widest">
            <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
            Milton Intelligence Centre
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-4 leading-tight">
            Data no other<br className="hidden sm:block" /> Milton site has
          </h2>
          <p className="text-lg text-neutral-400 mt-4 max-w-2xl mx-auto">
            The tool no other Milton site has built. Compare streets,
            neighbourhoods, and condo buildings with 10 data dimensions —
            all powered by live TREB data.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-3xl mx-auto">
          {activeTab === "Compare" && (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8 lg:p-10">
              {/* Mode selector pills */}
              <p className="text-sm font-medium text-neutral-400 mb-4">
                What would you like to compare?
              </p>
              <div className="flex flex-wrap gap-2.5 mb-8">
                {compareModes.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setActiveMode(mode)}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all ${
                      activeMode === mode
                        ? "bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/20"
                        : "bg-white/5 border-white/10 text-neutral-300 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Input boxes */}
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-brand-400 uppercase tracking-widest">
                    Left side
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Willmott"
                    className="w-full mt-2 px-5 py-4 text-lg bg-white/10 border border-white/15 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brand-400 uppercase tracking-widest">
                    Right side
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coates"
                    className="w-full mt-2 px-5 py-4 text-lg bg-white/10 border border-white/15 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Compare button */}
              <button className="w-full mt-8 px-6 py-4 bg-accent-500 hover:bg-accent-600 text-white text-lg font-bold rounded-xl transition-colors shadow-lg shadow-accent-500/25">
                Compare Now
              </button>

              {/* Data dimension hints */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-6 text-xs text-neutral-500">
                {[
                  "Avg Price",
                  "Growth Trend",
                  "Days on Market",
                  "Sold vs Ask %",
                  "Price/Sqft",
                  "School Rating",
                  "GO Walk Time",
                  "Rental Yield",
                  "Inventory",
                  "Owner Ratio",
                ].map((dim) => (
                  <span key={dim} className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-brand-500/60 rounded-full" />
                    {dim}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Street Search" && (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8 lg:p-10">
              <p className="text-neutral-400 mb-6">
                Search any Milton street for sold prices, trends, and market data
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder='Enter a street name — e.g. "Laurier Ave"'
                  className="flex-1 px-5 py-4 text-lg bg-white/10 border border-white/15 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
                <button className="px-6 py-4 bg-accent-500 hover:bg-accent-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-accent-500/25 shrink-0">
                  Explore Street
                </button>
              </div>
            </div>
          )}

          {activeTab === "Condo Search" && (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8 lg:p-10">
              <p className="text-neutral-400 mb-6">
                Search any Milton condo building for prices, rental yields, and more
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter building name or address"
                  className="flex-1 px-5 py-4 text-lg bg-white/10 border border-white/15 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
                <button className="px-6 py-4 bg-accent-500 hover:bg-accent-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-accent-500/25 shrink-0">
                  Explore Building
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
