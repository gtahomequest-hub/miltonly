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
import MarketPulseUnlockCard from "@/components/landing/MarketPulseUnlockCard";
import HomeValuationCard from "@/components/landing/HomeValuationCard";

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
  // 4l-fix: TRREB-native storeys/archetype signal used by LiveListingSlider's
  // similar-listings matcher (e.g. "2-Storey", "Bungalow", "Backsplit 3").
  architecturalStyle: string | null;
  taxAmount: number | null;
  taxYear: number | null;
  possessionDetails: string | null;
}

interface Props {
  listing: Listing;
  // Slider row shape is a structural subset of Listing — TS structural typing
  // accepts the wider array when passed to the slider's narrower prop.
  sliderListings: Listing[];
}

// GA4 typing helper. Each event fires inline at the call site so every
// `gtag('event', '<name>', ...)` is grep-discoverable for the regression
// audit. No indirection.
type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

function SalesAdsInner({ listing, sliderListings }: Props) {
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

  const headerSms = `sms:${config.realtor.phoneE164}?body=${encodeURIComponent(`Hi ${REALTOR_FIRST_NAME}, I'd like info on ${streetAddr}`)}`;
  const headerTel = `tel:${config.realtor.phoneE164}`;

  const eventParams = useMemo(
    () => ({ listing_mls: listing.mlsNumber, listing_price: listing.price }),
    [listing.mlsNumber, listing.price],
  );

  // Single view_listing fire on mount.
  useEffect(() => {
    const gtag = getGtag();
    if (gtag) gtag('event', 'view_listing', {
      ...eventParams,
      neighbourhood: neighbourhoodClean,
      listing_address: streetAddr,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth scroll for in-page anchors (e.g. sticky mobile bar → book band).
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  function openLightbox(at: number) {
    setLightboxIndex(at);
    setLightboxOpen(true);
  }

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

      {/* ── HERO + LISTING FACTS ── two-column on desktop ── */}
      <section className="bg-[#07111f] pt-4 sm:pt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-8">
            {/* LEFT — photos + facts + about + related */}
            <div className="min-w-0">
              {/* Photo grid */}
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2 sm:gap-3">
                {/* Primary photo */}
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  className="relative overflow-hidden rounded-xl group block w-full h-[240px] sm:h-[420px] bg-[#0c1e35]"
                  aria-label={`Open photo viewer (${totalPhotos} photos)`}
                >
                  {photos[0] ? (
                    // External TREB CDN photos — plain <img>, not next/image,
                    // matching the existing /rentals/ads and /listings patterns
                    // (no images.remotePatterns whitelist for the TREB host).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photos[0]}
                      alt={`${streetAddr} primary photo`}
                      loading="eager"
                      className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[60px] opacity-30">🏠</div>
                  )}
                  {/* Top-left freshness badge */}
                  {days >= 0 && days <= 14 && (
                    <span className="absolute top-3 left-3 bg-[#07111f]/90 backdrop-blur text-[10px] font-bold tracking-wider uppercase text-[#fbbf24] px-2.5 py-1 rounded">
                      NEW · {days}d ago
                    </span>
                  )}
                  {/* Top-right photo counter */}
                  {totalPhotos > 0 && (
                    <span className="absolute top-3 right-3 bg-[#07111f]/90 backdrop-blur text-[10px] font-bold tracking-wider uppercase text-white px-2.5 py-1 rounded">
                      1 of {totalPhotos}
                    </span>
                  )}
                  {/* Bottom price + address overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-[#07111f]/95 via-[#07111f]/60 to-transparent">
                    <div className="text-[24px] sm:text-[28px] font-extrabold text-white leading-tight">{priceText}</div>
                    <div className="text-[13px] sm:text-[14px] text-[#cbd5e1] font-semibold">
                      {streetAddr} · {listing.city}
                    </div>
                  </div>
                  {/* See-all-photos overlay (bottom-right) */}
                  {totalPhotos > 1 && (
                    <span className="absolute bottom-3 right-3 hidden sm:inline-flex items-center gap-1.5 bg-white/95 text-[#07111f] text-[12px] font-bold px-3 py-1.5 rounded-lg">
                      See all {totalPhotos} photos
                    </span>
                  )}
                </button>

                {/* Secondary thumbnails (desktop only) */}
                <div className="hidden sm:grid grid-rows-2 gap-3">
                  {[1, 2].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openLightbox(Math.min(i, Math.max(0, totalPhotos - 1)))}
                      disabled={!photos[i]}
                      className="relative overflow-hidden rounded-xl bg-[#0c1e35] w-full h-[202px] disabled:opacity-40 disabled:cursor-default"
                      aria-label={photos[i] ? `Open photo ${i + 1}` : "No additional photo"}
                    >
                      {photos[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photos[i]}
                          alt={`${streetAddr} photo ${i + 1}`}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[40px] opacity-20">🏠</div>
                      )}
                      {i === 2 && totalPhotos > 3 && (
                        <span className="absolute inset-0 bg-[#07111f]/70 flex items-center justify-center text-white text-[14px] font-bold">
                          +{totalPhotos - 3} more
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Facts row */}
              <div className="mt-4 sm:mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[14px] sm:text-[15px] text-[#cbd5e1] font-semibold">
                <span>🛏 {listing.bedrooms} bed</span>
                <span>🚿 {listing.bathrooms} bath</span>
                {listing.parking > 0 && <span>🚗 {listing.parking} parking</span>}
                <span>📐 {listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : "— sqft"}</span>
                <span>🏠 {typeLabel}</span>
              </div>

              {/* Badge row */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-block bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#fbbf24] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
                  {typeLabel}
                </span>
                <span className="inline-block bg-[#0c1e35] border border-[#1e3a5f] text-[#cbd5e1] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
                  {neighbourhoodClean}
                </span>
                <span className="inline-block bg-green-500/10 border border-green-500/30 text-green-300 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
                  {listing.possessionDetails && /\d/.test(listing.possessionDetails)
                    ? listing.possessionDetails
                    : "Available now"}
                </span>
              </div>

              {/* About card */}
              {description && (
                <div className="mt-6 bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6">
                  <h2 className="text-[18px] sm:text-[20px] font-extrabold mb-3">About this property</h2>
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

                  {/* Quick facts */}
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
                    {listing.garageType && (
                      <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                        <dt className="text-[#94a3b8]">Parking</dt>
                        <dd className="text-[#f8f9fb] font-semibold text-right">{listing.garageType}</dd>
                      </div>
                    )}
                    {listing.lotSize && (
                      <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                        <dt className="text-[#94a3b8]">Lot size</dt>
                        <dd className="text-[#f8f9fb] font-semibold text-right">{listing.lotSize}</dd>
                      </div>
                    )}
                    {listing.approximateAge && (
                      <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                        <dt className="text-[#94a3b8]">Year built</dt>
                        <dd className="text-[#f8f9fb] font-semibold text-right">{listing.approximateAge}</dd>
                      </div>
                    )}
                    {listing.taxAmount && (
                      <div className="flex justify-between gap-3 border-b border-[#1e3a5f]/60 py-1.5">
                        <dt className="text-[#94a3b8]">Taxes</dt>
                        <dd className="text-[#f8f9fb] font-semibold text-right">
                          ${Math.round(listing.taxAmount).toLocaleString()}/year
                          {listing.taxYear ? ` (${listing.taxYear})` : ""}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

            </div>

            {/* RIGHT — top form + trust card (sticky on desktop). The
                AamirTrustCard subsumes the old text/call quick-actions and
                the stacked TrustPillars — both now live inside the card
                alongside the message-capture textarea. */}
            <aside className="lg:sticky lg:top-[80px] lg:self-start">
              {/* Top form — Polaroid layout to match the booking band. Narrower
                  than the band (column width) but same amber-frame + dominant
                  white card pattern for visual consistency across both
                  conversion surfaces. */}
              <div className="bg-[#f59e0b] rounded-[14px] p-[12px]">
                <div className="bg-white rounded-[10px] px-[22px] pt-[24px] pb-[20px]">
                  <div className="mb-[18px] pb-[14px] border-b border-[#f1f5f9]">
                    <div className="text-[10px] font-medium tracking-[1.5px] uppercase text-[#f59e0b] mb-[6px]">
                      Get info on this listing
                    </div>
                    <h3 className="text-[18px] font-medium text-[#07111f] leading-[1.2] tracking-[-0.2px] mb-[4px]">
                      Send me the details
                    </h3>
                    <p className="text-[12px] text-[#64748b] leading-[1.5]">
                      {config.sla.topFormSubline}
                    </p>
                  </div>
                  <LeadCaptureForm
                    variant="sales"
                    source="sales-rentals-featured-top"
                    mlsNumber={listing.mlsNumber}
                    formId="top"
                    hideHeader
                    chromeless
                    ctaLabel="Send me details"
                  />
                </div>
              </div>

              <AamirTrustCard
                listingAddress={streetAddr}
                mlsNumber={listing.mlsNumber}
                className="mt-4"
              />
            </aside>
          </div>
        </div>
      </section>

      {/* ── LIVE LISTING SLIDER ── full-width band, between the two-column
          grid and the booking band. ~5 cards visible at a time at the
          page's max-w-6xl width, vs 2-3 when the slider lived inside the
          left column. The slider component handles its own card / track
          chrome — this wrapper just gives it page gutters and rhythm. */}
      <section className="bg-[#07111f] border-t border-[#1e3a5f] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <LiveListingSlider
            listings={sliderListings}
            currentMlsNumber={listing.mlsNumber}
            currentPropertyType={listing.propertyType}
            currentArchitecturalStyle={listing.architecturalStyle}
            currentApproximateAge={listing.approximateAge}
            currentListingAddr={streetAddr}
          />
        </div>
      </section>

      {/* ── TWO REPORTS LEAD MAGNET ── (Commit 4j) Replaces the duplicate
          booking band with a self-segmenting two-card section:
            Card 1 — Milton market pulse unlock (aggregate-only, VOW-safe).
            Card 2 — Home valuation request (manual CMA by Aamir).
          Soft-fallback SMS link beneath both for visitors who want neither
          form. Sticky mobile bar primary action now goes directly to an
          sms: deep link (no in-page anchor target needed). */}
      <section className="bg-[#07111f] border-t border-[#1e3a5f] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[10px] font-medium tracking-[1.5px] uppercase text-[#f59e0b] mb-2">
              Two reports
            </div>
            <h2 className="text-[24px] sm:text-[28px] font-medium text-[#f8f9fb] leading-[1.2] tracking-[-0.3px] max-w-[640px] mx-auto mb-2">
              Two reports Aamir prepares for serious {config.CITY_NAME} buyers
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#94a3b8] leading-relaxed max-w-[520px] mx-auto">
              Tell {REALTOR_FIRST_NAME} what you need. He prepares each one by hand.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <MarketPulseUnlockCard
              propertyType={listing.propertyType}
              neighbourhood={listing.neighbourhood}
              city={listing.city}
              mlsNumber={listing.mlsNumber}
            />
            <HomeValuationCard mlsNumber={listing.mlsNumber} />
          </div>

          <p className="text-center text-[12px] text-[#94a3b8] mt-6">
            {REALTOR_FIRST_NAME} prepares these reports for every serious {config.CITY_NAME} buyer.
          </p>

          <div className="text-center mt-3">
            <a
              href={headerSms}
              onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_text_aamir_section_fallback', { listing_mls: listing.mlsNumber, source: "sales-ads-section-fallback" }); }}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#fbbf24] hover:text-[#f59e0b] underline"
            >
              💬 Still have questions? Text {REALTOR_FIRST_NAME}.
            </a>
          </div>
        </div>
      </section>

      {/* ── WHY WORK WITH AAMIR ── three benefit cards, full-width band
          between the booking Polaroid and the footer. Cards stack vertically
          on mobile, sit in a 3-column grid on md+ with a min-height so the
          three card heights stay visually aligned. Each card: amber-accent
          icon block, title, value-prop body, amber stat footer above a thin
          divider. */}
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
              Buyer-side experience that pays for itself — every time.
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
                Let me represent you on the buyer side at zero cost to you. The seller pays my fee in every transaction. I&apos;ve negotiated $55M+ in {config.CITY_NAME} deals — that experience saves my buyers thousands on every offer, every closing condition, every counter.
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
                Better mortgage rates through my network
              </h3>
              <p className="text-[13px] text-[#cbd5e1] leading-[1.7] flex-grow">
                Looking for a sharper rate, or stuck waiting on pre-approval? My broker partners frequently beat the big banks by 0.25–0.50%. On a $700,000 mortgage, that&apos;s $14,000+ saved over the term — without lifting a finger to shop around yourself.
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
                After walking through 10,000+ {config.CITY_NAME} homes in {config.realtor.yearsExperience} years, I spot what listing agents won&apos;t mention and what buyers miss — foundation hints, layout dead-ends, neighbourhood quirks. The stuff you&apos;d regret in year two but can&apos;t see in 30 minutes.
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

      {/* ── STICKY MOBILE BAR ── (Commit 4j) Primary action is now an SMS
          deep link pre-filled with the listing's street address — replaces
          the previous anchor-to-form approach. */}
      <StickyMobileBar
        primaryAction={headerSms}
        primaryLabel={`💬 Text ${REALTOR_FIRST_NAME}`}
      />
      {/* GA4 delegated listener — fires click_call_sticky / click_text_aamir_sticky
          on tel: / sms: clicks inside the StickyMobileBar without modifying
          that component. */}
      <StickyBarGaTracker eventParams={eventParams} />

      {/* ── LIGHTBOX ── */}
      <PhotoLightbox
        photos={photos}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

// Delegates clicks on the sticky mobile bar's tel: / hash links to GA4
// without modifying StickyMobileBar. Adds a single capture listener and
// inspects the closest anchor target.
function StickyBarGaTracker({ eventParams }: { eventParams: Record<string, unknown> }) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const anchor = t?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      // Scope to the sticky bar container — checking the parent's classes
      // is brittle but the only stable signal we have without component
      // surgery. The bar is the only fixed-bottom md:hidden container.
      const bar = anchor.closest('[data-sticky-bar]') as HTMLElement | null
        ?? (anchor.closest("div.md\\:hidden.fixed.bottom-0") as HTMLElement | null);
      if (!bar) return;
      const href = anchor.getAttribute("href") || "";
      const gtag = getGtag();
      if (!gtag) return;
      if (href.startsWith("tel:")) {
        gtag('event', 'click_call_sticky', eventParams);
      } else if (href.startsWith("sms:")) {
        // Spec name per Commit 4j: click_text_aamir_sticky.
        gtag('event', 'click_text_aamir_sticky', { ...eventParams, source: "sales-ads-sticky-mobile" });
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [eventParams]);
  return null;
}

export default function SalesAdsClient(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111f]" />}>
      <SalesAdsInner {...props} />
    </Suspense>
  );
}
