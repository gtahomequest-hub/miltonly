"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";

interface Listing {
  // Post Phase 2.6: this component only ever receives active listings.
  // soldPrice/soldDate removed from the interface — DB1 no longer stores them
  // and active listings never had them populated.
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  status: string;
  daysOnMarket: number | null;
  listedAt: string;
  description: string | null;
}

interface FAQ { question: string; answer: string }

interface Props {
  data: {
    streetName: string;
    slug: string;
    activeListings: Listing[];
    avgListPrice: number;        // active-listing avg only (post Phase 2.6)
    avgDOM: number;              // active-listing avg only
    totalSold12mo: number;       // safe count
    activeCount: number;
    priceDistribution: { range: string; count: number; pct: number }[];  // active-only
    domDistribution: { range: string; count: number; pct: number }[];    // active-only
  };
  description: string;
  faqs: FAQ[];
}

export default function StreetClientSections({ data, description, faqs }: Props) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSubmitted, setAlertSubmitted] = useState(false);

  const handleAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertEmail) return;
    setAlertSubmitted(true);
    setAlertEmail("");
  };

  const filteredActive = typeFilter === "all"
    ? data.activeListings
    : data.activeListings.filter((l) => l.propertyType === typeFilter);

  return (
    <>
      {/* SECTION 6 — Active listings */}
      <section className="bg-white px-5 sm:px-11 py-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[18px] font-extrabold text-[#07111f] mb-2">
            {data.activeCount} homes for sale on {data.streetName} right now
          </h2>

          {/* Filters */}
          <div className="flex gap-1.5 mb-6">
            {["all", "detached", "semi", "townhouse", "condo"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all capitalize ${
                  typeFilter === t
                    ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                    : "border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
                }`}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>

          {filteredActive.length > 0 ? (
            <div className="space-y-3">
              {filteredActive.map((l) => (
                <Link key={l.mlsNumber} href={`/listings/${l.mlsNumber}`}
                  className="flex items-center gap-4 bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow">
                  <div className="w-20 h-14 bg-gradient-to-br from-[#b0c4de] to-[#93a8c4] rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-extrabold text-[#07111f]">{formatPriceFull(l.price)}</p>
                    <p className="text-[11px] text-[#64748b] truncate">{l.address}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-1">{l.bedrooms}bd · {l.bathrooms}ba · {l.parking}pk · <span className="capitalize">{l.propertyType}</span> · {daysAgo(new Date(l.listedAt))}d on market</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#f59e0b] bg-[#07111f] rounded-full px-2.5 py-1 shrink-0">View</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-8 text-center">
              <p className="text-[14px] text-[#64748b] mb-4">No active {typeFilter !== "all" ? typeFilter + " " : ""}listings on {data.streetName} right now.</p>
              <form className="max-w-sm mx-auto flex gap-2">
                <input type="email" placeholder="Your email" className="flex-1 px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg outline-none focus:border-[#07111f]" />
                <button type="submit" className="bg-[#07111f] text-[#f59e0b] text-[12px] font-bold px-4 py-2.5 rounded-lg shrink-0">Alert me</button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Street Price Alert */}
      <section className="bg-[#07111f] px-5 sm:px-11 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.1em] mb-1.5">
                Street Price Alert
              </p>
              <p className="text-[15px] font-bold text-[#f8f9fb] mb-1">
                Get notified when a home lists on {data.streetName}
              </p>
              <p className="text-[12px] text-[#94a3b8]">
                New listings and price changes in Milton — straight to your inbox. Register for full MLS sold-data access.
              </p>
            </div>
            {alertSubmitted ? (
              <p className="text-[13px] font-bold text-[#f59e0b] shrink-0">
                Done — you&apos;ll hear from us.
              </p>
            ) : (
              <form onSubmit={handleAlert} className="flex gap-2 shrink-0">
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="w-52 px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] placeholder:text-[#64748b] rounded-lg outline-none focus:border-[#f59e0b]"
                />
                <button
                  type="submit"
                  className="bg-[#f59e0b] text-[#07111f] text-[12px] font-bold px-4 py-2.5 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors"
                >
                  Alert me
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 7 — Sold history  [REMOVED 2026-04-17 Phase 2.6].
          This section rendered a full table of individual sold records
          (address, sold price, list price, diff, DOM) sourced from DB1
          for all anon users. VOW-non-compliant. Sold data now surfaces
          exclusively through the server-rendered StreetSoldBlock fed
          from DB2 with VowGate + k=10 anonymity. */}

      {/* SECTION 9 — Seller lead capture */}
      <section className="bg-[#fbbf24] px-5 sm:px-11 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-[22px] font-extrabold text-[#07111f] mb-4">Own a home on {data.streetName}?</h2>
              <p className="text-[14px] text-[#78350f] mb-6">Find out what it&apos;s worth based on real recent sales — not a generic estimate.</p>
              <ul className="space-y-3">
                {[
                  `Based on ${data.activeCount} active and ${data.totalSold12mo} sold listings on ${data.streetName}`,
                  `Active listings here are priced ${formatPriceFull(data.avgListPrice)} on average`,
                  data.avgDOM ? `Average ${data.avgDOM} days on market` : "Active seller market",
                  "Full historical market data available to registered users",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-[#92400e]">
                    <span className="w-1.5 h-1.5 bg-[#07111f] rounded-full mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-black/5">
              <p className="text-[14px] font-bold text-[#07111f] mb-4">Get your {data.streetName} home estimate</p>
              <form className="space-y-3">
                <select className="w-full px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg bg-white text-[#475569]">
                  <option>Home type — Detached</option>
                  <option>Semi</option>
                  <option>Townhouse</option>
                  <option>Condo</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select className="px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg bg-white text-[#475569]">
                    <option>Bedrooms</option>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
                  </select>
                  <select className="px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg bg-white text-[#475569]">
                    <option>Bathrooms</option>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg outline-none focus:border-[#07111f]" />
                <input type="email" placeholder="Email" className="w-full px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg outline-none focus:border-[#07111f]" />
                <input type="tel" placeholder="Phone (optional)" className="w-full px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg outline-none focus:border-[#07111f]" />
                <select className="w-full px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg bg-white text-[#475569]">
                  <option>Timeline — Now</option>
                  <option>1-3 months</option>
                  <option>3-6 months</option>
                  <option>6-12 months</option>
                  <option>Just curious</option>
                </select>
                <select className="w-full px-3 py-2.5 text-[12px] border border-[#e2e8f0] rounded-lg bg-white text-[#475569]">
                  <option>Working with an agent? — No</option>
                  <option>Yes</option>
                  <option>I am an agent</option>
                </select>
                <button type="submit" className="w-full bg-[#07111f] text-[#f59e0b] text-[13px] font-extrabold rounded-lg py-3.5">
                  Get my {data.streetName} home estimate →
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10 — Intelligence deep dive */}
      <section className="bg-white px-5 sm:px-11 py-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">{data.streetName} by the numbers</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Price distribution */}
            <div className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[12px] font-bold text-[#07111f] mb-3">Price distribution</p>
              <div className="space-y-2">
                {data.priceDistribution.filter(d => d.count > 0).map((d) => (
                  <div key={d.range} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#64748b] w-24 shrink-0">{d.range}</span>
                    <div className="flex-1 bg-[#e2e8f0] rounded-full h-2">
                      <div className="bg-[#f59e0b] rounded-full h-2" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-[#475569] w-8 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DOM distribution */}
            <div className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[12px] font-bold text-[#07111f] mb-3">Speed of sale</p>
              <div className="space-y-2">
                {data.domDistribution.filter(d => d.count > 0).map((d) => (
                  <div key={d.range} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#64748b] w-20 shrink-0">{d.range}</span>
                    <div className="flex-1 bg-[#e2e8f0] rounded-full h-2">
                      <div className="bg-[#07111f] rounded-full h-2" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-[#475569] w-8 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Over/under asking — removed 2026-04-17 Phase 2.6.
                On low-volume streets the above/at/below counts reveal
                the individual sold listing's position (e.g. "1/1 above
                asking" = that one sale went above asking by X%, with X%
                derivable). Sold-to-ask ratios now surface only in the
                gated StreetSoldBlock (VOW-compliant with k=10 anonymity). */}
            <div className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[12px] font-bold text-[#07111f] mb-3">Buyer competition</p>
              <p className="text-[12px] text-[#94a3b8]">
                Sold-to-ask ratios and buyer-competition data are available to
                registered users in the sold-data section on this page.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 11 — Description */}
      <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[18px] font-extrabold text-[#07111f] mb-4">Living on {data.streetName}, Milton</h2>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
            <div className="text-[13px] text-[#475569] leading-[1.8] whitespace-pre-line">{description}</div>
          </div>
        </div>
      </section>

      {/* SECTION 14 — FAQ */}
      <section className="bg-white px-5 sm:px-11 py-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
            Frequently asked questions about {data.streetName}, Milton
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-[13px] font-bold text-[#07111f] pr-4">{faq.question}</span>
                  <svg className={`w-4 h-4 text-[#94a3b8] shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-[12px] text-[#64748b] leading-[1.7]">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
