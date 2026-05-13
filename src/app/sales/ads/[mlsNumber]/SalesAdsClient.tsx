"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { config } from "@/lib/config";
import { formatPriceFull, daysAgo, cleanNeighbourhoodName } from "@/lib/format";
import LeadCaptureForm from "@/components/landing/LeadCaptureForm";
import TrustPillars from "@/components/landing/TrustPillars";
import StickyMobileBar from "@/components/landing/StickyMobileBar";
import PhotoLightbox from "@/components/landing/PhotoLightbox";
import UnlockModal from "@/app/rentals/ads/UnlockModal";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");

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
  taxAmount: number | null;
  taxYear: number | null;
  possessionDetails: string | null;
}

interface Props {
  listing: Listing;
  relatedListings: Listing[];
}

// Deterministic 1-12 viewer-count badge per mlsNumber. Stable across reloads
// so the listing always shows the same "X viewed in last hour" count.
// Not real tracking — placeholder for a future analytics integration.
function pseudoViewerCount(mlsNumber: string): number {
  let h = 0;
  for (let i = 0; i < mlsNumber.length; i++) {
    h = (h * 31 + mlsNumber.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 12) + 1;
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

function SalesAdsInner({ listing, relatedListings }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const streetAddr = listing.address.split(",")[0];
  const priceText = formatPriceFull(listing.price);
  const typeLabel = TYPE_DISPLAY_LABEL[listing.propertyType?.toLowerCase()] || listing.propertyType;
  const neighbourhoodClean = cleanNeighbourhoodName(listing.neighbourhood) || listing.neighbourhood || listing.city;
  const days = daysAgo(new Date(listing.listedAt));
  const photos = listing.photos || [];
  const totalPhotos = photos.length;
  const viewerCount = useMemo(() => pseudoViewerCount(listing.mlsNumber), [listing.mlsNumber]);

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

  const showCommunityStats =
    listing.goWalkMinutes !== null ||
    !!listing.schoolZone ||
    listing.daysOnMarket !== null ||
    days >= 0;

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

              {/* Related listings */}
              {relatedListings.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-[20px] sm:text-[24px] font-extrabold mb-4">
                    More like this in {neighbourhoodClean}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {relatedListings.map((l) => {
                      const lStreet = l.address.split(",")[0];
                      const lType = TYPE_DISPLAY_LABEL[l.propertyType?.toLowerCase()] || l.propertyType;
                      return (
                        <button
                          key={l.mlsNumber}
                          type="button"
                          onClick={() => setUnlockOpen(true)}
                          className="group relative block text-left bg-[#0c1e35] border border-[#1e3a5f] rounded-xl overflow-hidden hover:border-[#f59e0b]/50 transition-all"
                          aria-label="Unlock this listing"
                        >
                          <div
                            className="aspect-[4/3] bg-[#1e3a5f] bg-center bg-cover relative"
                            style={l.photos[0] ? { backgroundImage: `url(${l.photos[0]})`, filter: "blur(14px) saturate(0.7)" } : {}}
                          >
                            {!l.photos[0] && (
                              <div className="absolute inset-0 flex items-center justify-center text-[40px] opacity-30">🏠</div>
                            )}
                          </div>
                          <div className="p-4 relative">
                            {lType && (
                              <span className="inline-block bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#fbbf24] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 mb-2">
                                {lType}
                              </span>
                            )}
                            <div className="text-[20px] font-extrabold text-[#f8f9fb] mb-1 select-none">
                              <span className="blur-[6px]">$X,XXX,XXX</span>
                            </div>
                            <div className="text-[13px] font-semibold text-[#cbd5e1] mb-2 line-clamp-1 blur-[5px] select-none">{lStreet}</div>
                            <div className="flex gap-3 text-[12px] text-[#94a3b8] blur-[4px] select-none mb-3">
                              <span>🛏 {l.bedrooms} bed</span>
                              <span>🚿 {l.bathrooms} bath</span>
                            </div>
                            <span className="block w-full text-center bg-[#f59e0b] group-hover:bg-[#fbbf24] text-[#07111f] font-extrabold rounded-lg py-3 min-h-[48px] inline-flex items-center justify-center gap-1.5 text-[14px] transition-colors">
                              <Lock className="w-4 h-4" aria-hidden />
                              Unlock
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — top form + trust card (sticky on desktop) */}
            <aside className="lg:sticky lg:top-[80px] lg:self-start">
              <div className="bg-[#fef3c7] rounded-2xl p-3 shadow-2xl">
                <LeadCaptureForm
                  variant="sales"
                  source="sales-rentals-featured-top"
                  mlsNumber={listing.mlsNumber}
                  headline={`Book a showing — ${streetAddr}`}
                  subheadline={`${REALTOR_FIRST_NAME} confirms within 4 business hours.`}
                  ctaLabel="Send me details →"
                />
                <div className="mt-2 text-center text-[12px] text-[#92400e]">
                  Or text {REALTOR_FIRST_NAME} directly
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <a
                      href={headerSms}
                      onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_text_aamir_card', eventParams); }}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-[#07111f] underline"
                    >
                      💬 Text
                    </a>
                    <span className="text-[#92400e]">·</span>
                    <a
                      href={headerTel}
                      onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_call_aamir_card', eventParams); }}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-[#07111f] underline"
                    >
                      📞 Call
                    </a>
                  </div>
                </div>
              </div>

              {/* Trust card below the form */}
              <div className="mt-4 bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-4">
                <TrustPillars variant="stacked" />
                <div className="mt-4 flex items-center gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-[#07111f] border border-[#f59e0b]/40 text-[#fbbf24] font-extrabold text-[18px] flex items-center justify-center">
                    AY
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#f8f9fb] leading-tight">
                      {config.realtor.name} · RE/MAX Hall of Fame
                    </div>
                    <div className="text-[11px] text-[#94a3b8]">
                      {config.realtor.yearsExperience} yrs · 150+ {config.CITY_NAME} families · $55M+
                    </div>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-full px-3 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fbbf24] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f59e0b]" />
                  </span>
                  <span className="text-[11px] font-bold tracking-wider text-[#fbbf24] uppercase">
                    {viewerCount} viewed in last hour
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── COMMUNITY STATS ── */}
      {showCommunityStats && (
        <section className="bg-[#0a1628] border-t border-[#1e3a5f] py-10 sm:py-14 mt-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-[20px] sm:text-[24px] font-extrabold mb-5">
              About {neighbourhoodClean}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {listing.goWalkMinutes !== null && (
                <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Walk to GO</div>
                  <div className="text-[18px] font-extrabold text-[#f8f9fb]">{listing.goWalkMinutes} min</div>
                </div>
              )}
              {listing.schoolZone && (
                <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">School zone</div>
                  <div className="text-[14px] sm:text-[15px] font-bold text-[#f8f9fb] line-clamp-2">{listing.schoolZone}</div>
                </div>
              )}
              {listing.daysOnMarket !== null && (
                <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Days on market</div>
                  <div className="text-[18px] font-extrabold text-[#f8f9fb]">{listing.daysOnMarket}d</div>
                </div>
              )}
              {days >= 0 && (
                <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Listed</div>
                  <div className="text-[18px] font-extrabold text-[#f8f9fb]">{days}d ago</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── BOOK A SHOWING BAND ── */}
      <section id="book-showing-form" className="bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-6 text-[#07111f]">
            <h2 className="text-[26px] sm:text-[34px] font-extrabold mb-2 leading-tight">
              Book a showing — {streetAddr}
            </h2>
            <p className="text-[14px] sm:text-[16px] text-[#07111f]/80">
              {priceText} · {REALTOR_FIRST_NAME} confirms in 4 business hours
            </p>
          </div>
          <LeadCaptureForm
            variant="sales"
            source="sales-rentals-featured-book"
            mlsNumber={listing.mlsNumber}
            headline="Book a showing"
            subheadline={`${streetAddr} · ${priceText}`}
            ctaLabel="Book my showing →"
          />
          <div className="mt-4 text-center text-[13px] text-[#07111f]/80">
            Prefer to skip the form?{" "}
            <a
              href={headerSms}
              onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_text_book_band', eventParams); }}
              className="font-bold text-[#07111f] underline"
            >
              💬 Text {REALTOR_FIRST_NAME}
            </a>
            <span className="mx-2">·</span>
            <a
              href={headerTel}
              onClick={() => { const gtag = getGtag(); if (gtag) gtag('event', 'click_call_book_band', eventParams); }}
              className="font-bold text-[#07111f] underline"
            >
              📞 Call {REALTOR_FIRST_NAME}
            </a>
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
            © 2026 {config.SITE_DOMAIN} · {config.realtor.name}, {config.realtor.title} · {BROKERAGE_SHORT_NAME}<br />
            <span className="text-[#64748b]/80">
              MLS® listings displayed courtesy of the Toronto Regional Real Estate Board (TRREB). Information deemed reliable but not guaranteed.
            </span>
          </div>
        </div>
      </footer>

      {/* ── STICKY MOBILE BAR ── overrides primary action to scroll to booking band */}
      <StickyMobileBar
        primaryAction="#book-showing-form"
        primaryLabel="Book showing →"
      />
      {/* GA4 events for the sticky bar's call button. The StickyMobileBar
          component owns the tel: link itself, so we register a delegated
          listener instead of modifying the component. Mounted via useEffect
          would race; doing it inline via a hidden tag is simpler. */}
      <StickyBarGaTracker eventParams={eventParams} />

      {/* ── LIGHTBOX ── */}
      <PhotoLightbox
        photos={photos}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      {/* ── UNLOCK MODAL ── reused from /rentals/ads ── */}
      <UnlockModal
        isOpen={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        initialType={listing.propertyType}
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
      } else if (href.startsWith("#") || href.includes("book-showing-form")) {
        gtag('event', 'click_text_sticky', eventParams);
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
