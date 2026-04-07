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
    <section className="relative overflow-hidden bg-navy">
      {/* Subtle ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-brand-500/[0.07] rounded-full blur-[100px] pointer-events-none" />

      <div className="relative section-container section-padding-lg">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="section-label text-brand-400 tracking-[0.2em]">
            Milton Intelligence Centre
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-display-lg text-white mt-4 font-extrabold leading-tight">
            Data no other<br className="hidden sm:block" /> Milton site has
          </h2>
          <p className="text-lg text-white/40 mt-5 max-w-xl mx-auto leading-relaxed">
            The tool no other Milton site has built. Compare streets,
            neighbourhoods, and condo buildings with 10 data dimensions.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-white/[0.06] rounded-xl border border-white/[0.08] p-1.5 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === tab
                    ? "bg-brand-500 text-white shadow-glow-brand"
                    : "text-white/40 hover:text-white/70"
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
            <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 sm:p-8 lg:p-10">
              <p className="text-sm font-medium text-white/40 mb-5">
                What would you like to compare?
              </p>

              {/* Mode pills */}
              <div className="flex flex-wrap gap-2.5 mb-8">
                {compareModes.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setActiveMode(mode)}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all duration-200 ${
                      activeMode === mode
                        ? "bg-white text-navy border-white shadow-md"
                        : "bg-transparent border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="section-label text-brand-300 mb-2 block">
                    Left side
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Willmott"
                    className="w-full px-5 py-4 text-lg bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/30 transition-all"
                  />
                </div>
                <div>
                  <label className="section-label text-brand-300 mb-2 block">
                    Right side
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coates"
                    className="w-full px-5 py-4 text-lg bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/30 transition-all"
                  />
                </div>
              </div>

              {/* CTA */}
              <button className="w-full mt-8 px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white text-lg font-bold rounded-xl transition-all shadow-glow-brand">
                Compare Now
              </button>

              {/* Dimension hints */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-6 text-xs text-white/25">
                {["Avg Price", "Growth Trend", "Days on Market", "Sold vs Ask %", "Price/Sqft", "School Rating", "GO Walk Time", "Rental Yield", "Inventory", "Owner Ratio"].map((dim) => (
                  <span key={dim} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-brand-400/40 rounded-full" />
                    {dim}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Street Search" && (
            <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 sm:p-8 lg:p-10">
              <p className="text-white/40 mb-6">
                Search any Milton street for sold prices, trends, and market data
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder='Enter a street name — e.g. "Laurier Ave"'
                  className="flex-1 px-5 py-4 text-lg bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/30"
                />
                <button className="px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all shadow-glow-brand shrink-0">
                  Explore Street
                </button>
              </div>
            </div>
          )}

          {activeTab === "Condo Search" && (
            <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 sm:p-8 lg:p-10">
              <p className="text-white/40 mb-6">
                Search any Milton condo building for prices, rental yields, and more
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter building name or address"
                  className="flex-1 px-5 py-4 text-lg bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/30"
                />
                <button className="px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all shadow-glow-brand shrink-0">
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
