"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

const searchTabs = ["Buy", "Rent", "Sold"] as const;
const SEARCH_PILLS = [
  { label: "Detached homes", href: "/listings?type=detached" },
  { label: "Townhouses", href: "/listings?type=townhouse" },
  { label: "Condos under $700K", href: "/listings?type=condo&maxPrice=700000" },
  { label: "Under $800K", href: "/listings?maxPrice=800000" },
  { label: "Under $1M", href: "/listings?maxPrice=1000000" },
  { label: "4-bed detached", href: "/listings?type=detached&beds=4" },
  { label: "Willmott homes", href: "/listings?neighbourhood=Willmott" },
  { label: "Dempsey homes", href: "/listings?neighbourhood=Dempsey" },
  { label: "Rentals now", href: "/rentals" },
  { label: "3-bed rentals", href: "/rentals" },
];
const propertyTypes = [
  { id: "detached", label: "Detached", icon: "🏠" },
  { id: "semi", label: "Semi", icon: "🏘" },
  { id: "townhouse", label: "Townhouse", icon: "🏗" },
  { id: "condo", label: "Condo", icon: "🏢" },
];
const streetPills = ["Derry Rd", "Main St E", "Thompson Rd", "Laurier Ave", "Louis St. Laurent"];

interface Props {
  stats: {
    activeCount: number;
    avgDetached: number;
    detachedCount: number;
    avgSemi: number;
    semiCount: number;
    avgCondo: number;
    condoCount: number;
    avgRent: number;
    rentalCount: number;
  };
  typeStats: Record<string, { avgPrice: number; avgDOM: number; soldVsAsk: number }>;
}

export default function HeroSection({ stats, typeStats }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof searchTabs)[number]>("Buy");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("detached");
  const [streetName, setStreetName] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [capturedStreet, setCapturedStreet] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (/^[A-Z]\d{7,}$/i.test(q)) { router.push(`/listings/${q.toUpperCase()}`); return; }
    if (activeTab === "Rent") { router.push(`/rentals`); return; }
    router.push(`/listings?q=${encodeURIComponent(q)}`);
  };

  const typeData = useMemo(() => {
    const s = typeStats[selectedType];
    return {
      label: propertyTypes.find((t) => t.id === selectedType)!.label,
      avgPrice: s ? formatPrice(s.avgPrice) : "$0",
      avgDOM: s ? s.avgDOM + " days" : "—",
      soldVsAsk: s ? s.soldVsAsk + "%" : "—",
    };
  }, [selectedType, typeStats]);

  const buttonText = streetName
    ? `Show what ${typeData.label.toLowerCase()} homes fetch on ${streetName} →`
    : `Show what ${typeData.label.toLowerCase()} homes are fetching →`;

  const handleFetch = () => {
    setCapturedStreet(streetName || "your street");
    setShowCapture(true);
  };

  return (
    <section className="flex flex-col lg:flex-row min-h-[560px]">
      {/* ═══ LEFT — Hero (dark navy) ═══ */}
      <div className="flex-1 bg-[#07111f] flex flex-col p-[30px] sm:p-[40px] lg:p-[50px_44px]">
        <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.14em] mb-2.5">
          For buyers · renters · investors
        </p>
        <h1 className="text-[28px] sm:text-[34px] font-extrabold tracking-[-0.5px] leading-[1.05] mb-2">
          <span className="text-[#f8f9fb]">Milton </span>
          <span className="text-[#f8f9fb]">Real Estate</span>
        </h1>
        <p className="text-[13px] text-[#94a3b8] leading-[1.65] mb-6 sm:mb-[30px] max-w-md">
          Browse every Milton home for sale, rent or sold — live TREB data, updated daily.
        </p>

        {/* Search tabs */}
        <div className="flex gap-1.5 mb-[11px]">
          {searchTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[12px] font-semibold rounded-full px-[18px] py-[6px] transition-all ${
                activeTab === tab
                  ? "bg-[#f59e0b] text-[#07111f]"
                  : "text-[rgba(248,249,251,0.5)] hover:text-[rgba(248,249,251,0.7)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex bg-[#0c1e35] border-2 border-[#1e3a5f] rounded-[13px] overflow-hidden focus-within:border-[#f59e0b] transition-colors mb-[14px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Address, street, neighbourhood, MLS#..."
            className="flex-1 bg-transparent text-[14px] text-[#f8f9fb] placeholder:text-[rgba(248,249,251,0.25)] px-4 py-[14px] outline-none"
          />
          <button type="submit" className="bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold px-[22px] py-[14px] shrink-0 hover:bg-[#eab308] transition-colors">
            Search
          </button>
        </form>

        {/* Quick pills — real links */}
        <div className="flex flex-wrap gap-[6px] mb-6">
          {SEARCH_PILLS.map((pill) => (
            <a key={pill.label} href={pill.href} className="text-[11px] text-[#94a3b8] border border-[#1e3a5f] rounded-full px-3 py-[5px] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors whitespace-nowrap">
              {pill.label}
            </a>
          ))}
        </div>

        {/* 5 stat boxes — REAL DATA from active listings */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-auto">
          {[
            { value: formatPrice(stats.avgDetached), label: "Detached avg ask", sub: `${stats.detachedCount} active` },
            { value: formatPrice(stats.avgSemi), label: "Semi-det avg ask", sub: `${stats.semiCount} active` },
            { value: formatPrice(stats.avgCondo), label: "Condo avg ask", sub: `${stats.condoCount} active` },
            { value: `$${stats.avgRent.toLocaleString()}/mo`, label: "Avg asking rent", sub: `${stats.rentalCount} rentals` },
            { value: String(stats.activeCount), label: "Active listings", sub: "updated daily" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-[12px_14px]">
              <p className="text-[18px] font-extrabold text-[#f8f9fb]">{s.value}</p>
              <p className="text-[10px] text-[rgba(248,249,251,0.6)] mt-[3px] font-semibold">{s.label}</p>
              <p className="text-[9px] text-[#94a3b8] mt-[2px]">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="hidden lg:flex w-[3px] bg-[#1e3a5f] relative items-center justify-center">
        <div className="absolute bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-full px-[9px] py-[6px] -rotate-90">
          <span className="text-[9px] font-bold text-[#f59e0b] uppercase tracking-[0.1em] whitespace-nowrap">Milton · ON</span>
        </div>
      </div>
      <div className="lg:hidden h-[3px] bg-[#1e3a5f] flex items-center justify-center relative">
        <div className="absolute bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-full px-3 py-1">
          <span className="text-[9px] font-bold text-[#f59e0b] uppercase tracking-[0.1em]">Milton · ON</span>
        </div>
      </div>

      {/* ═══ RIGHT — Miltonly Intelligence (navy) ═══ */}
      <div className="flex-1 bg-[#0c1e35] flex flex-col p-[30px] sm:p-[40px] lg:p-[50px_44px]">
        <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-2.5">
          For sellers · investors · researchers
        </p>
        <p className="text-[28px] sm:text-[34px] font-extrabold tracking-[-0.5px] leading-[1.05] mb-2">
          <span className="text-[#f8f9fb]">Miltonly </span>
          <span className="text-[#f59e0b]">Intelligence</span>
        </p>
        <p className="text-[13px] text-[#94a3b8] leading-[1.65] mb-5">
          Street price data, home valuations and market comparisons — only in Milton.
        </p>

        {/* White intelligence card */}
        <div className="bg-white rounded-2xl border border-black/5 p-[22px] mb-3">
          {!showCapture ? (
            <>
              <div className="flex items-center gap-[7px] mb-3">
                <span className="w-[7px] h-[7px] rounded-full bg-[#f59e0b]" />
                <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.1em]">Live street prices</span>
              </div>
              <p className="text-[15px] font-bold text-[#07111f] leading-[1.3] mb-[5px]">What are homes fetching on your street?</p>
              <p className="text-[12px] text-[#64748b] leading-[1.5] mb-4">Pick a home type and enter your street name — see exactly what they&apos;re fetching right now.</p>

              {/* Step 1 */}
              <div className="flex items-center gap-[9px] mb-2.5">
                <span className="w-5 h-5 rounded-full bg-[#07111f] text-[#f59e0b] text-[10px] font-extrabold flex items-center justify-center shrink-0">1</span>
                <span className="text-[10px] font-bold text-[#07111f] uppercase tracking-[0.08em]">What type of home?</span>
              </div>
              <div className="grid grid-cols-4 gap-[5px] mb-[14px]">
                {propertyTypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedType(t.id)}
                    className={`text-center rounded-[10px] py-2.5 px-1 border transition-all ${
                      selectedType === t.id
                        ? "bg-[#07111f] border-2 border-[#f59e0b]"
                        : "bg-[#f8fafc] border-[1.5px] border-[#e2e8f0] hover:border-[#cbd5e1]"
                    }`}
                  >
                    <span className="text-[15px] block mb-[3px]">{t.icon}</span>
                    <span className={`text-[10px] ${selectedType === t.id ? "text-[#f8f9fb] font-bold" : "text-[#64748b]"}`}>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-[9px] mb-2.5">
                <span className="w-5 h-5 rounded-full bg-[#07111f] text-[#f59e0b] text-[10px] font-extrabold flex items-center justify-center shrink-0">2</span>
                <span className="text-[10px] font-bold text-[#07111f] uppercase tracking-[0.08em]">Street name only</span>
              </div>
              <div className="flex bg-[#f8fafc] border-2 border-[#e2e8f0] rounded-[10px] overflow-hidden focus-within:border-[#07111f] transition-colors mb-[5px]">
                <div className="flex items-center gap-1.5 px-[11px] border-r border-[#e2e8f0] shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span className="text-[11px] text-[#94a3b8] whitespace-nowrap">Milton street</span>
                </div>
                <input
                  type="text"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  placeholder="e.g. Laurier Ave"
                  className="flex-1 px-3 py-[11px] text-[13px] font-medium text-[#07111f] placeholder:text-[#d1d5db] outline-none bg-transparent"
                />
              </div>
              <p className="text-[10px] text-[#94a3b8] font-semibold mb-2">No house number needed — street name only</p>

              <div className="flex flex-wrap gap-[5px] mb-[13px]">
                {streetPills.map((s) => (
                  <button key={s} onClick={() => setStreetName(s)} className="text-[11px] text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] rounded-full px-2.5 py-1 hover:border-[#f59e0b] hover:text-[#92400e] transition-colors">
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={handleFetch}
                className="w-full bg-[#07111f] text-[#f59e0b] text-[13px] font-extrabold rounded-[10px] py-[13px] hover:bg-[#0c1e35] transition-colors"
              >
                {buttonText}
              </button>

              {/* Mini stats — REAL DATA */}
              <div className="grid grid-cols-3 gap-[5px] mt-3 pt-3 border-t border-[#f1f5f9]">
                {[
                  { value: typeData.avgPrice, label: "Avg fetching", trend: "↑ live" },
                  { value: typeData.avgDOM, label: "To sell", trend: "↓ live" },
                  { value: typeData.soldVsAsk, label: "Of asking", trend: "↑ live" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#f8fafc] rounded-lg p-[9px_6px] text-center">
                    <p className="text-[13px] font-extrabold text-[#07111f]">{s.value}</p>
                    <p className="text-[9px] text-[#94a3b8] mt-[2px]">{s.label}</p>
                    <p className="text-[9px] text-[#16a34a] font-bold mt-[2px]">{s.trend}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-2">
              <p className="text-[15px] font-bold text-[#07111f] leading-[1.3] mb-1">
                Get notified when prices change on{" "}
                <span className="text-[#f59e0b]">{capturedStreet}</span>
              </p>
              <p className="text-[12px] text-[#64748b] leading-[1.5] mb-5">
                We&apos;ll email you whenever a home sells on your street — free, no spam.
              </p>
              <input type="email" placeholder="Your email address" className="w-full px-4 py-3 text-[13px] bg-[#f8fafc] border-2 border-[#e2e8f0] rounded-[10px] outline-none focus:border-[#07111f] mb-3" />
              <button className="w-full bg-[#07111f] text-[#f59e0b] text-[13px] font-extrabold rounded-[10px] py-[13px] mb-2 hover:bg-[#0c1e35] transition-colors">Yes, keep me updated →</button>
              <button className="w-full text-[12px] text-[#64748b] border border-[#e2e8f0] rounded-[10px] py-[11px] mb-3 hover:bg-[#f8fafc] transition-colors">Skip — just show me the prices</button>
              <button onClick={() => setShowCapture(false)} className="text-[11px] text-[#f59e0b] font-semibold hover:underline">← Change street or home type</button>
            </div>
          )}
        </div>

        {/* Dark home value card */}
        <div className="bg-[#07111f] rounded-[14px] p-[16px_18px] flex items-center gap-[14px]">
          <div className="w-[42px] h-[42px] bg-[#f59e0b] rounded-[10px] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#f8f9fb] mb-[3px]">What&apos;s my home worth?</p>
            <p className="text-[11px] text-[rgba(248,249,251,0.6)]">30 sec · real TREB data · free estimate</p>
          </div>
          <Link href="/sell" className="bg-[#f59e0b] text-[#07111f] text-[12px] font-extrabold px-4 py-2.5 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors">
            Get estimate →
          </Link>
        </div>
      </div>
    </section>
  );
}
