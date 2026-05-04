"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { config } from "@/lib/config";

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

interface TrendingStreet {
  slug: string;
  name: string;
  activeCount: number;
  avgPrice: number;
}

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
  trendingStreets: TrendingStreet[];
}

export default function HeroSection({ stats, typeStats, trendingStreets }: Props) {
  const router = useRouter();
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

        {/* AGENT TRUST CARD */}
        <div className="bg-white/[0.05] border border-[#f59e0b]/30 rounded-xl px-4 py-[14px] mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div
              aria-hidden
              className="w-11 h-11 rounded-full bg-[#f59e0b] text-[#07111f] font-extrabold flex items-center justify-center shrink-0 text-[15px]"
            >
              AY
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-white leading-tight">
                Aamir Yaqoob · RE/MAX Realty
              </p>
              <p className="text-[12px] text-[#f59e0b] mt-0.5">
                {config.CITY_NAME}-only specialist · {config.realtor.yearsExperience} years · RE/MAX Hall of Fame
              </p>
              <p className="text-[12px] text-[#f59e0b] mt-0.5">
                ★★★★★ 47 Google reviews
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={`tel:${config.realtor.phoneE164}`}
              className="bg-[#f59e0b]/15 border-[1.5px] border-[#f59e0b] rounded-lg px-4 py-[9px] text-[#f59e0b] font-bold text-[13px] hover:bg-[#f59e0b]/25 transition-colors"
            >
              📞 {config.realtor.phone}
            </a>
            <Link
              href="/book"
              className="bg-transparent border-[1.5px] border-white/20 rounded-lg px-4 py-[9px] text-white font-semibold text-[13px] hover:border-white/40 transition-colors"
            >
              Book a call →
            </Link>
          </div>
        </div>

        {/* EYEBROW */}
        <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-[2px] mb-[14px]">
          For buyers · renters · investors
        </p>

        {/* H1 */}
        <h1
          className="font-black leading-[1.1] mb-3"
          style={{ fontSize: "clamp(36px, 4.5vw, 52px)" }}
        >
          <span className="text-[#f8f9fb]">{config.CITY_NAME}&apos;s Most </span>
          <span className="text-[#f59e0b]">Data-Rich</span>
          <span className="text-[#f8f9fb]"> Real Estate</span>
        </h1>

        {/* SUBTITLE */}
        <p className="text-[15px] text-white/75 leading-[1.6] mb-6 max-w-[480px]">
          Find, price &amp; compare any home in {config.CITY_NAME} — live TREB data, updated daily.
          The only site built exclusively for {config.CITY_NAME}.
        </p>

        {/* INTENT TABS — visual-only in Part 1; click-noop until Part 2 wiring */}
        <div className="flex flex-wrap gap-2 mb-[14px]">
          <button
            type="button"
            className="bg-[#f59e0b] text-[#07111f] font-extrabold text-[12px] px-[18px] py-2 rounded-lg"
          >
            🏠 Find a Home
          </button>
          <button
            type="button"
            className="bg-transparent text-white/75 font-semibold text-[12px] px-[14px] py-2 rounded-lg border border-white/15 hover:border-white/30 transition-colors"
          >
            💰 Sell Mine
          </button>
          <button
            type="button"
            className="bg-transparent text-white/75 font-semibold text-[12px] px-[14px] py-2 rounded-lg border border-white/15 hover:border-white/30 transition-colors"
          >
            📈 Build Wealth
          </button>
          <button
            type="button"
            className="bg-transparent text-[#f59e0b] font-bold text-[12px] px-[14px] py-2 rounded-lg border-[1.5px] border-[#f59e0b]"
          >
            🏷️ What&apos;s It Worth?
          </button>
        </div>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="flex bg-[#0c1e35] border-2 border-[#1e3a5f] rounded-[13px] overflow-hidden focus-within:border-[#f59e0b] transition-colors mb-2"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Address, street, neighbourhood, MLS#..."
            className="flex-1 bg-transparent text-[14px] text-[#f8f9fb] placeholder:text-[rgba(248,249,251,0.25)] px-4 py-[14px] outline-none"
          />
          <button
            type="submit"
            className="bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold px-[22px] py-[14px] shrink-0 hover:bg-[#eab308] transition-colors"
          >
            Search
          </button>
        </form>
        <p className="text-[12px] text-white/50 mb-[14px]">
          See what streets are hottest right now →
        </p>

        {/* Map CTA link */}
        <Link
          href="/map"
          className="inline-block self-start text-[#f59e0b] font-bold text-[14px] border-b border-[#f59e0b]/30 hover:border-[#f59e0b] transition-colors mb-6"
        >
          🗺️ The only {config.CITY_NAME} map that shows street-level avg prices, not just pins →
        </Link>

        {/* Quick pills — real links */}
        <div className="flex flex-wrap gap-[6px] mb-6">
          {SEARCH_PILLS.map((pill) => (
            <a
              key={pill.label}
              href={pill.href}
              className="text-[13px] text-white/80 bg-white/[0.07] border border-white/[0.12] rounded-full px-[13px] py-[7px] hover:bg-white/[0.12] hover:text-[#f59e0b] hover:border-[#f59e0b] transition-colors whitespace-nowrap"
            >
              {pill.label}
            </a>
          ))}
        </div>

        {/* Trending streets — fills the dead zone */}
        {trendingStreets.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.1em]">Trending streets this week</p>
              <Link href="/streets" className="text-[10px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">
                All streets →
              </Link>
            </div>
            <div className="space-y-1.5">
              {trendingStreets.slice(0, 4).map((street) => (
                <Link
                  key={street.slug}
                  href={`/streets/${street.slug}`}
                  className="flex items-center justify-between bg-[#0c1e35] border border-[#1e3a5f] rounded-lg px-3 py-2.5 hover:border-[#f59e0b] transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-[#f8f9fb] group-hover:text-[#f59e0b] transition-colors truncate">{street.name}</p>
                    <p className="text-[9px] text-[#94a3b8]">{street.activeCount} active listings</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[13px] font-extrabold text-[#f8f9fb]">{formatPrice(street.avgPrice)}</p>
                    <p className="text-[9px] text-[#94a3b8]">avg ask</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 5 stat boxes — REAL DATA from active listings */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            { value: formatPrice(stats.avgDetached), label: "Detached avg ask", sub: `${stats.detachedCount} active` },
            { value: formatPrice(stats.avgSemi), label: "Semi-det avg ask", sub: `${stats.semiCount} active` },
            { value: formatPrice(stats.avgCondo), label: "Condo avg ask", sub: `${stats.condoCount} active` },
            { value: `$${stats.avgRent.toLocaleString()}/mo`, label: "Avg asking rent", sub: `${stats.rentalCount} rentals` },
            { value: String(stats.activeCount), label: "Active listings", sub: "updated daily" },
          ].map((s) => (
            <div key={s.label} className="min-w-0 bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-[12px_14px]">
              <p className="text-[16px] font-extrabold text-[#f8f9fb] whitespace-nowrap">{s.value}</p>
              <p className="text-[12px] text-[rgba(248,249,251,0.6)] mt-[3px] font-semibold">{s.label}</p>
              <p className="text-[11px] text-[#94a3b8] mt-[2px]">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="hidden lg:flex w-[3px] bg-[#1e3a5f] relative items-center justify-center">
        <div className="absolute bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-full px-[9px] py-[6px] -rotate-90">
          <span className="text-[9px] font-bold text-[#f59e0b] uppercase tracking-[0.1em] whitespace-nowrap">{config.CITY_NAME} · {config.CITY_PROVINCE_CODE}</span>
        </div>
      </div>
      <div className="lg:hidden h-[3px] bg-[#1e3a5f] flex items-center justify-center relative">
        <div className="absolute bg-[#07111f] border-[1.5px] border-[#1e3a5f] rounded-full px-3 py-1">
          <span className="text-[9px] font-bold text-[#f59e0b] uppercase tracking-[0.1em]">{config.CITY_NAME} · {config.CITY_PROVINCE_CODE}</span>
        </div>
      </div>

      {/* ═══ RIGHT — Miltonly Intelligence (navy) ═══ */}
      <div className="flex-1 bg-[#0c1e35] flex flex-col p-[30px] sm:p-[40px] lg:p-[50px_44px]">
        <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-[2px] mb-2.5">
          For sellers · investors · researchers
        </p>
        <h2
          className="font-black leading-[1.05] mb-2"
          style={{ fontSize: "clamp(28px, 3vw, 40px)" }}
        >
          <span className="text-[#f8f9fb]">Miltonly </span>
          <span className="text-[#f59e0b]">Intelligence</span>
        </h2>
        <p className="text-[15px] text-white/70 leading-[1.6] mb-5">
          Street price data, home valuations and market comparisons — only in {config.CITY_NAME}.
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
                  <span className="text-[11px] text-[#94a3b8] whitespace-nowrap">{config.CITY_NAME} street</span>
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
              <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                <p className="text-[12px] italic mb-1.5" style={{ color: "rgba(148,163,184,0.8)" }}>
                  e.g. Main St E — right now
                </p>
                <div className="grid grid-cols-3 gap-[5px]">
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
        <div id="home-worth" className="bg-[#07111f] rounded-[14px] p-[16px_18px] flex items-center gap-[14px]">
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

        {/* Secondary CTA row */}
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-[10px] px-[18px] py-[14px] mt-3 gap-3 flex-wrap">
          <span className="text-[14px] text-white/70">Not sure where to start in {config.CITY_NAME}?</span>
          <a href={`tel:${config.realtor.phoneE164}`} className="text-[#f59e0b] font-bold text-[14px] hover:text-[#fbbf24] transition-colors">
            📞 Book a free call with Aamir →
          </a>
        </div>

        {/* Trust strip — pinned to bottom of right panel */}
        <div className="mt-auto pt-6 border-t border-white/[0.08] grid grid-cols-3 gap-3 text-center">
          {[
            { value: `${config.realtor.yearsExperience} years`, label: `${config.CITY_NAME} specialist` },
            { value: "47", label: "5-star Google reviews" },
            { value: "300+", label: `${config.CITY_NAME} families helped` },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-[22px] font-extrabold text-[#f59e0b]">{stat.value}</div>
              <div
                className="text-[11px] mt-0.5 leading-[1.3]"
                style={{ color: "rgba(148,163,184,0.8)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
