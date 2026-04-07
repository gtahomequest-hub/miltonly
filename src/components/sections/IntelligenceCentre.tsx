"use client";

import { useState } from "react";

const tabs = ["Compare", "Street Search", "Condo Search"] as const;

export default function IntelligenceCentre() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Compare");

  return (
    <section className="bg-neutral-50">
      <div className="section-container section-padding">
        <div className="text-center mb-10">
          <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">
            Milton Intelligence Centre
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900 mt-2">
            Data no other Milton site has
          </h2>
          <p className="text-neutral-600 mt-3 max-w-2xl mx-auto">
            Compare streets, neighbourhoods, and condo buildings. Get insights that
            help you make smarter decisions.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white rounded-lg border border-neutral-200 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-800"
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
            <div className="bg-white rounded-xl border border-neutral-200 p-6 lg:p-8">
              <p className="text-sm font-medium text-neutral-500 mb-4">
                What would you like to compare?
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  "Street vs Street",
                  "Neighbourhood vs Neighbourhood",
                  "Building vs Building",
                  "Listing vs Area Avg",
                  "Buy vs Rent",
                ].map((mode) => (
                  <button
                    key={mode}
                    className="px-3 py-1.5 text-sm rounded-full border border-neutral-200 text-neutral-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Left side
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Willmott"
                    className="w-full mt-1 px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Right side
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coates"
                    className="w-full mt-1 px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button className="btn-primary w-full mt-6">
                Compare Now
              </button>
            </div>
          )}

          {activeTab === "Street Search" && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 lg:p-8">
              <p className="text-sm font-medium text-neutral-500 mb-4">
                Search any Milton street for sold prices, trends, and market data
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder='Enter a street name — e.g. "Laurier Ave"'
                  className="flex-1 px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button className="btn-primary shrink-0">
                  Explore Street
                </button>
              </div>
            </div>
          )}

          {activeTab === "Condo Search" && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6 lg:p-8">
              <p className="text-sm font-medium text-neutral-500 mb-4">
                Search any Milton condo building for prices, rental yields, and more
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter building name or address"
                  className="flex-1 px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button className="btn-primary shrink-0">
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
