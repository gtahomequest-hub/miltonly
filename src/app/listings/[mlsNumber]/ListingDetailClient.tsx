"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";
import AgentContactSection from "@/components/AgentContactSection";

interface Listing {
  mlsNumber: string; address: string; price: number; bedrooms: number; bathrooms: number;
  parking: number; propertyType: string; status: string; photos: string[]; listedAt: string;
  neighbourhood: string; description: string | null; streetSlug: string; latitude: number;
  longitude: number; sqft: number | null; basement: boolean; lotSize: string | null;
  lotDepth: number | null; lotWidth: number | null; transactionType: string | null;
  petsAllowed: string | null; rentIncludes: string[]; laundryFeatures: string | null;
  cooling: string | null; heatType: string | null; heatSource: string | null;
  furnished: string | null; possessionDetails: string | null; minLeaseTerm: number | null;
  locker: string | null; garageType: string | null; roof: string | null;
  foundation: string | null; construction: string | null; exteriorFeatures: string[];
  interiorFeatures: string[]; fireplace: boolean; architecturalStyle: string | null;
  approximateAge: string | null; taxAmount: number | null; taxYear: number | null;
  maintenanceFeeAmt: number | null; directionFaces: string | null; crossStreet: string | null;
  sewer: string | null; waterSource: string | null; virtualTourUrl: string | null;
  listOfficeName: string | null; totalRooms: number | null; kitchens: number | null;
}

interface Props { listing: Listing; similar: Listing[] }

export default function ListingDetailClient({ listing: l, similar }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [toast, setToast] = useState("");
  const [showGallery, setShowGallery] = useState(false);

  const openGallery = (idx: number) => { setPhotoIdx(idx); setShowGallery(true); };

  const prevPhoto = useCallback(() => setPhotoIdx((i) => (i - 1 + l.photos.length) % l.photos.length), [l.photos.length]);
  const nextPhoto = useCallback(() => setPhotoIdx((i) => (i + 1) % l.photos.length), [l.photos.length]);

  useEffect(() => {
    if (!showGallery) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      else if (e.key === "ArrowRight") nextPhoto();
      else if (e.key === "Escape") setShowGallery(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showGallery, prevPhoto, nextPhoto]);

  const isRental = l.transactionType === "For Lease";
  const days = daysAgo(new Date(l.listedAt));
  const priceLabel = isRental ? formatPriceFull(l.price) + "/mo" : formatPriceFull(l.price);
  const statusLabel = isRental ? "FOR RENT" : l.status === "sold" ? "SOLD" : "FOR SALE";
  const statusColor = isRental ? "#2563eb" : l.status === "sold" ? "#ef4444" : "#16a34a";
  const monthlyPayment = !isRental ? Math.round((l.price * 0.8 * 0.05) / 12 + (l.price * 0.8) / (25 * 12)) : null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  const submitLead = async (data: Record<string, string>) => {
    try { await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); } catch {}
  };

  // Property details sections
  const details: { label: string; items: { key: string; value: string | null }[] }[] = [
    { label: "Parking & Garage", items: [
      { key: "Parking spaces", value: l.parking ? String(l.parking) : null },
      { key: "Garage", value: l.garageType },
    ]},
    { label: "Heating & Cooling", items: [
      { key: "Heat type", value: l.heatType },
      { key: "Heat source", value: l.heatSource },
      { key: "Cooling", value: l.cooling },
    ]},
    { label: "Building", items: [
      { key: "Style", value: l.architecturalStyle },
      { key: "Construction", value: l.construction },
      { key: "Roof", value: l.roof },
      { key: "Foundation", value: l.foundation },
      { key: "Approx. age", value: l.approximateAge },
      { key: "Faces", value: l.directionFaces },
    ]},
    { label: "Lot", items: [
      { key: "Lot size", value: l.lotWidth && l.lotDepth ? `${l.lotWidth}' × ${l.lotDepth}'` : null },
      { key: "Sewer", value: l.sewer },
      { key: "Water", value: l.waterSource },
    ]},
    ...(isRental ? [{ label: "Rental Info", items: [
      { key: "Pets", value: l.petsAllowed },
      { key: "Furnished", value: l.furnished },
      { key: "Laundry", value: l.laundryFeatures },
      { key: "Possession", value: l.possessionDetails },
      { key: "Min lease", value: l.minLeaseTerm ? l.minLeaseTerm + " months" : null },
      { key: "Locker", value: l.locker },
      { key: "Includes", value: l.rentIncludes?.length ? l.rentIncludes.join(", ") : null },
    ]}] : []),
  ];

  return (
    <>
      <div className="max-w-6xl mx-auto px-5 sm:px-11 py-6">
        {/* ═══ PHOTO GALLERY — Redfin-style grid ═══ */}
        <div className="mb-6">
          {l.photos.length === 0 ? (
            <div className="rounded-2xl bg-[#07111f] aspect-[16/9] flex items-center justify-center text-[#475569]">No photos available</div>
          ) : l.photos.length === 1 ? (
            <div className="relative rounded-2xl overflow-hidden cursor-pointer" onClick={() => openGallery(0)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.photos[0]} alt={l.address} className="w-full aspect-[16/9] object-cover" />
            </div>
          ) : (
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] lg:h-[480px] rounded-2xl overflow-hidden">
              {/* Main large photo — spans 2 cols, 2 rows */}
              <div className="col-span-2 row-span-2 relative cursor-pointer" onClick={() => openGallery(0)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.photos[0]} alt={l.address} className="w-full h-full object-cover" />
                {l.virtualTourUrl && (
                  <a href={l.virtualTourUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-3 left-3 bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur-sm">🎥 3D Tour</a>
                )}
              </div>
              {/* 4 smaller photos in right half */}
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className={`relative cursor-pointer ${idx > l.photos.length - 1 ? "bg-[#f1f5f9]" : ""}`} onClick={() => idx <= l.photos.length - 1 && openGallery(idx)}>
                  {idx <= l.photos.length - 1 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[idx]} alt="" className="w-full h-full object-cover hover:brightness-90 transition-all" />
                  )}
                  {/* "See all X photos" button on last visible thumbnail */}
                  {idx === 4 && l.photos.length > 5 && (
                    <button onClick={(e) => { e.stopPropagation(); openGallery(4); }} className="absolute inset-0 bg-black/50 hover:bg-black/60 transition-colors flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                      <span className="text-[13px] font-bold mt-1">See all {l.photos.length}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          {/* ═══ LEFT COLUMN — MAIN CONTENT ═══ */}
          <div>
            {/* Price + status */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full" style={{ background: statusColor + "15", color: statusColor }}>{statusLabel}</span>
                <h1 className="text-[32px] font-extrabold text-[#07111f] tracking-[-0.5px] mt-2">{priceLabel}</h1>
                <p className="text-[14px] text-[#64748b] mt-1">{l.bedrooms} bd · {l.bathrooms} ba · {l.propertyType}{l.sqft ? ` · ${l.sqft.toLocaleString()} sqft` : ""}</p>
                <p className="text-[14px] text-[#07111f] font-medium mt-1">{l.address}</p>
              </div>
            </div>

            {/* Specs bar */}
            <div className="flex flex-wrap gap-4 py-4 my-4 border-y border-[#e2e8f0]">
              {[
                { icon: "🏠", label: l.propertyType, sub: l.architecturalStyle || "Residential" },
                l.totalRooms ? { icon: "🚪", label: `${l.totalRooms} rooms`, sub: `${l.kitchens || 1} kitchen` } : null,
                { icon: "🚗", label: `${l.parking} parking`, sub: l.garageType || "—" },
                l.taxAmount ? { icon: "📋", label: `$${Math.round(l.taxAmount).toLocaleString()}/yr`, sub: `Tax (${l.taxYear || "—"})` } : null,
                l.approximateAge ? { icon: "📅", label: l.approximateAge, sub: "Approx. age" } : null,
              ].filter(Boolean).map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 pr-4 border-r border-[#e2e8f0] last:border-0 last:pr-0">
                  <span className="text-[18px]">{s!.icon}</span>
                  <div>
                    <p className="text-[13px] font-bold text-[#07111f] capitalize">{s!.label}</p>
                    <p className="text-[10px] text-[#94a3b8]">{s!.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Listing info line */}
            <p className="text-[11px] text-[#94a3b8] mb-6">
              Listed {days === 0 ? "today" : `${days} days ago`} · Source: TREB MLS® {l.mlsNumber}
              {l.listOfficeName && ` · ${l.listOfficeName}`}
              {l.crossStreet && ` · Near ${l.crossStreet}`}
            </p>

            {/* ── About this home ── */}
            {l.description && (
              <div className="mb-8">
                <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">About this home</h2>
                <div className={`text-[13px] text-[#475569] leading-[1.8] ${showFullDesc ? "" : "line-clamp-4"}`}>
                  {l.description}
                </div>
                {l.description.length > 300 && (
                  <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-[12px] font-semibold text-[#2563eb] mt-2 hover:underline">
                    {showFullDesc ? "Show less ↑" : "Show more ↓"}
                  </button>
                )}
              </div>
            )}

            {/* ── Features ── */}
            {(l.interiorFeatures.length > 0 || l.exteriorFeatures.length > 0) && (
              <div className="mb-8">
                <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {l.interiorFeatures.map((f) => (
                    <span key={f} className="text-[11px] font-medium bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] rounded-lg px-3 py-1.5">{f}</span>
                  ))}
                  {l.exteriorFeatures.map((f) => (
                    <span key={f} className="text-[11px] font-medium bg-[#eff6ff] text-[#1e3a8a] border border-[#bfdbfe] rounded-lg px-3 py-1.5">{f}</span>
                  ))}
                  {l.fireplace && <span className="text-[11px] font-medium bg-[#fef3c7] text-[#92400e] border border-[#fde68a] rounded-lg px-3 py-1.5">🔥 Fireplace</span>}
                  {l.basement && <span className="text-[11px] font-medium bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] rounded-lg px-3 py-1.5">Basement</span>}
                </div>
              </div>
            )}

            {/* ── Property Details ── */}
            <div className="mb-8">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">Property details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {details.map((section) => {
                  const validItems = section.items.filter((i) => i.value);
                  if (validItems.length === 0) return null;
                  return (
                    <div key={section.label} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
                      <h3 className="text-[12px] font-bold text-[#07111f] uppercase tracking-[0.08em] mb-3 pb-2 border-b border-[#f1f5f9]">{section.label}</h3>
                      <div className="space-y-2">
                        {validItems.map((item) => (
                          <div key={item.key} className="flex justify-between text-[12px]">
                            <span className="text-[#94a3b8]">{item.key}</span>
                            <span className="text-[#07111f] font-medium text-right">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Around this home ── */}
            <div className="mb-8">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">Around this home</h2>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
                <div className="flex gap-6 mb-4 border-b border-[#f1f5f9] pb-3">
                  <span className="text-[12px] font-bold text-[#07111f] border-b-2 border-[#07111f] pb-3 -mb-[13px]">🎓 Schools</span>
                  <span className="text-[12px] text-[#94a3b8]">🏪 Places</span>
                  <span className="text-[12px] text-[#94a3b8]">🚂 Transit</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "Craig Kielburger Secondary School", dist: "Nearby", type: "Public, 9-12" },
                    { name: "Guardian Angels Catholic Elementary", dist: "Nearby", type: "Catholic, K-8" },
                    { name: "Sam Sherratt Public School", dist: "Nearby", type: "Public, K-8" },
                  ].map((school) => (
                    <div key={school.name} className="flex items-center justify-between py-2 border-b border-[#f8f9fb] last:border-0">
                      <div>
                        <p className="text-[13px] font-semibold text-[#07111f]">{school.name}</p>
                        <p className="text-[10px] text-[#94a3b8]">{school.type}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[#64748b]">{school.dist}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Mortgage / Rent estimate ── */}
            {monthlyPayment && (
              <div className="mb-8">
                <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">Mortgage estimate</h2>
                <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-[28px] font-extrabold text-[#07111f]">${monthlyPayment.toLocaleString()}</span>
                    <span className="text-[13px] text-[#94a3b8]">/month</span>
                  </div>
                  <p className="text-[11px] text-[#94a3b8]">Based on 20% down, 5% rate, 25-year amortization</p>
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#f1f5f9]">
                    <div><p className="text-[10px] text-[#94a3b8]">Down payment</p><p className="text-[13px] font-bold text-[#07111f]">{formatPriceFull(Math.round(l.price * 0.2))}</p></div>
                    <div><p className="text-[10px] text-[#94a3b8]">Loan amount</p><p className="text-[13px] font-bold text-[#07111f]">{formatPriceFull(Math.round(l.price * 0.8))}</p></div>
                    {l.taxAmount && <div><p className="text-[10px] text-[#94a3b8]">Property tax</p><p className="text-[13px] font-bold text-[#07111f]">${Math.round(l.taxAmount / 12).toLocaleString()}/mo</p></div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Street data link ── */}
            <div className="mb-8">
              <Link href={`/streets/${l.streetSlug}`} className="flex items-center justify-between bg-white rounded-xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[14px] font-bold text-[#07111f]">Street Intelligence</p>
                  <p className="text-[12px] text-[#64748b]">See sold prices, trends, and market data for this street</p>
                </div>
                <span className="text-[#f59e0b] text-lg">→</span>
              </Link>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN — SIDEBAR ═══ */}
          <div className="space-y-4 self-start">
            {/* CTA card */}
            <div className="bg-[#07111f] rounded-2xl p-6 sticky top-[70px]">
              <h3 className="text-[16px] font-extrabold text-[#f8f9fb] mb-1">{isRental ? "Book a showing" : "Request a showing"}</h3>
              <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-5">
                {isRental ? "See this rental in person — we respond within 15 minutes." : "Tour this home. No obligation, no pressure."}
              </p>
              <form className="space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = fd.get("name") as string;
                const phone = fd.get("phone") as string;
                if (!name || !phone) { showToast("Please enter name and phone."); return; }
                await submitLead({ firstName: name, phone, email: fd.get("email") as string || "", source: "listing-detail", intent: isRental ? "renter" : "buyer", street: l.address });
                showToast("✓ Showing request sent! We'll call you within 15 minutes.");
                e.currentTarget.reset();
              }}>
                <input name="name" placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
                <input name="phone" type="tel" placeholder="Phone number" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
                <input name="email" type="email" placeholder="Email (optional)" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
                <button type="submit" className="w-full bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#eab308] transition-colors">
                  {isRental ? "⏱ Book showing — 15 min response" : "Request a showing"}
                </button>
              </form>
              <p className="text-[10px] text-[#334155] text-center mt-3">Aamir Yaqoob · RE/MAX Realty Specialists</p>
            </div>

            {/* Quick facts */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
              <h3 className="text-[12px] font-bold text-[#07111f] uppercase tracking-[0.08em] mb-3">Quick facts</h3>
              <div className="space-y-2.5">
                {[
                  { label: "MLS®", value: l.mlsNumber },
                  { label: "Status", value: l.status },
                  { label: "Type", value: l.propertyType },
                  { label: "Listed", value: days === 0 ? "Today" : `${days} days ago` },
                  l.listOfficeName ? { label: "Brokerage", value: l.listOfficeName } : null,
                  l.directionFaces ? { label: "Faces", value: l.directionFaces } : null,
                  l.crossStreet ? { label: "Cross street", value: l.crossStreet } : null,
                  l.maintenanceFeeAmt ? { label: "Maintenance", value: `$${Math.round(l.maintenanceFeeAmt)}/mo` } : null,
                ].filter(Boolean).map((item) => (
                  <div key={item!.label} className="flex justify-between text-[12px]">
                    <span className="text-[#94a3b8]">{item!.label}</span>
                    <span className="text-[#07111f] font-medium capitalize">{item!.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AgentContactSection headline="Have questions about this property?" />

        {/* ═══ SIMILAR LISTINGS ═══ */}
        {similar.length > 0 && (
          <div className="mt-10 mb-8">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-4">Similar homes in Milton</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map((s) => (
                <Link key={s.mlsNumber} href={`/listings/${s.mlsNumber}`} className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-[120px] relative" style={{ background: s.photos[0] ? `url(${s.photos[0]}) center/cover` : "#e0f2fe" }} />
                  <div className="p-3">
                    <p className="text-[16px] font-extrabold text-[#07111f]">{formatPriceFull(s.price)}{s.transactionType === "For Lease" ? "/mo" : ""}</p>
                    <p className="text-[11px] text-[#64748b] truncate mt-0.5">{s.address.split(",")[0]}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-1">{s.bedrooms}bd · {s.bathrooms}ba · {s.propertyType}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* TREB disclaimer */}
        <p className="text-[10px] text-[#94a3b8] text-center py-6 border-t border-[#e2e8f0]">
          Data provided by TREB via Miltonly. MLS® {l.mlsNumber}. Information deemed reliable but not guaranteed. Updated daily.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#07111f] border border-[#22c55e] rounded-xl px-4 py-3 flex items-center gap-2 text-[13px] text-[#f8f9fb] shadow-lg">
          <span className="text-[#22c55e]">✓</span> {toast}
        </div>
      )}

      {/* ═══ FULLSCREEN PHOTO GALLERY MODAL ═══ */}
      {showGallery && (
        <div className="fixed inset-0 z-[100] bg-black">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="text-white">
              <p className="text-[14px] font-bold">{l.address}</p>
              <p className="text-[12px] text-white/60">{photoIdx + 1} of {l.photos.length} photos</p>
            </div>
            <button onClick={() => setShowGallery(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-[20px] transition-colors">✕</button>
          </div>

          {/* Main photo */}
          <div className="absolute inset-0 flex items-center justify-center px-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.photos[photoIdx]} alt={`Photo ${photoIdx + 1}`} className="max-w-full max-h-full object-contain" />
          </div>

          {/* Nav arrows */}
          <button onClick={prevPhoto} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white text-[24px] transition-colors">‹</button>
          <button onClick={nextPhoto} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white text-[24px] transition-colors">›</button>

          {/* Bottom thumbnail strip */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-4 px-5">
            <div className="flex gap-2 overflow-x-auto justify-center max-w-4xl mx-auto">
              {l.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="" onClick={() => setPhotoIdx(i)} className={`w-16 h-12 object-cover rounded-md cursor-pointer shrink-0 transition-all ${i === photoIdx ? "ring-2 ring-white opacity-100" : "opacity-50 hover:opacity-80"}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
