"use client";

import { useState, useCallback } from "react";

const tabs = ["Compare", "Street Search", "Condo Search"] as const;

const compareModes = [
  "Street vs Street",
  "Neighbourhood vs Neighbourhood",
  "Building vs Building",
  "Listing vs Area Avg",
  "Buy vs Rent",
];

const dimensions = [
  "Avg Price", "Growth Trend", "Days on Market", "Sold vs Ask %", "Price/Sqft",
  "School Rating", "GO Walk Time", "Rental Yield", "Inventory", "Owner Ratio",
];

const popularStreets = ["Derry Road", "Main Street", "Louis St. Laurent", "Thompson", "Laurier Ave"];
const popularCondos = ["Bronte Condos", "Main Street Lofts", "Milton Garden", "Ivy Ridge", "Thompson Towers"];

// Mock comparison results
const mockResults = [
  { metric: "Avg Sold Price", left: "$1,125,000", right: "$985,000", winner: "right" },
  { metric: "Price Growth (1yr)", left: "+3.2%", right: "+4.8%", winner: "right" },
  { metric: "Days on Market", left: "18", right: "14", winner: "right" },
  { metric: "Sold vs Ask %", left: "98.5%", right: "101.2%", winner: "right" },
  { metric: "Price / Sqft", left: "$485", right: "$412", winner: "right" },
  { metric: "School Rating", left: "8.4", right: "7.9", winner: "left" },
  { metric: "GO Walk Time", left: "12 min", right: "20 min", winner: "left" },
  { metric: "Rental Yield", left: "3.8%", right: "4.2%", winner: "right" },
  { metric: "Inventory (months)", left: "2.1", right: "1.8", winner: "right" },
  { metric: "Owner Ratio", left: "82%", right: "76%", winner: "left" },
];

export default function IntelligenceCentre() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Compare");
  const [activeMode, setActiveMode] = useState(compareModes[0]);
  const [leftValue, setLeftValue] = useState("");
  const [rightValue, setRightValue] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = useCallback(() => {
    if (!leftValue || !rightValue) return;
    setIsComparing(true);
    setShowResults(false);
    setTimeout(() => {
      setIsComparing(false);
      setShowResults(true);
    }, 800);
  }, [leftValue, rightValue]);

  return (
    <section className="bg-white border-y border-neutral-200">
      <div className="section-container section-padding-lg">
        {/* Header — on white background */}
        <div className="text-center mb-10">
          <span className="section-label text-brand-500 tracking-[0.2em]">
            Milton Intelligence Centre
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-display-lg text-navy mt-4 font-extrabold leading-tight">
            Data no other<br className="hidden sm:block" /> Milton site has
          </h2>
          <p className="text-lg text-neutral-500 mt-5 max-w-xl mx-auto leading-relaxed">
            The tool no other Milton site has built. Compare streets,
            neighbourhoods, and condo buildings with 10 data dimensions.
          </p>
        </div>

        {/* Tabs — on white background, pill-shaped */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-neutral-100 rounded-full p-1 gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setShowResults(false); }}
                className={`px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-150 ${
                  activeTab === tab
                    ? "bg-navy text-white shadow-md"
                    : "text-neutral-500 hover:text-navy hover:bg-navy/5"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Dark card — all tab content lives inside */}
        <div className="max-w-3xl mx-auto">
          {/* Shimmer border wrapper */}
          <div className="relative rounded-2xl p-px bg-gradient-to-br from-brand-400/30 via-brand-500/10 to-brand-400/20 shadow-[0_8px_40px_rgba(10,22,40,0.15)]">
            {/* Animated shimmer */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(59,130,246,0.12)_50%,transparent_75%)] bg-[length:250%_100%] animate-[shimmer_3s_ease-in-out_infinite]" />
            </div>

            {/* Card inner */}
            <div className="relative bg-gradient-to-b from-[#0A1628] to-[#0F2044] rounded-[15px] p-6 sm:p-8">

              {/* ═══ COMPARE TAB ═══ */}
              {activeTab === "Compare" && (
                <div className="transition-all duration-150">
                  <p className="text-sm font-medium text-white/40 mb-5">
                    What would you like to compare?
                  </p>

                  {/* Mode pills */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {compareModes.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={`px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all duration-150 ${
                          activeMode === mode
                            ? "bg-brand-500 border-brand-500 text-white"
                            : "bg-transparent border-white/15 text-white/50 hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-white/80"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Inputs */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-400 mb-2 block">
                        Left side
                      </label>
                      <input
                        type="text"
                        value={leftValue}
                        onChange={(e) => { setLeftValue(e.target.value); setShowResults(false); }}
                        placeholder="e.g. Willmott"
                        className="w-full px-5 h-[52px] text-base bg-[#0F2044] border border-white/[0.15] rounded-[10px] text-white placeholder:text-white/[0.4] focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/40 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-400 mb-2 block">
                        Right side
                      </label>
                      <input
                        type="text"
                        value={rightValue}
                        onChange={(e) => { setRightValue(e.target.value); setShowResults(false); }}
                        placeholder="e.g. Coates"
                        className="w-full px-5 h-[52px] text-base bg-[#0F2044] border border-white/[0.15] rounded-[10px] text-white placeholder:text-white/[0.4] focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/40 transition-all"
                      />
                    </div>
                  </div>

                  {/* Compare button */}
                  <button
                    onClick={handleCompare}
                    disabled={isComparing || !leftValue || !rightValue}
                    className="w-full mt-8 h-[56px] bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    {isComparing ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    ) : (
                      <>
                        Compare Now
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      </>
                    )}
                  </button>

                  {/* Dimension badges */}
                  <div className="mt-6">
                    <p className="text-[11px] text-white/25 text-center mb-3 uppercase tracking-wider font-medium">
                      Comparing across:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {dimensions.map((dim) => (
                        <span key={dim} className="px-2.5 py-1 text-[11px] font-medium bg-white/[0.06] text-brand-300/70 rounded-md">
                          {dim}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ═══ RESULTS ═══ */}
                  {showResults && (
                    <div className="mt-8 pt-8 border-t border-white/10 animate-[slideUp_0.4s_ease-out]">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 mb-4">
                        <div />
                        <div className="text-center">
                          <p className="text-sm font-bold text-white">{leftValue}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-white">{rightValue}</p>
                        </div>
                      </div>

                      {/* Data rows */}
                      <div className="space-y-1">
                        {mockResults.map((row, i) => (
                          <div
                            key={row.metric}
                            className={`grid grid-cols-[1fr_1fr_1fr] gap-3 items-center py-3 px-3 rounded-lg ${
                              i % 2 === 0 ? "bg-white/[0.03]" : ""
                            }`}
                          >
                            <p className="text-xs text-white/40 font-medium">{row.metric}</p>
                            <div className="text-center flex items-center justify-center gap-1.5">
                              <span className={`text-sm font-semibold ${row.winner === "left" ? "text-white" : "text-white/50"}`}>
                                {row.left}
                              </span>
                              {row.winner === "left" && (
                                <svg className="w-3.5 h-3.5 text-accent-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                              )}
                            </div>
                            <div className="text-center flex items-center justify-center gap-1.5">
                              <span className={`text-sm font-semibold ${row.winner === "right" ? "text-white" : "text-white/50"}`}>
                                {row.right}
                              </span>
                              {row.winner === "right" && (
                                <svg className="w-3.5 h-3.5 text-accent-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Save comparison */}
                      <div className="mt-6 pt-5 border-t border-white/10 text-center">
                        <button className="px-6 py-2.5 text-sm font-semibold text-brand-300 border border-brand-400/30 rounded-lg hover:bg-brand-500/10 transition-all">
                          Save this comparison &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ STREET SEARCH TAB ═══ */}
              {activeTab === "Street Search" && (
                <div className="transition-all duration-150">
                  <p className="text-white/40 mb-6">
                    Search any Milton street for sold prices, trends, and market data
                  </p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      <input
                        type="text"
                        placeholder='Type any Milton street name — e.g. Laurier Ave'
                        className="w-full pl-12 pr-5 h-[52px] text-base bg-[#0F2044] border border-white/[0.15] rounded-[10px] text-white placeholder:text-white/[0.4] focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/40 transition-all"
                      />
                    </div>
                    <button className="px-6 h-[52px] bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-bold rounded-[10px] transition-all hover:-translate-y-0.5 shrink-0">
                      Explore
                    </button>
                  </div>
                  {/* Popular streets */}
                  <div className="mt-5">
                    <p className="text-[11px] text-white/25 uppercase tracking-wider font-medium mb-3">Popular streets</p>
                    <div className="flex flex-wrap gap-2">
                      {popularStreets.map((street) => (
                        <button key={street} className="px-3.5 py-1.5 text-xs font-semibold text-brand-300 bg-brand-500/10 border border-brand-400/20 rounded-full hover:bg-brand-500/20 hover:border-brand-400/40 transition-all">
                          {street}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ CONDO SEARCH TAB ═══ */}
              {activeTab === "Condo Search" && (
                <div className="transition-all duration-150">
                  <p className="text-white/40 mb-6">
                    Search any Milton condo building for prices, rental yields, and more
                  </p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                      <input
                        type="text"
                        placeholder="Type a condo building name or address"
                        className="w-full pl-12 pr-5 h-[52px] text-base bg-[#0F2044] border border-white/[0.15] rounded-[10px] text-white placeholder:text-white/[0.4] focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400/40 transition-all"
                      />
                    </div>
                    <button className="px-6 h-[52px] bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-bold rounded-[10px] transition-all hover:-translate-y-0.5 shrink-0">
                      Explore
                    </button>
                  </div>
                  {/* Popular condos */}
                  <div className="mt-5">
                    <p className="text-[11px] text-white/25 uppercase tracking-wider font-medium mb-3">Popular buildings</p>
                    <div className="flex flex-wrap gap-2">
                      {popularCondos.map((condo) => (
                        <button key={condo} className="px-3.5 py-1.5 text-xs font-semibold text-brand-300 bg-brand-500/10 border border-brand-400/20 rounded-full hover:bg-brand-500/20 hover:border-brand-400/40 transition-all">
                          {condo}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
