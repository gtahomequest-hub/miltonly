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
  // 4l-fix: similar-listings matcher uses these two TRREB-native fields.
  // architecturalStyle is the storeys/archetype signal (2-Storey vs Bungalow
  // vs Backsplit 3 vs Stacked Townhouse). approximateAge is the TRREB age
  // enum ("New" / "0-5" / "6-10" / "6-15" / "11-15" / "16-30" / "31-50" /
  // "51-99" / "100+") consolidated into 4 buckets by ageBucket().
  architecturalStyle: string | null;
  approximateAge: string | null;
}

export interface LiveListingSliderProps {
  /** Broad pool of active listings — typically top 80 by listedAt. The
   *  component filters client-side per the active filter pill. */
  listings: LiveListingSliderListing[];
  /** MLS number of the listing the user is currently viewing. Excluded from
   *  every filter result + used in GA event params. */
  currentMlsNumber: string;
  /** Current listing's propertyType (e.g. "detached") — Tier 1/2/3 filter. */
  currentPropertyType: string;
  /** Current listing's architecturalStyle (e.g. "2-Storey", "Bungalow").
   *  TRREB-native storeys/archetype signal. Tier 1+2 filter. May be null on
   *  rare listings missing the field — in which case Tier 1+2 are skipped. */
  currentArchitecturalStyle: string | null;
  /** Current listing's TRREB approximateAge string (e.g. "0-5", "31-50").
   *  Consolidated into 4 buckets by ageBucket() for Tier 1 matching. May be
   *  null — in which case Tier 1 is skipped (Rule B). */
  currentApproximateAge: string | null;
  /** First-line street address of the current listing — used in the
   *  "Similar" header copy + SMS prefill body. */
  currentListingAddr: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

const MIN_VISIBLE = 3;
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

// Default filter pill is derived from the current listing's propertyType so
// the slider opens on the matching archetype bucket (detached listing →
// Detached pill, townhouse → Townhouse, etc.). Case-insensitive lookup
// table accepts both production-normalized lowercase tokens AND raw TRREB
// formats — belt-and-suspenders against ingest-normalization drift. Unknown
// or empty input falls back to "similar" so the slider never crashes on an
// unrecognized propertyType.
const FILTER_LOOKUP: Record<string, FilterKey> = {
  // Production-normalized (current ingest pipeline emits these directly).
  detached: "detached",
  semi: "semi",
  townhouse: "townhouse",
  condo: "condo",
  // TRREB raw formats — present if a future ingest change ever bypasses
  // normalization, or if a caller passes us pre-normalization data.
  "semi-detached": "semi",
  "att/row/townhouse": "townhouse",
  "condo apartment": "condo",
  "condo townhouse": "condo",
};

export function mapPropertyTypeToFilter(propertyType: string | null | undefined): FilterKey {
  if (!propertyType) return "similar";
  const lc = propertyType.trim().toLowerCase();
  if (!lc) return "similar";
  return FILTER_LOOKUP[lc] ?? "similar";
}

// 4l-fix: TRREB approximateAge string → consolidated buyer-profile bucket.
// Pure helper, no I/O. Returns null for null/empty/unrecognized inputs so the
// matcher can decide whether to apply Tier 1 (which requires a known bucket).
export type AgeBucket = "new" | "5-15" | "15-30" | "30+";
export function ageBucket(val: string | null | undefined): AgeBucket | null {
  if (!val) return null;
  const s = val.trim();
  if (!s) return null;
  switch (s) {
    case "New":
    case "0-5":
      return "new";
    case "6-10":
    case "6-15":
    case "11-15":
      return "5-15";
    case "16-30":
      return "15-30";
    case "31-50":
    case "51-99":
    case "100+":
      return "30+";
    default:
      return null;
  }
}

// Normalize architecturalStyle so a trailing-whitespace / case-only difference
// doesn't split otherwise-identical archetypes. TRREB normally emits clean
// strings ("2-Storey", "Bungalow", "Backsplit 3"); this is defensive.
function normalizeStyle(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return s.length ? s : null;
}

// Tier of the similar-listings match that produced a given result set.
// Exposed for the recon/smoke-test script; not used at render time.
export type SimilarTier = 1 | 2 | 3 | null;

// Apply the active filter against the broad pool. Returns the cards the
// slider should render (in display order), excluding the current listing.
function filterListings(
  pool: LiveListingSliderListing[],
  filter: FilterKey,
  ctx: {
    mlsNumber: string;
    propertyType: string;
    architecturalStyle: string | null;
    approximateAge: string | null;
  },
): LiveListingSliderListing[] {
  const eligible = pool.filter((l) => l.mlsNumber !== ctx.mlsNumber);

  if (filter === "all") {
    return [...eligible].sort(byNewest);
  }

  if (filter === "similar") {
    return computeSimilarTiered(eligible, ctx).listings;
  }

  // Property-type filter (detached / semi / townhouse / condo).
  return eligible
    .filter((l) => (l.propertyType ?? "").toLowerCase() === filter)
    .sort(byNewest);
}

// 4l-fix: "Similar to this listing" 3-tier matcher.
//   Tier 1: same propertyType + same architecturalStyle + same age bucket
//   Tier 2: same propertyType + same architecturalStyle (drops age)
//   Tier 3: same propertyType only
//
// Rules locked with Aamir (Gate A clearance):
//   A — Candidate listings with approximateAge that maps to null bucket are
//       EXCLUDED from Tier 1. They remain eligible for Tier 2 and Tier 3.
//   B — If the CURRENT listing has a null age bucket, Tier 1 is skipped
//       entirely; we start at Tier 2. Dev-mode console.warn for visibility.
//   Style — if the current listing has null architecturalStyle, Tiers 1+2
//       are both skipped (they require a style match). Dev-mode warn.
//
// Floor: stop at the first tier that yields >= MIN_VISIBLE (3) cards. If
// Tier 3 also yields <3, return whatever Tier 3 produced — better
// honest-thin than dishonest-wrong (we never widen past propertyType).
function computeSimilarTiered(
  pool: LiveListingSliderListing[],
  ctx: {
    propertyType: string;
    architecturalStyle: string | null;
    approximateAge: string | null;
  },
): { tier: SimilarTier; listings: LiveListingSliderListing[] } {
  const ptKey = ctx.propertyType.toLowerCase();
  const styleKey = normalizeStyle(ctx.architecturalStyle);
  const ageKey = ageBucket(ctx.approximateAge);
  const isDev = process.env.NODE_ENV !== "production";

  // Tier 1 — strictest: propertyType + style + age bucket
  if (styleKey && ageKey) {
    const tier1 = pool.filter(
      (l) =>
        (l.propertyType ?? "").toLowerCase() === ptKey &&
        normalizeStyle(l.architecturalStyle) === styleKey &&
        ageBucket(l.approximateAge) === ageKey, // Rule A: null bucket excluded
    );
    if (tier1.length >= MIN_VISIBLE) return { tier: 1, listings: tier1.sort(byNewest) };
  } else if (!ageKey && isDev) {
    // Rule B
    console.warn("[LiveListingSlider] Tier 1 skipped: current listing has null age bucket");
  }

  // Tier 2 — same propertyType + same architecturalStyle (drops age)
  if (styleKey) {
    const tier2 = pool.filter(
      (l) =>
        (l.propertyType ?? "").toLowerCase() === ptKey &&
        normalizeStyle(l.architecturalStyle) === styleKey,
    );
    if (tier2.length >= MIN_VISIBLE) return { tier: 2, listings: tier2.sort(byNewest) };
  } else if (isDev) {
    console.warn("[LiveListingSlider] Tiers 1+2 skipped: current listing has null architecturalStyle");
  }

  // Tier 3 — same propertyType only. Last resort. We do NOT widen further;
  // a bungalow detached should not surface bungalow semis (different buyer
  // profile — freehold vs shared wall). If this returns <3 we accept that.
  const tier3 = pool.filter(
    (l) => (l.propertyType ?? "").toLowerCase() === ptKey,
  );
  return { tier: tier3.length > 0 ? 3 : null, listings: tier3.sort(byNewest) };
}

// Exposed for the recon/smoke-test script (scripts/smoke-similar-W13120162.ts).
// Re-exports the internal matcher so test code can prove tier-of-match for
// each card. Not used at render time — the React component goes through
// filterListings() which discards the tier tag.
export function computeSimilarMatch(
  pool: LiveListingSliderListing[],
  ctx: {
    propertyType: string;
    architecturalStyle: string | null;
    approximateAge: string | null;
  },
): { tier: SimilarTier; listings: LiveListingSliderListing[] } {
  return computeSimilarTiered(pool, ctx);
}

export default function LiveListingSlider({
  listings,
  currentMlsNumber,
  currentPropertyType,
  currentArchitecturalStyle,
  currentApproximateAge,
  currentListingAddr,
  className = "",
}: LiveListingSliderProps) {
  // Initial pill = propertyType-derived default (detached → Detached, etc.).
  // Memoized so the auto-fallback effect below can compare reliably without
  // re-deriving on every render. Memo dependency is the propertyType prop
  // which is stable per page (one listing per route), so this evaluates once
  // in practice — useMemo guards the edge case of a future re-render with a
  // different prop value.
  const initialFilter = useMemo(
    () => mapPropertyTypeToFilter(currentPropertyType),
    [currentPropertyType],
  );
  const [activeFilter, setActiveFilter] = useState<FilterKey>(initialFilter);
  const [paused, setPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctx = useMemo(
    () => ({
      mlsNumber: currentMlsNumber,
      propertyType: currentPropertyType,
      architecturalStyle: currentArchitecturalStyle,
      approximateAge: currentApproximateAge,
    }),
    [currentMlsNumber, currentPropertyType, currentArchitecturalStyle, currentApproximateAge],
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

  // Auto-fallback safety net: if the propertyType-derived initial default
  // pill (e.g. "Detached" for a detached listing) yields zero on first
  // paint — extremely rare given Milton inventory but possible on a
  // listing whose archetype bucket is briefly empty — flip to "All Milton"
  // so the slider doesn't vanish on cold-traffic landings. Triggers only
  // while activeFilter equals the initial derived default; once the
  // visitor manually selects a different pill, an empty result respects
  // their choice (slider hides via early return below).
  useEffect(() => {
    if (
      activeFilter === initialFilter &&
      filtered.length === 0 &&
      listings.length >= MIN_VISIBLE
    ) {
      setActiveFilter("all");
    }
  }, [activeFilter, filtered.length, listings.length, initialFilter]);

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
