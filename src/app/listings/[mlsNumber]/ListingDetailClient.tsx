"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { formatArchitecturalStyle } from "@/lib/listingStyle";
import { formatPriceFull } from "@/lib/format";
import { postLeadDetailed, type PostLeadPayload } from "@/lib/postLeadClient";
import { hashUserData } from "@/lib/hash";
import { config } from "@/lib/config";
import { REPLY_FINE_PRINT } from "@/lib/lead/finePrint";
import AgentContactSection from "@/components/AgentContactSection";
import ListingBrokerage, { brokerageDisplayName } from "@/components/listings/ListingBrokerage";
import {
  VOWTeaser, WhatsNearby, MortgageCalc, TypicalRentBlock, type ListingRentFigure,
  AudienceCTA, RentalBookingCard, SaveShareRow, MobileBottomBar,
} from "./ListingExtras";

interface Listing {
  mlsNumber: string; address: string; price: number; bedrooms: number; bathrooms: number;
  parking: number; propertyType: string; photos: string[];
  neighbourhood: string; description: string | null; streetSlug: string; latitude: number;
  longitude: number;
  /** resolved municipal rooftop — null when the Town has no point for this address */
  townLat: number | null; townLng: number | null; sqft: number | null; basement: boolean; lotSize: string | null;
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
  displayAddress: boolean;
}

interface SchoolLite {
  slug: string; name: string; board: string; level: string;
  grades: string; fraserScore: string | null; neighbourhood: string;
}

interface Extras {
  soldCountOnStreet: number;
  soldCountInHood: number;
  hoodName: string;
  /** the Board's k-gated lease figure for this home type; null below the floor */
  rent: ListingRentFigure | null;
  schools: SchoolLite[];
}

// MC-029: `listing` arrives without any VOW-only column (src/lib/listings/vow.ts) and is always
// an active, advertised listing: the page returns the not-available shell for anything else.
// `vowFacts` is the server-rendered island that fetches the withheld facts for an acknowledged
// session (ListingVowFacts); this component only places it.
interface Props { listing: Listing; similar: Listing[]; extras: Extras; vowFacts?: ReactNode }

const TC_SMALL = new Set(["of", "at", "the", "in", "and", "on", "for", "by", "to"]);
const TC_FIXUPS: Record<string, string> = { Remax: "RE/MAX", "Re/Max": "RE/MAX", Mls: "MLS", Ltd: "Ltd.", Inc: "Inc.", Re: "RE" };
function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  const out = s.toLowerCase().split(/(\s+|-|\/)/).map((t, i) => {
    if (!t.trim() || t === "/" || t === "-") return t;
    if (i > 0 && TC_SMALL.has(t)) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }).join("");
  return Object.entries(TC_FIXUPS).reduce((acc, [f, t]) => acc.replace(new RegExp(`\\b${f}\\b`, "g"), t), out);
}


export default function ListingDetailClient({ listing: l, similar, extras, vowFacts }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [toast, setToast] = useState("");
  const [showGallery, setShowGallery] = useState(false);
  const [saleFormSent, setSaleFormSent] = useState(false);

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
  const displayAddr = l.displayAddress ? titleCase(l.address) : "Address on request";
  const priceLabel = isRental ? formatPriceFull(l.price) + "/mo" : formatPriceFull(l.price);
  const statusLabel = isRental ? "FOR RENT" : "FOR SALE";
  const statusColor = isRental ? "#017848" : "#16a34a";
  const brokerage = brokerageDisplayName(l.listOfficeName);
  const pricePerSqft = l.sqft && !isRental ? Math.round(l.price / l.sqft) : null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // GA4 fires only on a confirmed write. The helper resolves false for a 429, a 500 and a
  // network failure alike, which is the difference between a conversion and an attempt.
  // Every submission from this page is a request for a reply, and the fine print under the
  // form is REPLY_FINE_PRINT, so the wrapper stamps it once rather than each caller.
  const submitLead = async (data: PostLeadPayload): Promise<boolean> => {
    const result = await postLeadDetailed({ ...data, consentText: REPLY_FINE_PRINT, consentTimestamp: new Date().toISOString() });
    if (!result.ok) return false;
    try {
      if (typeof window === "undefined") return true;
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      const transactionId = result.leadId || `no-lid-${Date.now()}`;
      const userData = await hashUserData(data.email, data.phone);
      const hasUserData = userData.sha256_email_address || userData.sha256_phone_number;
      let fired = false;
      const start = Date.now();
      const tryFire = () => {
        if (fired) return;
        if (typeof w.gtag === "function") {
          // See ThankYouClient.tsx — inline user_data is dropped by gtag.js for GA4.
          // Back-to-back set+event in the same tick is the canonical EC pattern.
          if (hasUserData) w.gtag("set", "user_data", userData);
          w.gtag("event", "generate_lead", {
            transaction_id: transactionId,
            value: 1.0,
            currency: "CAD",
            lead_id: result.leadId || transactionId,
          });
          fired = true;
          return;
        }
        if (Date.now() - start > 5000) return;
        setTimeout(tryFire, 200);
      };
      tryFire();
    } catch {}
    return true;
  };

  const scrollToCTA = () => {
    document.getElementById("sidebar-cta")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      { key: "Style", value: formatArchitecturalStyle(l.architecturalStyle) },
      { key: "Construction", value: l.construction },
      { key: "Roof", value: l.roof },
      { key: "Foundation", value: l.foundation },
      { key: "Approx. age", value: l.approximateAge },
      { key: "Faces", value: l.directionFaces },
    ]},
    { label: "Lot", items: [
      { key: "Lot size", value: l.lotWidth && l.lotDepth ? `${l.lotWidth}' × ${l.lotDepth}'` : l.lotSize },
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

  // Utility feature badges for rentals
  const utilBadges: { label: string; cls: string }[] = [];
  if (isRental) {
    const incl = (l.rentIncludes || []).map((x) => x.toLowerCase());
    [["Heat", "heat"], ["Hydro", "hydro"], ["Water", "water"]].forEach(([lbl, key]) => {
      const yes = incl.some((x) => x.includes(key));
      utilBadges.push({ label: `${lbl}: ${yes ? "Included" : "Tenant pays"}`, cls: yes ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]" : "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]" });
    });
    if (l.laundryFeatures) utilBadges.push({ label: `Laundry: ${l.laundryFeatures}`, cls: "bg-[#eef6f2] text-[#0b5c3a] border-[#bfe6d0]" });
    if (l.furnished && l.furnished !== "Unfurnished") utilBadges.push({ label: `${l.furnished}`, cls: "bg-[#e6f4ec] text-[#0b5c3a] border-[#bfe6d0]" });
    if (l.petsAllowed) utilBadges.push({ label: `Pets: ${l.petsAllowed}`, cls: "bg-[#f6f6f3] text-[#3e423f] border-[#dfe0dc]" });
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-5 sm:px-11 py-6 pb-24 md:pb-6">
        {/* ═══ PHOTO GALLERY ═══ */}
        <div className="mb-6">
          {l.photos.length === 0 ? (
            <div className="rounded-2xl bg-[#073126] aspect-[16/9] flex items-center justify-center text-[#3e423f]">No photos available</div>
          ) : l.photos.length === 1 ? (
            <div className="relative rounded-2xl overflow-hidden cursor-pointer" onClick={() => openGallery(0)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.photos[0]} alt={displayAddr} className="w-full aspect-[16/9] object-cover" />
            </div>
          ) : (
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] lg:h-[480px] rounded-2xl overflow-hidden">
              <div className="col-span-2 row-span-2 relative cursor-pointer" onClick={() => openGallery(0)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.photos[0]} alt={displayAddr} className="w-full h-full object-cover" />
              </div>
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className={`relative cursor-pointer ${idx > l.photos.length - 1 ? "bg-[#f6f6f3]" : ""}`} onClick={() => idx <= l.photos.length - 1 && openGallery(idx)}>
                  {idx <= l.photos.length - 1 && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={l.photos[idx]} alt="" className="w-full h-full object-cover hover:brightness-90 transition-all" />
                  )}
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

        {/* min-w-0 on both columns: a grid item's min-width is auto, and the wide rows inside
            (the photo grid, the chips) were forcing the column past the 390 viewport. */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          {/* ═══ LEFT ═══ */}
          <div className="min-w-0">
            {/* Price + status */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full" style={{ background: statusColor + "15", color: statusColor }}>{statusLabel}</span>
                </div>
                {/* The price and the brokerage share one styled wrapper, so the brokerage inherits
                    the price's size, weight and colour (TRREB item 27, MC-029); the h1 stays the
                    price alone. */}
                <div className="text-[32px] font-extrabold text-[#073126] tracking-[-0.5px]" data-price>
                  <h1>{priceLabel}</h1>
                  <ListingBrokerage name={l.listOfficeName} />
                </div>
                {pricePerSqft && (
                  <p className="text-[12px] text-[#6b6f6a] mt-0.5">${pricePerSqft.toLocaleString()}/sqft</p>
                )}
                <p className="text-[14px] text-[#6b6f6a] mt-1">{l.bedrooms} bd · {l.bathrooms} ba · {titleCase(l.propertyType)}{l.sqft ? ` · ${l.sqft.toLocaleString()} sqft` : ""}</p>
                <p className="text-[14px] text-[#073126] font-medium mt-1">{displayAddr}</p>
              </div>
            </div>

            {/* Virtual tour prominent CTA */}
            {l.virtualTourUrl && (
              <a href={l.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#073126] text-white font-bold text-[13px] px-5 py-2.5 rounded-lg hover:bg-[#0a3d30] transition-colors mb-4">
                🎥 Take the 3D tour →
              </a>
            )}

            {/* Specs bar */}
            <div className="flex flex-wrap gap-4 py-4 my-4 border-y border-[#dfe0dc]">
              {[
                { icon: "🏠", label: titleCase(l.propertyType), sub: formatArchitecturalStyle(l.architecturalStyle) ?? "Residential" },
                l.totalRooms ? { icon: "🚪", label: `${l.totalRooms} rooms`, sub: `${l.kitchens || 1} kitchen` } : null,
                { icon: "🚗", label: `${l.parking} parking`, sub: l.garageType || "—" },
                l.taxAmount ? { icon: "📋", label: `$${Math.round(l.taxAmount).toLocaleString()}/yr`, sub: `Tax (${l.taxYear || "—"})` } : null,
                l.approximateAge ? { icon: "📅", label: l.approximateAge, sub: "Approx. age" } : null,
              ].filter(Boolean).map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 pr-4 border-r border-[#dfe0dc] last:border-0 last:pr-0">
                  <span className="text-[18px]">{s!.icon}</span>
                  <div>
                    <p className="text-[13px] font-bold text-[#073126]">{s!.label}</p>
                    <p className="text-[10px] text-[#6b6f6a]">{s!.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Utility badges for rentals */}
            {isRental && utilBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {utilBadges.map((b, i) => (
                  <span key={i} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${b.cls}`}>{b.label}</span>
                ))}
              </div>
            )}

            {/* Listing info */}
            <p className="text-[11px] text-[#6b6f6a] mb-6">
              Source: TREB MLS® {l.mlsNumber}
              {brokerage && ` · ${brokerage}`}
              {l.crossStreet && ` · Near ${l.crossStreet}`}
            </p>

            {vowFacts}

            {/* The public remarks, the listing brokerage's words verbatim. data-remarks marks the
                block so the nightly audit reads it as third-party text and holds the rest of the
                page to the site's own voice (MA-003); the label is the reader's notice. */}
            {l.description && (
              <div className="mb-8" data-remarks>
                <h2 className="text-[18px] font-extrabold text-[#073126] mb-1">Listing agent&apos;s remarks</h2>
                <p className="text-[11px] text-[#6b6f6a] mb-3">As written by the listing brokerage, unedited.</p>
                <div className={`text-[13px] text-[#3e423f] leading-[1.8] ${showFullDesc ? "" : "line-clamp-4"}`}>
                  {l.description}
                </div>
                {l.description.length > 300 && (
                  <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-[12px] font-semibold text-[#017848] mt-2 hover:underline">
                    {showFullDesc ? "Show less ↑" : "Show more ↓"}
                  </button>
                )}
              </div>
            )}

            {/* Features */}
            {(l.interiorFeatures.length > 0 || l.exteriorFeatures.length > 0 || l.fireplace || l.basement) && (
              <div className="mb-8">
                <h2 className="text-[18px] font-extrabold text-[#073126] mb-3">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {l.interiorFeatures.map((f) => (
                    <span key={f} className="text-[11px] font-medium bg-[#f6f6f3] text-[#3e423f] border border-[#dfe0dc] rounded-lg px-3 py-1.5">{f}</span>
                  ))}
                  {l.exteriorFeatures.map((f) => (
                    <span key={f} className="text-[11px] font-medium bg-[#eef6f2] text-[#073126] border border-[#bfe6d0] rounded-lg px-3 py-1.5">{f}</span>
                  ))}
                  {l.fireplace && <span className="text-[11px] font-medium bg-[#e6f4ec] text-[#0b5c3a] border border-[#bfe6d0] rounded-lg px-3 py-1.5">🔥 Fireplace</span>}
                  {l.basement && <span className="text-[11px] font-medium bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] rounded-lg px-3 py-1.5">Basement</span>}
                </div>
              </div>
            )}

            {/* Property details */}
            <div className="mb-8">
              <h2 className="text-[18px] font-extrabold text-[#073126] mb-3">Property details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {details.map((section) => {
                  const validItems = section.items.filter((i) => i.value);
                  if (validItems.length === 0) return null;
                  return (
                    <div key={section.label} className="bg-white rounded-xl border border-[#dfe0dc] p-4">
                      <h3 className="text-[12px] font-bold text-[#073126] uppercase tracking-[0.08em] mb-3 pb-2 border-b border-[#f6f6f3]">{section.label}</h3>
                      <div className="space-y-2">
                        {validItems.map((item) => (
                          <div key={item.key} className="flex justify-between text-[12px]">
                            <span className="text-[#6b6f6a]">{item.key}</span>
                            <span className="text-[#073126] font-medium text-right">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* What's nearby */}
            <WhatsNearby lat={l.townLat ?? 0} lng={l.townLng ?? 0} schools={extras.schools.filter((s) => s.neighbourhood && l.neighbourhood.toLowerCase().includes(s.neighbourhood.toLowerCase())).slice(0, 5)} />

            {/* Mortgage (sales only) */}
            {!isRental && <MortgageCalc price={l.price} taxAmount={l.taxAmount} propertyType={l.propertyType} />}

            {/* Typical rent for this home type, the Board's closed leases (MH-008) */}
            {!isRental && <TypicalRentBlock rent={extras.rent} />}

            {/* VOW teaser */}
            <VOWTeaser mls={l.mlsNumber} soldCount={extras.soldCountOnStreet} hoodSoldCount={extras.soldCountInHood} hoodName={extras.hoodName} />

            {/* Audience CTA */}
            <AudienceCTA mls={l.mlsNumber} isRental={isRental} />

            {/* Street link */}
            <div className="mb-8">
              <Link href={`/streets/${l.streetSlug}`} className="flex items-center justify-between bg-white rounded-xl border border-[#dfe0dc] p-5 hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[14px] font-bold text-[#073126]">Street Intelligence</p>
                  <p className="text-[12px] text-[#6b6f6a]">See sold prices, trends, and market data for this street</p>
                </div>
                <span className="text-[#017848] text-lg">→</span>
              </Link>
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <div className="space-y-4 self-start min-w-0">
            <div id="sidebar-cta" className="sticky top-[70px] space-y-4">
              {isRental ? (
                <RentalBookingCard mls={l.mlsNumber} address={displayAddr} price={l.price} />
              ) : (
                <div className="bg-[#073126] rounded-2xl p-6">
                  <h3 className="text-[16px] font-extrabold text-[#fffdfa] mb-1">Request a showing</h3>
                  <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-5">Tour this home. No obligation, no pressure.</p>
                  {saleFormSent ? (
                    <p className="text-[13px] text-[#86efac] font-semibold">✓ Request sent. {config.realtor.name.split(" ")[0]} usually replies within the hour.</p>
                  ) : (
                    <form className="space-y-3" onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const name = fd.get("name") as string;
                      const phone = fd.get("phone") as string;
                      if (!name || !phone) { showToast("Please enter name and phone."); return; }
                      const ok = await submitLead({ source: "sale-detail", intent: "buy", name, phone, email: (fd.get("email") as string) || undefined, property_address: displayAddr, mlsNumber: l.mlsNumber });
                      if (!ok) { showToast("Could not submit. Please try again."); return; }
                      setSaleFormSent(true);
                    }}>
                      <input name="name" required placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-[#fffdfa] placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
                      <input name="phone" required type="tel" placeholder="Phone number" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-[#fffdfa] placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
                      <input name="email" type="email" placeholder="Email (optional)" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-[#fffdfa] placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
                      <button type="submit" className="w-full bg-[#00ff80] text-[#073126] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#5cffa8] transition-colors">Request a showing</button>
                      <p className="text-[10px] text-white/60 leading-snug">{REPLY_FINE_PRINT}</p>
                    </form>
                  )}
                  <p className="text-[10px] text-white/60 text-center mt-3">{config.realtor.name} · {config.brokerage.name.replace(", Brokerage", "")}</p>
                  <div className="flex gap-2 mt-2">
                    <a href={`tel:${config.realtor.phoneE164}`} className="flex-1 text-center text-[11px] font-bold text-[#00ff80] border border-[#1a5a47] rounded-lg py-2 hover:border-[#00ff80] transition-colors">📞 {config.realtor.phone}</a>
                    <a href="https://wa.me/16478399090" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[11px] font-bold text-white/60 border border-[#1a5a47] rounded-lg py-2 hover:border-[#00ff80] hover:text-[#00ff80] transition-colors">💬 WhatsApp</a>
                  </div>
                </div>
              )}

              <SaveShareRow mls={l.mlsNumber} address={displayAddr} isRental={isRental} />
            </div>

            {/* Quick facts */}
            <div className="bg-white rounded-2xl border border-[#dfe0dc] p-5">
              <h3 className="text-[12px] font-bold text-[#073126] uppercase tracking-[0.08em] mb-3">Quick facts</h3>
              <div className="space-y-2.5">
                {[
                  { label: "MLS®", value: l.mlsNumber },
                  { label: "Type", value: titleCase(l.propertyType) },
                  brokerage ? { label: "Brokerage", value: brokerage } : null,
                  l.directionFaces ? { label: "Faces", value: l.directionFaces } : null,
                  l.crossStreet ? { label: "Cross street", value: l.crossStreet } : null,
                  l.maintenanceFeeAmt ? { label: "Maintenance", value: `$${Math.round(l.maintenanceFeeAmt)}/mo` } : null,
                  l.taxAmount ? { label: "Annual tax", value: `$${Math.round(l.taxAmount).toLocaleString()}` } : null,
                ].filter(Boolean).map((item) => (
                  <div key={item!.label} className="flex justify-between text-[12px]">
                    <span className="text-[#6b6f6a]">{item!.label}</span>
                    <span className="text-[#073126] font-medium">{item!.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AgentContactSection headline="Have questions about this property?" />

        {/* Similar */}
        {similar.length > 0 && (
          <div className="mt-10 mb-8">
            <h2 className="text-[18px] font-extrabold text-[#073126] mb-4">Similar homes in {config.CITY_NAME}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map((s) => (
                <Link key={s.mlsNumber} href={`/listings/${s.mlsNumber}`} className="bg-white rounded-xl border border-[#dfe0dc] overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-[120px] relative" style={{ background: s.photos[0] ? `url(${s.photos[0]}) center/cover` : "#e6f4ec" }} />
                  <div className="p-3">
                    <p className="text-[16px] font-extrabold text-[#073126]" data-price>
                      {formatPriceFull(s.price)}{s.transactionType === "For Lease" ? "/mo" : ""}
                      <ListingBrokerage name={s.listOfficeName} />
                    </p>
                    <p className="text-[11px] text-[#6b6f6a] truncate mt-0.5">{s.displayAddress ? titleCase(s.address.split(",")[0]) : "Address on request"}</p>
                    <p className="text-[10px] text-[#6b6f6a] mt-1">{s.bedrooms}bd · {s.bathrooms}ba · {titleCase(s.propertyType)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-[#6b6f6a] text-center py-6 border-t border-[#dfe0dc]">
          Data provided by TREB via Miltonly. MLS® {l.mlsNumber}. Information deemed reliable but not guaranteed. Updated daily.
        </p>
      </div>

      <MobileBottomBar price={l.price} isRental={isRental} onBook={scrollToCTA} />

      {toast && (
        <div className="fixed bottom-20 right-5 z-50 bg-[#073126] border border-[#22c55e] rounded-xl px-4 py-3 flex items-center gap-2 text-[13px] text-[#fffdfa] shadow-lg">
          <span className="text-[#22c55e]">✓</span> {toast}
        </div>
      )}

      {showGallery && (
        <div className="fixed inset-0 z-[100] bg-black">
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="text-white">
              <p className="text-[14px] font-bold">{displayAddr}</p>
              <p className="text-[12px] text-white/60">{photoIdx + 1} of {l.photos.length} photos</p>
            </div>
            <button onClick={() => setShowGallery(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-[20px]">✕</button>
          </div>
          <div className="absolute inset-0 flex items-center justify-center px-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.photos[photoIdx]} alt={`Photo ${photoIdx + 1}`} className="max-w-full max-h-full object-contain" />
          </div>
          <button onClick={prevPhoto} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white text-[24px]">‹</button>
          <button onClick={nextPhoto} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white text-[24px]">›</button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-4 px-5">
            <div className="flex gap-2 overflow-x-auto justify-center max-w-4xl mx-auto">
              {l.photos.map((p, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={p} alt="" onClick={() => setPhotoIdx(i)} className={`w-16 h-12 object-cover rounded-md cursor-pointer shrink-0 transition-all ${i === photoIdx ? "ring-2 ring-white opacity-100" : "opacity-50 hover:opacity-80"}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
