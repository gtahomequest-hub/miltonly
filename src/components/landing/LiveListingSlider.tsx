"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPriceFull, daysAgo } from "@/lib/format";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];

// Active filter pills. "similar" is the default — the slider opens on
// homes most like the listing the visitor is currently viewing.
type FilterKey = "similar" | "detached" | "semi" | "townhouse" | "condo" | "all";

interface FilterDef {
  key: FilterKey;
  label: string;
}

const FILTERS: FilterDef[] = [
  { key: "similar", label: "Similar to this listing" },
  { key: "detached", label: "Detached" },
  { key: "semi", label: "Semi" },
  { key: "townhouse", label: "Townhouse" },
  { key: "condo", label: "Condo" },
  { key: "all", label: "All Milton" },
];

// Per-filter section header above the card row.
function headerForFilter(key: FilterKey, listingAddr: string): string {
  switch (key) {
    case "similar":
      return `Homes like ${listingAddr}`.toUpperCase();
    case "detached":
      return "DETACHED HOMES IN MILTON";
    case "semi":
      return "SEMI-DETACHED HOMES IN MILTON";
    case "townhouse":
      return "MILTON TOWNHOUSES FOR SALE";
    case "condo":
      return "MILTON CONDOS FOR SALE";
    case "all":
      return "ALL MILTON LISTINGS";
  }
}

// Per-filter SMS prefilled body for the trailing CTA card.
function smsBodyForFilter(key: FilterKey, listingAddr: string): string {
  switch (key) {
    case "similar":
      return `Hi Aamir, I'd like to see more homes similar to ${listingAddr}.`;
    case "detached":
      return `Hi Aamir, I'd like to see more detached homes in Milton.`;
    case "semi":
      return `Hi Aamir, I'd like to see more semi-detached homes in Milton.`;
    case "townhouse":
      return `Hi Aamir, I'd like to see more townhouses in Milton.`;
    case "condo":
      return `Hi Aamir, I'd like to see more condos in Milton.`;
    case "all":
      return `Hi Aamir, I'd like to see more Milton listings.`;
  }
}

export interface LiveListingSliderListing {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  photos: string[];
  listedAt: string;
  propertyType: string;
  /** Optional — only used by the "Similar" tier matcher; not rendered on
   *  cards. Old call sites that don't pass it still work; those listings
   *  just won't match Tier 1 / Tier 2 (same-neighbourhood) tightening. */
  neighbourhood?: string;
}

export interface LiveListingSliderProps {
  /** Broad pool of active listings — typically top 80 by listedAt. The
   *  component filters client-side per the active filter pill. */
  listings: LiveListingSliderListing[];
  /** MLS number of the listing the user is currently viewing. Excluded from
   *  every filter result + used in GA event params. */
  currentMlsNumber: string;
  /** Current listing's propertyType (e.g. "townhouse") — used by the
   *  "Similar" matcher's Tier 1-3 propertyType filter. */
  currentPropertyType: string;
  /** Current listing's bedroom count — used in Tier 1 ±1 bedroom match. */
  currentBedrooms: number;
  /** Current listing's neighbourhood — used in Tier 1+2 same-neighbourhood
   *  match. */
  currentNeighbourhood: string;
  /** Current listing's price — used in Tier 1 ±25% price match. */
  currentPrice: number;
  /** First-line street address of the current listing — used in the
   *  "Similar" header copy + SMS prefill body. */
  currentListingAddr: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

const MIN_VISIBLE = 3;
const SIMILAR_MIN_TIER_FLOOR = 5; // need at least 5 results to lock a tier
const PRICE_BAND_FRACTION = 0.25; // ±25% for Tier 1
const BEDROOMS_BAND = 1;          // ±1 bedroom for Tier 1
const IDLE_RESUME_MS = 5000;       // resume auto-scroll after 5s of no interaction
const AUTO_SCROLL_INTERVAL_MS = 50;
const AUTO_SCROLL_STEP_PX = 1;     // gentle drift — 20 px/sec at 50ms interval

type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

// Sort helper: newest listedAt first.
function byNewest(a: LiveListingSliderListing, b: LiveListingSliderListing): number {
  return new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime();
}

// Apply the active filter against the broad pool. Returns the cards the
// slider should render (in display order), excluding the current listing.
function filterListings(
  pool: LiveListingSliderListing[],
  filter: FilterKey,
  ctx: {
    mlsNumber: string;
    propertyType: string;
    bedrooms: number;
    neighbourhood: string;
    price: number;
  },
): LiveListingSliderListing[] {
  const eligible = pool.filter((l) => l.mlsNumber !== ctx.mlsNumber);

  if (filter === "all") {
    return [...eligible].sort(byNewest);
  }

  if (filter === "similar") {
    return computeSimilarTiered(eligible, ctx);
  }

  // Property-type filter (detached / semi / townhouse / condo).
  return eligible
    .filter((l) => (l.propertyType ?? "").toLowerCase() === filter)
    .sort(byNewest);
}

// "Similar to this listing" 4-tier matcher. Each tier loosens the criteria;
// stop at the first tier that yields >= SIMILAR_MIN_TIER_FLOOR cards.
function computeSimilarTiered(
  pool: LiveListingSliderListing[],
  ctx: {
    propertyType: string;
    bedrooms: number;
    neighbourhood: string;
    price: number;
  },
): LiveListingSliderListing[] {
  const ptKey = ctx.propertyType.toLowerCase();
  const minPrice = ctx.price * (1 - PRICE_BAND_FRACTION);
  const maxPrice = ctx.price * (1 + PRICE_BAND_FRACTION);

  // Tier 1 — tight match
  const tier1 = pool.filter(
    (l) =>
      (l.propertyType ?? "").toLowerCase() === ptKey &&
      l.neighbourhood === ctx.neighbourhood &&
      Math.abs(l.bedrooms - ctx.bedrooms) <= BEDROOMS_BAND &&
      l.price >= minPrice &&
      l.price <= maxPrice,
  );
  if (tier1.length >= SIMILAR_MIN_TIER_FLOOR) return tier1.sort(byNewest);

  // Tier 2 — same propertyType + same neighbourhood, any bedrooms / price
  const tier2 = pool.filter(
    (l) =>
      (l.propertyType ?? "").toLowerCase() === ptKey &&
      l.neighbourhood === ctx.neighbourhood,
  );
  if (tier2.length >= SIMILAR_MIN_TIER_FLOOR) return tier2.sort(byNewest);

  // Tier 3 — same propertyType, any neighbourhood (pool is already city-scoped)
  const tier3 = pool.filter(
    (l) => (l.propertyType ?? "").toLowerCase() === ptKey,
  );
  if (tier3.length >= SIMILAR_MIN_TIER_FLOOR) return tier3.sort(byNewest);

  // Tier 4 — final fallback: everything in the pool, sorted by recency.
  return [...pool].sort(byNewest);
}

export default function LiveListingSlider({
  listings,
  currentMlsNumber,
  currentPropertyType,
  currentBedrooms,
  currentNeighbourhood,
  currentPrice,
  currentListingAddr,
  className = "",
}: LiveListingSliderProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("similar");
  const [paused, setPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctx = useMemo(
    () => ({
      mlsNumber: currentMlsNumber,
      propertyType: currentPropertyType,
      bedrooms: currentBedrooms,
      neighbourhood: currentNeighbourhood,
      price: currentPrice,
    }),
    [currentMlsNumber, currentPropertyType, currentBedrooms, currentNeighbourhood, currentPrice],
  );

  const filtered = useMemo(
    () => filterListings(listings, activeFilter, ctx),
    [listings, activeFilter, ctx],
  );

  // Pause auto-scroll on any user interaction; resume after 5s of idle.
  function pauseAutoScroll() {
    setPaused(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setPaused(false);
      idleTimerRef.current = null;
    }, IDLE_RESUME_MS);
  }

  // Auto-scroll drift loop. Halts at end-of-track so the visitor naturally
  // lands on the trailing Text-Aamir CTA card. Respects prefers-reduced-
  // motion and the document-hidden state (no scroll while tab is in
  // background).
  useEffect(() => {
    if (paused) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      const el = scrollRef.current;
      if (!el || document.hidden) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) return; // at end
      el.scrollLeft += AUTO_SCROLL_STEP_PX;
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [paused, activeFilter]);

  // Cleanup the idle timer if the component unmounts mid-debounce.
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // When the filter changes, reset the scroll position so the visitor sees
  // the new first card from card 1.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    setCanScrollLeft(false);
    setCanScrollRight(el.clientWidth < el.scrollWidth - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, filtered.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    pauseAutoScroll();
  }

  function scrollByPage(direction: 1 | -1) {
    pauseAutoScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  function navigate(mlsNumber: string) {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "click_slider_listing", {
        slider_mls: mlsNumber,
        from_listing_mls: currentMlsNumber,
        active_filter: activeFilter,
      });
    }
    if (typeof window !== "undefined") {
      // Hard reload (not Next router push) — fresh server data on each
      // listing view, simpler analytics attribution.
      window.location.href = `/sales/ads/${mlsNumber}`;
    }
  }

  function handleCtaClick() {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "click_text_aamir_slider_cta", {
        source: "sales-ads-slider-cta",
        active_filter: activeFilter,
        listing_mls: currentMlsNumber,
      });
    }
  }

  // Auto-fallback for the default "similar" filter when the visitor lands
  // on a listing whose neighbourhood + property-type slice happens to be
  // thin enough that even Tier 4 yields zero. Flip the default to "all" so
  // the slider doesn't disappear on cold-traffic landings. Other filters
  // (Detached/Semi/Townhouse/Condo) returning 0 just hide the slider —
  // extremely unlikely in Milton inventory, and the spec accepts that.
  useEffect(() => {
    if (
      activeFilter === "similar" &&
      filtered.length === 0 &&
      listings.length >= MIN_VISIBLE
    ) {
      setActiveFilter("all");
    }
  }, [activeFilter, filtered.length, listings.length]);

  if (filtered.length === 0) return null;

  const header = headerForFilter(activeFilter, currentListingAddr);
  const smsBody = smsBodyForFilter(activeFilter, currentListingAddr);
  const smsHref = `sms:${config.realtor.phoneE164}?body=${encodeURIComponent(smsBody)}`;

  return (
    <section
      aria-label="Milton listings carousel"
      className={`relative left-1/2 -translate-x-1/2 w-screen bg-[#07111f] ${className}`}
    >
      {/* Component-scoped CSS — scrollbar hiding + hover-only arrow visibility. */}
      <style>{`
        .lls-scroll::-webkit-scrollbar { display: none; }
        .lls-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .lls-arrow { display: none; }
        @media (hover: hover) and (pointer: fine) {
          .lls-arrow { display: flex; }
        }
      `}</style>

      {/* Header strip — section title + LIVE pill. Header text reflects the
          active filter. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b]">
            {header}
          </div>
          <div className="text-[12px] font-medium text-[#cbd5e1] mt-0.5">
            Live MLS data · updated minutes ago
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.6px] text-green-300">
          <span className="relative flex h-[6px] w-[6px]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-green-500" />
          </span>
          Live
        </span>
      </div>

      {/* Filter pills row — single-select. Horizontally scrollable on mobile
          if the row overflows; pills never wrap to a second line. */}
      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-3 lls-scroll overflow-x-auto"
        role="group"
        aria-label="Filter listings"
      >
        <div className="flex gap-2">
          {FILTERS.map((f) => {
            const active = f.key === activeFilter;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setActiveFilter(f.key);
                  pauseAutoScroll();
                }}
                className={`shrink-0 inline-flex items-center justify-center min-h-[36px] px-3 rounded-full text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-[#f59e0b] text-[#07111f]"
                    : "bg-transparent border border-[#1e3a5f] text-[#cbd5e1] hover:border-[#f59e0b]/40"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card row + arrow buttons + edge fades. */}
      <div className="relative">
        {/* Left arrow — hover-only (hidden on touch via lls-arrow CSS rule). */}
        <button
          type="button"
          aria-label="Scroll left"
          aria-disabled={!canScrollLeft}
          disabled={!canScrollLeft}
          onClick={() => scrollByPage(-1)}
          className="lls-arrow absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#0c1e35]/95 border border-[#1e3a5f] text-white text-[18px] items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#f59e0b]/40 transition-colors"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          aria-disabled={!canScrollRight}
          disabled={!canScrollRight}
          onClick={() => scrollByPage(1)}
          className="lls-arrow absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#0c1e35]/95 border border-[#1e3a5f] text-white text-[18px] items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#f59e0b]/40 transition-colors"
        >
          ›
        </button>

        {/* Edge fades — overlay the viewport edges so the cards seem to
            dissolve into the navy band. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10"
          style={{ background: "linear-gradient(to right, #07111f, transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10"
          style={{ background: "linear-gradient(to left, #07111f, transparent)" }}
        />

        <div
          ref={scrollRef}
          className="lls-scroll overflow-x-auto scroll-smooth flex gap-3 px-4 sm:px-6"
          role="region"
          aria-label="Milton listings carousel"
          onScroll={handleScroll}
          onPointerDown={pauseAutoScroll}
          onWheel={pauseAutoScroll}
          onMouseEnter={pauseAutoScroll}
        >
          {filtered.map((listing) => {
            const days = daysAgo(new Date(listing.listedAt));
            const tag = days <= 7 ? `NEW · ${days}d` : `${days}d ago`;
            const streetAddr = listing.address.split(",")[0];
            const photoUrl = listing.photos?.[0];
            return (
              <div
                key={listing.mlsNumber}
                role="link"
                tabIndex={0}
                aria-label={`View ${listing.address}`}
                onClick={() => navigate(listing.mlsNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(listing.mlsNumber);
                  }
                }}
                className="shrink-0 w-[240px] bg-[#0c1e35] border border-[#1e3a5f] hover:border-[#f59e0b]/50 focus:border-[#f59e0b] focus:outline-none rounded-[10px] overflow-hidden cursor-pointer transition-colors"
              >
                {/* Photo — portrait aspect ratio (unchanged from prior commit). */}
                <div
                  className="aspect-[4/5] bg-[#1e3a5f] bg-center bg-cover relative"
                  style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : {}}
                >
                  {!photoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center text-[28px] opacity-30">🏠</div>
                  )}
                  <span className="absolute top-2 left-2 bg-[#07111f]/85 backdrop-blur-sm text-[#fbbf24] text-[9px] font-medium uppercase tracking-[0.5px] px-[6px] py-[3px] rounded-[3px]">
                    {tag}
                  </span>
                </div>
                <div className="px-[12px] py-[10px]">
                  <div className="text-[15px] font-medium tracking-tight text-[#f8f9fb] leading-none mb-1">
                    {formatPriceFull(listing.price)}
                  </div>
                  <div className="text-[11px] text-[#cbd5e1] whitespace-nowrap overflow-hidden text-ellipsis mb-1">
                    {streetAddr}
                  </div>
                  <div className="flex gap-2 text-[10px] text-[#94a3b8]">
                    <span>{listing.bedrooms} bed</span>
                    <span>·</span>
                    <span>{listing.bathrooms} bath</span>
                    {listing.sqft !== null && (
                      <>
                        <span>·</span>
                        <span>{listing.sqft.toLocaleString()} sf</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Trailing Text-Aamir CTA card — visible at end of every filter
              view. Amber background, contextual SMS prefill body.  */}
          <a
            href={smsHref}
            onClick={handleCtaClick}
            aria-label={`Text ${REALTOR_FIRST_NAME} about more ${activeFilter === "similar" ? "similar homes" : "Milton listings"}`}
            className="shrink-0 w-[240px] bg-[#f59e0b] hover:bg-[#fbbf24] rounded-[10px] overflow-hidden cursor-pointer flex flex-col items-center justify-center text-center px-5 py-7 transition-colors"
            style={{ minHeight: "100%" }}
          >
            <span className="text-[36px] mb-3" aria-hidden>💬</span>
            <div className="text-[14px] font-semibold text-[#07111f] leading-snug mb-2">
              Looking for something specific?
            </div>
            <div className="text-[11px] text-[#07111f]/80 mb-4 leading-snug">
              {REALTOR_FIRST_NAME} has more Milton listings.
            </div>
            <div className="text-[14px] font-bold text-[#07111f]">
              Text {REALTOR_FIRST_NAME} →
            </div>
          </a>
        </div>
      </div>

      <p className="text-[10px] text-[#64748b] text-center pt-3 pb-5 tracking-[0.2px]">
        Scroll to explore · Tap any listing to view it
      </p>
    </section>
  );
}
