"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Handshake, Landmark, Eye } from "lucide-react";
import { config } from "@/lib/config";
import { formatPriceFull, daysAgo, cleanNeighbourhoodName } from "@/lib/format";
import LeadCaptureForm from "@/components/landing/LeadCaptureForm";
import StickyMobileBar from "@/components/landing/StickyMobileBar";
import PhotoLightbox from "@/components/landing/PhotoLightbox";
import AamirTrustCard from "@/components/landing/AamirTrustCard";
import LiveListingSlider from "@/components/landing/LiveListingSlider";
import HomeValuationCard from "@/components/landing/HomeValuationCard";
import { extractHighlights } from "@/lib/listing-highlights";
import { extractKeyFacts } from "@/lib/listing-key-facts";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];

const TYPE_DISPLAY_LABEL: Record<string, string> = {
  condo: "Condo",
  detached: "Detached",
  semi: "Semi-Detached",
  townhouse: "Townhouse",
};

interface Listing {
  mlsNumber: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  basement: boolean;
  sqft: number | null;
  propertyType: string;
  status: string;
  photos: string[];
  description: string | null;
  neighbourhood: string;
  listedAt: string;
  daysOnMarket: number | null;
  schoolZone: string | null;
  goWalkMinutes: number | null;
  heatType: string | null;
  heatSource: string | null;
  cooling: string | null;
  garageType: string | null;
  lotSize: string | null;
  approximateAge: string | null;
  architecturalStyle: string | null;
  taxAmount: number | null;
  taxYear: number | null;
  possessionDetails: string | null;
  interiorFeatures: string[];
  exteriorFeatures: string[];
  fireplace: boolean;
  construction: string | null;
  foundation: string | null;
  virtualTourUrl: string | null;
  lotWidth: number | null;
  lotDepth: number | null;
  crossStreet: string | null;
  directionFaces: string | null;
  roof: string | null;
  // Lease-specific fields consumed by the page directly + by extractKeyFacts
  // in lease mode. All optional on schema; defensive default to safe values.
  furnished: string | null;
  petsAllowed: string | null;
  rentIncludes: string[];
  laundryFeatures: string | null;
  locker: string | null;
  minLeaseTerm: number | null;
}

interface Props {
  listing: Listing;
  sliderListings: Listing[];
}

type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

function RentalsAdsInner({ listing, sliderListings }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  const streetAddr = listing.address.split(",")[0];
  const priceText = formatPriceFull(listing.price);
  const typeLabel = TYPE_DISPLAY_LABEL[listing.propertyType?.toLowerCase()] || listing.propertyType;
  const neighbourhoodClean = cleanNeighbourhoodName(listing.neighbourhood) || listing.neighbourhood || listing.city;
  const days = daysAgo(new Date(listing.listedAt));
  const photos = listing.photos || [];
  const totalPhotos = photos.length;

  const description = listing.description?.trim() || "";
  const DESC_TRUNCATE = 400;
  const descNeedsToggle = description.length > DESC_TRUNCATE;
  const descShown = descExpanded || !descNeedsToggle ? description : description.slice(0, DESC_TRUNCATE).replace(/\s+\S*$/, "") + "…";

  // Highlights — lease mode flips description-derived dollar-claim attribution
  // from "Seller notes" to "Owner notes" (extractHighlights second arg).
  const highlights = extractHighlights({
    description: listing.description,
    architecturalStyle: listing.architecturalStyle,
    approximateAge: listing.approximateAge,
    heatType: listing.heatType,
    cooling: listing.cooling,
    interiorFeatures: listing.interiorFeatures || [],
    exteriorFeatures: listing.exteriorFeatures || [],
    fireplace: listing.fireplace ?? false,
    construction: listing.construction,
    foundation: listing.foundation,
    virtualTourUrl: listing.virtualTourUrl,
  }, "For Lease");
  const highlightsHasContent = highlights.bullets.length > 0 || !!highlights.virtualTourUrl;

  // Key Facts — lease mode adds Furnished / Pets / Included-in-rent rows and
  // omits the Property taxes row (tenants don't pay it directly).
  const keyFacts = extractKeyFacts({
    mlsNumber: listing.mlsNumber,
    lotWidth: listing.lotWidth,
    lotDepth: listing.lotDepth,
    crossStreet: listing.crossStreet,
    directionFaces: listing.directionFaces,
    construction: listing.construction,
    roof: listing.roof,
    foundation: listing.foundation,
    fireplace: listing.fireplace ?? false,
    taxAmount: listing.taxAmount,
    taxYear: listing.taxYear,
    furnished: listing.furnished,
    petsAllowed: listing.petsAllowed,
    rentIncludes: listing.rentIncludes || [],
  }, "For Lease");

  const headerSms = `sms:${config.realtor.phoneE164}?body=${encodeURIComponent(`Hi ${REALTOR_FIRST_NAME}, I'd like info on the rental at ${streetAddr}`)}`;
  const headerTel = `tel:${config.realtor.phoneE164}`;

  const eventParams = useMemo(
    () => ({ listing_mls: listing.mlsNumber, listing_price: listing.price, transaction_type: "For Lease" }),
    [listing.mlsNumber, listing.price],
  );

  useEffect(() => {
    const gtag = getGtag();
    if (gtag) gtag('event', 'view_listing', {
      ...eventParams,
      neighbourhood: neighbourhoodClean,
      listing_address: streetAddr,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  function openLightbox(at: number) {
    setLightboxIndex(at);
    setLightboxOpen(true);
  }

  // Availability badge — possessionDetails is the closest schema proxy. Data
  // sampling shows ~66% of active leases carry a date or "Immediate"; the
  // rest fall back to "Available now" (matches sales-side pattern).
  const availabilityBadge = listing.possessionDetails && /\d/.test(listing.possessionDetails)
    ? `Available ${listing.possessionDetails}`
    : "Available now";

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f8f9fb] font-sans">
      {/* ── HEADER ── slim, sticky, two compact CTAs ── */}
      <header className="sticky top-0 z-50 bg-[#07111f]/95 backdrop-blur border-b border-[#1e3a5f]">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-[58px] px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label={`${config.SITE_NAME} home`}>
            <span className="text-[20px] font-extrabold tracking-[-0.5px]">
              <span className="text-[#f8f9fb]">{config.SITE_NAME.toLowerCase()}</span>
              <span className="text-[#f59e0b]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={headerSms}
              onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_text_header', eventParams); }}
              className="inline-flex items-center gap-1.5 bg-[#0c1e35] border border-[#1e3a5f] hover:border-[#f59e0b]/50 text-white text-[12px] sm:text-[13px] font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <span aria-hidden>💬</span>
              <span className="hidden sm:inline">Text {REALTOR_FIRST_NAME}</span>
              <span className="sm:hidden">Text</span>
            </a>
            <a
              href={headerTel}
              onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_call_header', eventParams); }}
              className="inline-flex items-center gap-1.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] text-[12px] sm:text-[13px] font-bold px-3 py-2 rounded-lg transition-colors"
            >
              <span aria-hidden>📞</span>
              <span className="hidden sm:inline">Call {REALTOR_FIRST_NAME}</span>
              <span className="sm:hidden">Call</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO PHOTO GRID ── desktop 3-photo composition, mobile primary +
          horizontal thumb strip. Plain <img> for the primary photo so the
          TREB CDN host doesn't need to live on next/image's remotePatterns
          allowlist (matches /sales/ads + /listings). */}
      <section className="bg-[#07111f] pt-4 sm:pt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="lg:grid lg:grid-cols-[1.85fr_1fr] lg:gap-3 lg:items-stretch">
            <button
              type="button"
              onClick={() => openLightbox(0)}
              className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#0c1e35] block w-full group"
              aria-label={`Open photo viewer (${totalPhotos} photos)`}
            >
              {photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photos[0]}
                  alt={`${streetAddr} primary photo`}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[60px] opacity-30">🏠</div>
              )}
              {days >= 0 && days <= 14 && (
                <span className="absolute top-3 left-3 bg-[#07111f]/90 backdrop-blur text-[10px] font-bold tracking-wider uppercase text-[#fbbf24] px-2.5 py-1 rounded">
                  NEW · {days}d ago
                </span>
              )}
              {totalPhotos > 0 && (
                <span className="absolute top-3 right-3 bg-[#07111f]/90 backdrop-blur text-[10px] font-bold tracking-wider uppercase text-white px-2.5 py-1 rounded">
                  1 of {totalPhotos}
                </span>
              )}
            </button>

            <div className="hidden lg:grid lg:grid-rows-2 lg:gap-3">
              <button
                type="button"
                onClick={() => openLightbox(1)}
                disabled={!photos[1]}
                className="relative rounded-xl overflow-hidden bg-[#0c1e35] disabled:opacity-40 disabled:cursor-default"
                aria-label="Open photo 2"
              >
                {photos[1] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[1]} alt={`${streetAddr} photo 2`} loading="eager" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[40px] opacity-20">🏠</div>
                )}
              </button>
              <button
                type="button"
                onClick={() => openLightbox(totalPhotos > 3 ? 3 : 2)}
                disabled={!photos[2]}
                className="relative rounded-xl overflow-hidden bg-[#0c1e35] disabled:opacity-40 disabled:cursor-default"
                aria-label={totalPhotos > 3 ? `Open all ${totalPhotos} photos` : "Open photo 3"}
              >
                {photos[2] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[2]} alt={totalPhotos > 3 ? "" : `${streetAddr} photo 3`} aria-hidden={totalPhotos > 3 ? true : undefined} loading="eager" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[40px] opacity-20">🏠</div>
                )}
                {totalPhotos > 3 && (
                  <span className="absolute inset-0 bg-[#07111f]/70 flex items-center justify-center text-white text-[15px] font-bold tracking-wide">
                    +{totalPhotos - 3} more
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="lg:hidden mt-2 flex gap-2 overflow-x-auto snap-x pb-1">
            {[1, 2, 3].map((idx) =>
              photos[idx] ? (
                <button key={idx} type="button" onClick={() => openLightbox(idx)} className="relative shrink-0 w-24 h-20 rounded overflow-hidden snap-start bg-[#0c1e35]" aria-label={`Open photo ${idx + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos[idx]} alt={`${streetAddr} photo ${idx + 1}`} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                </button>
              ) : null,
            )}
            {totalPhotos > 4 && (
              <button type="button" onClick={() => openLightbox(4)} className="relative shrink-0 w-24 h-20 rounded overflow-hidden snap-start bg-[#0c1e35]" aria-label={`Open all ${totalPhotos} photos`}>
                {photos[4] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[4]} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <span className="absolute inset-0 bg-[#07111f]/70 flex items-center justify-center text-white text-[11px] font-bold tracking-wider">
                  +{totalPhotos - 4}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── PROPERTY FACTS BAND ── */}
      <section className="bg-[#07111f] border-b border-[#1e3a5f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between gap-1 lg:gap-4">
            <div className="text-[28px] sm:text-[32px] lg:text-[36px] font-extrabold text-[#f8f9fb] leading-tight tracking-tight">
              {priceText}
              <span className="text-[14px] sm:text-[16px] font-semibold text-[#94a3b8] ml-1">/month</span>
            </div>
            <div className="text-[14px] sm:text-[15px] text-[#cbd5e1] font-medium">
              {streetAddr} · {listing.city}
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[14px] sm:text-[15px] text-[#cbd5e1] font-semibold">
            <span>🛏 {listing.bedrooms} bed</span>
            <span>🚿 {listing.bathrooms} bath</span>
            {listing.parking > 0 && <span>🚗 {listing.parking} parking</span>}
            <span>📐 {listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : "— sqft"}</span>
            <span>🏠 {typeLabel}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-block bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#fbbf24] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
              {typeLabel}
            </span>
            <span className="inline-block bg-[#0c1e35] border border-[#1e3a5f] text-[#cbd5e1] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
              {neighbourhoodClean}
            </span>
            <span className="inline-block bg-green-500/10 border border-green-500/30 text-green-300 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
              {availabilityBadge}
            </span>
          </div>
        </div>
      </section>

      {/* ── DESCRIPTION + LEAD FORM ──
          Right-column aside holds TWO white lead cards stacked: tenant
          intent on top, landlord intent below, plus the AamirTrustCard.
          Tenant card uses LeadCaptureForm variant="rental" → intent="renter"
          path on /api/leads, source="rentals-ads-tenant-top", value 2000.
          Landlord card uses HomeValuationCard with a lease-tagged source
          string + landlord-facing copy. */}
      <section className="bg-[#07111f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-8">
          <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[80px] lg:self-start space-y-4">
            {/* TENANT CARD — top of right column. White surface, branded
                amber kicker, "Send me details" CTA. Uses LeadCaptureForm
                rental variant; renter intent goes through the existing
                ads-rentals-lp path on /api/leads with this surface's
                source tag for attribution. */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="mb-4 pb-3 border-b border-[#f1f5f9]">
                <div className="text-[10px] font-medium tracking-[1.5px] uppercase text-[#f59e0b] mb-1.5">
                  Want to rent this home?
                </div>
                <h3 className="text-[18px] font-medium text-[#07111f] leading-[1.2] tracking-[-0.2px] mb-1">
                  Send me the details
                </h3>
                <p className="text-[12px] text-[#64748b] leading-[1.5]">
                  {config.sla.topFormSubline}
                </p>
              </div>
              <LeadCaptureForm
                variant="rental"
                source="rentals-ads-tenant-top"
                homeType={listing.propertyType?.toLowerCase() || "any"}
                formId="tenant-top"
                hideHeader
                chromeless
                ctaLabel="Send me details"
                leadValue={2000}
              />
            </div>

            {/* LANDLORD CARD — second white card. Reuses HomeValuationCard
                (same form shape: address + email + phone + notes + CASL).
                Source string flips to the landlord surface for attribution;
                the API treats it as intent="home-valuation" → Hot lead. */}
            <HomeValuationCard
              mlsNumber={listing.mlsNumber}
              source="rentals-ads-landlord-top"
              kicker="Want to lease your home?"
              title="Get my rental estimate"
              ctaLabel="Get my rental estimate"
              hint="Aamir personally reviews comparable leased units, current vacancy on similar properties, and seasonal demand. You'll get a written rental estimate within 24 hours by email."
              theme="light"
              leadValue={5000}
            />

            <AamirTrustCard
              listingAddress={streetAddr}
              mlsNumber={listing.mlsNumber}
            />
          </aside>

          <div className="lg:col-start-1 lg:row-start-1 min-w-0">
            {description && (
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6">
                <h2 className="text-[18px] sm:text-[20px] font-extrabold mb-3">About this rental</h2>
                <p className="text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed whitespace-pre-line">
                  {descShown}
                </p>
                {descNeedsToggle && (
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-3 text-[13px] font-bold text-[#fbbf24] hover:text-[#f59e0b] transition-colors"
                  >
                    {descExpanded ? "Show less" : "Show more"}
                  </button>
                )}

                <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                  {(listing.heatType || listing.heatSource) && (
                    <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                      <dt className="text-[#94a3b8]">Heat</dt>
                      <dd className="text-[#f8f9fb] font-semibold text-right">{listing.heatType || listing.heatSource}</dd>
                    </div>
                  )}
                  {listing.cooling && (
                    <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                      <dt className="text-[#94a3b8]">Cooling</dt>
                      <dd className="text-[#f8f9fb] font-semibold text-right">{listing.cooling}</dd>
                    </div>
                  )}
                  {listing.laundryFeatures && (
                    <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                      <dt className="text-[#94a3b8]">Laundry</dt>
                      <dd className="text-[#f8f9fb] font-semibold text-right">{listing.laundryFeatures}</dd>
                    </div>
                  )}
                  {listing.garageType && (
                    <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                      <dt className="text-[#94a3b8]">Parking</dt>
                      <dd className="text-[#f8f9fb] font-semibold text-right">{listing.garageType}</dd>
                    </div>
                  )}
                  {listing.locker && (
                    <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                      <dt className="text-[#94a3b8]">Locker</dt>
                      <dd className="text-[#f8f9fb] font-semibold text-right">{listing.locker}</dd>
                    </div>
                  )}
                  {listing.approximateAge && (
                    <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                      <dt className="text-[#94a3b8]">Year built</dt>
                      <dd className="text-[#f8f9fb] font-semibold text-right">{listing.approximateAge}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {highlightsHasContent && (
              <div className="mt-4 bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6">
                <h2 className="text-[18px] sm:text-[20px] font-extrabold mb-3">
                  Highlights from this listing
                </h2>
                {highlights.bullets.length > 0 && (
                  <ul className="space-y-2">
                    {highlights.bullets.map((b, i) => (
                      <li key={i} className="flex gap-3 text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed">
                        <span className="text-[#fbbf24] mt-[2px] shrink-0 text-[18px] leading-none" aria-hidden>•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {highlights.virtualTourUrl && (
                  <a
                    href={highlights.virtualTourUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-[#f59e0b] text-[#07111f] font-extrabold text-[14px] sm:text-[15px] px-5 py-3 rounded-lg transition-colors w-full sm:w-auto"
                  >
                    <span aria-hidden>▶</span>
                    View 3D virtual tour
                  </a>
                )}
              </div>
            )}

            {keyFacts.length > 0 && (
              <div className="mt-4 bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6">
                <h2 className="text-[18px] sm:text-[20px] font-extrabold mb-3">
                  Key facts
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {keyFacts.map((f, i) => (
                    <div key={i} className="min-w-0">
                      <dt className="text-[12px] sm:text-[13px] text-[#94a3b8] leading-snug">
                        {f.label}
                      </dt>
                      <dd className="text-[13px] sm:text-[14px] text-[#f8f9fb] font-medium mt-0.5 break-words">
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── LIVE LISTING SLIDER ── routes into /rentals/ads/[mlsNumber] and
          uses lease-tagged header/SMS copy via the routePrefix +
          transactionType props (added in this commit). */}
      <section className="bg-[#07111f] border-t border-[#1e3a5f] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <LiveListingSlider
            listings={sliderListings}
            currentMlsNumber={listing.mlsNumber}
            currentPropertyType={listing.propertyType}
            currentArchitecturalStyle={listing.architecturalStyle}
            currentApproximateAge={listing.approximateAge}
            currentListingAddr={streetAddr}
            routePrefix="/rentals/ads"
            transactionType="For Lease"
          />
        </div>
      </section>

      {/* ── ONE REPORT BAND ── single-card rental valuation surface.
          Lease market-pulse hidden for v1 (analytics path exists but the
          /api/leads + MarketPulseUnlockCard plumbing is sale-coupled —
          tracked as Week 1 follow-up). Heading reads as a singular
          report-prepared-by-Aamir promise. */}
      <section className="bg-[#07111f] border-t border-[#1e3a5f] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[10px] font-medium tracking-[1.5px] uppercase text-[#f59e0b] mb-2">
              Rental valuation
            </div>
            <h2 className="text-[24px] sm:text-[28px] font-medium text-[#f8f9fb] leading-[1.2] tracking-[-0.3px] max-w-[640px] mx-auto mb-2">
              One report Aamir prepares for serious landlords
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#94a3b8] leading-relaxed max-w-[520px] mx-auto">
              Tell {REALTOR_FIRST_NAME} about your property. He prepares each rental estimate by hand.
            </p>
          </div>

          <div className="max-w-[640px] mx-auto">
            <HomeValuationCard
              mlsNumber={listing.mlsNumber}
              source="rentals-ads-rental-valuation"
              kicker="Considering renting out your home?"
              title="What rent could your home command?"
              ctaLabel="Get my rental estimate"
              hint="Aamir personally reviews comparable leased units, current vacancy on similar properties, and seasonal demand. You'll get a written rental estimate within 24 hours by email."
              leadValue={5000}
            />
          </div>

          <div className="text-center mt-6">
            <a
              href={headerSms}
              onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_text_aamir_section_fallback', { listing_mls: listing.mlsNumber, source: "rentals-ads-section-fallback" }); }}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#fbbf24] hover:text-[#f59e0b] underline"
            >
              💬 Still have questions? Text {REALTOR_FIRST_NAME}.
            </a>
          </div>
        </div>
      </section>

      {/* ── WHY WORK WITH AAMIR ── three benefit cards. Same credentials
          as sales; copy adapted for the lease audience (tenant + landlord)
          per the language-swap rules. */}
      <section className="bg-[#07111f] border-t border-[#1e3a5f] py-12 sm:py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12 md:mb-14">
            <div className="text-[11px] font-medium tracking-[1.5px] uppercase text-[#f59e0b] mb-3">
              Why work with Aamir
            </div>
            <h2 className="text-[24px] sm:text-[28px] font-medium text-[#f8f9fb] leading-[1.2] tracking-[-0.4px] max-w-[560px] mx-auto mb-3">
              Three things you get that other realtors won&apos;t give you
            </h2>
            <p className="text-[14px] text-[#94a3b8] leading-[1.6] max-w-[480px] mx-auto">
              Tenant-side experience that pays for itself.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-[14px] md:gap-[18px]">
            <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[28px_24px] sm:p-[32px_28px] min-h-[340px] md:min-h-[380px] flex flex-col">
              <div className="w-[52px] h-[52px] rounded-[12px] bg-[#f59e0b]/[0.08] border border-[#f59e0b]/35 flex items-center justify-center mb-[22px]">
                <Handshake className="w-[26px] h-[26px] text-[#fbbf24]" aria-hidden />
              </div>
              <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-[-0.1px] mb-[14px]">
                Zero-cost world-class negotiating
              </h3>
              <p className="text-[13px] text-[#cbd5e1] leading-[1.7] flex-grow">
                Let me represent you on the tenant side at zero cost to you. The landlord pays my fee on most rental transactions. I&apos;ve negotiated $55M+ in {config.CITY_NAME} deals — that experience saves my tenants on every clause, every deposit, every condition.
              </p>
              <div className="mt-[22px] pt-[18px] border-t border-[#1e3a5f]">
                <div className="text-[11px] font-medium tracking-[0.4px] uppercase text-[#fbbf24]">
                  $55M+ negotiated · {config.realtor.yearsExperience} years
                </div>
              </div>
            </div>

            <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[28px_24px] sm:p-[32px_28px] min-h-[340px] md:min-h-[380px] flex flex-col">
              <div className="w-[52px] h-[52px] rounded-[12px] bg-[#f59e0b]/[0.08] border border-[#f59e0b]/35 flex items-center justify-center mb-[22px]">
                <Landmark className="w-[26px] h-[26px] text-[#fbbf24]" aria-hidden />
              </div>
              <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-[-0.1px] mb-[14px]">
                Better mortgage rates when you&apos;re ready to buy
              </h3>
              <p className="text-[13px] text-[#cbd5e1] leading-[1.7] flex-grow">
                Renting now, buying later? My broker partners frequently beat the big banks by 0.25–0.50%. On a $700,000 mortgage, that&apos;s $14,000+ saved over the term. Same network is open to landlords looking at refinancing.
              </p>
              <div className="mt-[22px] pt-[18px] border-t border-[#1e3a5f]">
                <div className="text-[11px] font-medium tracking-[0.4px] uppercase text-[#fbbf24]">
                  $14K+ saved on a $700K mortgage
                </div>
              </div>
            </div>

            <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[28px_24px] sm:p-[32px_28px] min-h-[340px] md:min-h-[380px] flex flex-col">
              <div className="w-[52px] h-[52px] rounded-[12px] bg-[#f59e0b]/[0.08] border border-[#f59e0b]/35 flex items-center justify-center mb-[22px]">
                <Eye className="w-[26px] h-[26px] text-[#fbbf24]" aria-hidden />
              </div>
              <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-[-0.1px] mb-[14px]">
                10,000+ homes worth of hidden-defect radar
              </h3>
              <p className="text-[13px] text-[#cbd5e1] leading-[1.7] flex-grow">
                After walking through 10,000+ {config.CITY_NAME} homes in {config.realtor.yearsExperience} years, I spot what listing agents won&apos;t mention and what tenants miss — foundation hints, layout dead-ends, neighbourhood quirks. The stuff you&apos;d regret in month three but can&apos;t see in a 30-minute showing.
              </p>
              <div className="mt-[22px] pt-[18px] border-t border-[#1e3a5f]">
                <div className="text-[11px] font-medium tracking-[0.4px] uppercase text-[#fbbf24]">
                  10,000+ homes walked
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SLIM FOOTER ── */}
      <footer className="bg-[#07111f] border-t border-[#1e3a5f] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <Link href="/" className="shrink-0">
              <span className="text-[17px] font-extrabold">
                <span className="text-[#f8f9fb]">{config.SITE_NAME.toLowerCase()}</span>
                <span className="text-[#f59e0b]">.</span>
              </span>
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px]">
              <Link href="/privacy" className="text-[#94a3b8] hover:text-[#f8f9fb]">Privacy Policy</Link>
              <Link href="/terms" className="text-[#94a3b8] hover:text-[#f8f9fb]">Terms</Link>
              <Link href="/about" className="text-[#94a3b8] hover:text-[#f8f9fb]">About</Link>
              <a href={headerTel} className="text-[#94a3b8] hover:text-[#f8f9fb]">{config.realtor.phone}</a>
            </nav>
          </div>
          <div className="text-center text-[11px] text-[#64748b] leading-relaxed">
            © 2026 {config.SITE_DOMAIN} · {config.realtor.name}, {config.realtor.title} · {config.brokerage.name}<br />
            <span className="text-[#64748b]/80">
              MLS® listings displayed courtesy of the Toronto Regional Real Estate Board (TRREB). Information deemed reliable but not guaranteed.
            </span>
          </div>
        </div>
      </footer>

      <StickyMobileBar
        primaryAction={headerSms}
        primaryLabel={`💬 Text ${REALTOR_FIRST_NAME}`}
      />
      <StickyBarGaTracker eventParams={eventParams} />

      <PhotoLightbox
        photos={photos}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

// Delegates clicks on the sticky mobile bar's tel: / sms: links to GA4
// without modifying StickyMobileBar. Mirrors the sales-page tracker but
// emits lease-tagged event names + source so the two surfaces report
// separately.
function StickyBarGaTracker({ eventParams }: { eventParams: Record<string, unknown> }) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const anchor = t?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const bar = anchor.closest('[data-sticky-bar]') as HTMLElement | null
        ?? (anchor.closest("div.md\\:hidden.fixed.bottom-0") as HTMLElement | null);
      if (!bar) return;
      const href = anchor.getAttribute("href") || "";
      const gtag = getGtag();
      if (!gtag) return;
      if (href.startsWith("tel:")) {
        gtag('event', 'click_call_sticky', eventParams);
      } else if (href.startsWith("sms:")) {
        gtag('event', 'click_text_aamir_sticky', { ...eventParams, source: "rentals-ads-sticky-mobile" });
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [eventParams]);
  return null;
}

export default function RentalsAdsClient(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111f]" />}>
      <RentalsAdsInner {...props} />
    </Suspense>
  );
}
