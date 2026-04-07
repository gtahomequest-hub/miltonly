"use client";

import { useState } from "react";
import Link from "next/link";

const searchTabs = ["Buy", "Rent", "Sold"] as const;

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<(typeof searchTabs)[number]>("Buy");

  return (
    <section className="relative min-h-[600px] lg:min-h-[720px] flex items-center">
      {/* Rich deep navy gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#152D52_0%,#0A1628_50%,#060E1A_100%)]" />
      {/* Subtle light sweep */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />

      <div className="relative section-container w-full py-28 lg:py-36">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14 items-center">
          {/* LEFT — headline + search */}
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-5">
              <h1 className="text-[2.75rem] sm:text-display lg:text-display-lg text-white leading-[1.08] text-balance">
                Find your perfect<br />Milton home
              </h1>
              <p className="text-lg sm:text-xl text-white/60 max-w-lg leading-relaxed">
                The only real estate platform built exclusively for Milton, Ontario.
                Street intelligence, school zones, and GO commute data.
              </p>
            </div>

            {/* Search bar — white, elevated */}
            <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.25)] overflow-hidden max-w-xl">
              <div className="flex border-b border-neutral-100">
                {searchTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                      activeTab === tab
                        ? "text-brand-500 border-b-2 border-brand-500 bg-brand-50/50"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input
                      type="text"
                      placeholder="Address, street, neighbourhood, MLS#..."
                      className="w-full pl-11 pr-4 py-3.5 text-neutral-800 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white placeholder:text-neutral-400"
                    />
                  </div>
                  <button className="btn-primary shrink-0 !rounded-xl !px-7">
                    Search
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — seller CTA — glowing card */}
          <div className="lg:col-span-2">
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-1 bg-gradient-to-br from-brand-400/30 to-accent-400/20 rounded-[20px] blur-lg" />
              <div className="relative bg-white/[0.07] backdrop-blur-md rounded-2xl p-8 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 bg-accent-500/15 text-accent-400 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
                    <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-pulse" />
                    Free Instant Estimate
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    What&apos;s my<br />home worth?
                  </h2>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Get your Milton home&apos;s value in 30 seconds.
                    Based on real sold data from your street.
                  </p>
                  <Link
                    href="/sell"
                    className="block text-center w-full py-4 bg-accent-500 hover:bg-accent-600 text-white text-lg font-bold rounded-xl transition-all shadow-glow-accent"
                  >
                    See My Home Value
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
