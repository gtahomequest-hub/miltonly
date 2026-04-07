"use client";

import { useState } from "react";
import Link from "next/link";

const searchTabs = ["Buy", "Rent", "Sold"] as const;

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<(typeof searchTabs)[number]>("Buy");

  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center">
      {/* Background — video placeholder (dark gradient for now) */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800 to-neutral-900" />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative section-container w-full py-24 lg:py-32">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-center">
          {/* LEFT — headline + search */}
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight text-balance">
                Find your perfect Milton home
              </h1>
              <p className="text-lg text-white/80 max-w-xl">
                The only real estate platform built exclusively for Milton, Ontario.
                Street intelligence, school zones, GO commute times, and more.
              </p>
            </div>

            {/* Search bar */}
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-xl">
              {/* Tabs */}
              <div className="flex border-b border-neutral-100">
                {searchTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                      activeTab === tab
                        ? "text-brand-600 border-b-2 border-brand-600"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Address, street, neighbourhood, MLS#..."
                    className="flex-1 px-4 py-3 text-neutral-800 bg-neutral-50 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-neutral-400"
                  />
                  <button className="btn-primary shrink-0">Search</button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — seller CTA */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-accent-500/20 text-accent-300 text-sm font-medium px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
                  Free instant estimate
                </div>
                <h2 className="text-2xl font-bold text-white">
                  What&apos;s my home worth?
                </h2>
                <p className="text-white/70 text-sm">
                  Get your Milton home&apos;s value in 30 seconds. Based on real
                  sold data from your street.
                </p>
                <Link
                  href="/sell"
                  className="btn-accent block text-center w-full !py-4 text-lg"
                >
                  See My Home Value
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
