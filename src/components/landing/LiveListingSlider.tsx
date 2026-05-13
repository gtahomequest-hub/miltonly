"use client";

import { formatPriceFull, daysAgo } from "@/lib/format";

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
}

export interface LiveListingSliderProps {
  /** All listings to display in the slider, pre-sorted upstream (top 10 expected). */
  listings: LiveListingSliderListing[];
  /** Property-type label (plural) for the section kicker — e.g. "townhouses", "detached homes". */
  propertyTypeLabel: string;
  /** MLS number of the listing the user is currently viewing — used in the
   *  click_slider_listing GA4 event so traffic-flow between listings is analyzable. */
  currentMlsNumber: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

// Per-card horizontal cycle time. Multiplied by listings.length for the total
// animation duration. With 10 cards = 40s cycle; with 5 = 20s.
const SECONDS_PER_CARD = 4;

// Cards under this floor mean the loop visually breaks — render nothing.
const MIN_VISIBLE_LISTINGS = 3;

type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

export default function LiveListingSlider({
  listings,
  propertyTypeLabel,
  currentMlsNumber,
  className = "",
}: LiveListingSliderProps) {
  // Bail out cleanly when too few cards — animation looks broken otherwise.
  if (listings.length < MIN_VISIBLE_LISTINGS) return null;

  // Duplicate the array so the CSS keyframe (translateX(0) → translateX(-50%))
  // lands at the start of the second copy, visually identical to the first
  // copy. Seamless loop with zero JS frame timer.
  const doubled = [...listings, ...listings];
  const totalDurationSeconds = listings.length * SECONDS_PER_CARD;

  function navigate(mlsNumber: string) {
    const gtag = getGtag();
    if (gtag) {
      gtag('event', 'click_slider_listing', {
        slider_mls: mlsNumber,
        from_listing_mls: currentMlsNumber,
      });
    }
    if (typeof window !== "undefined") {
      // Hard reload (not Next router push) — fresh server data on each
      // listing view, simpler analytics attribution.
      window.location.href = `/sales/ads/${mlsNumber}`;
    }
  }

  return (
    // Full-bleed: breaks out of any parent's max-width container by
    // positioning at viewport center (left-1/2) then translating left by half
    // its own 100vw width. The parent must be mx-auto centered (which the
    // sales page already is) for the trick to land flush with the viewport
    // edges. No rounded corners or border on the outer band — full-bleed
    // visual reads cleaner without them.
    <section
      aria-label="Continuous scroll of similar listings"
      className={`relative left-1/2 -translate-x-1/2 w-screen bg-[#07111f] ${className}`}
    >
      {/* Component-scoped keyframes + reduced-motion override. Inlined to keep
          the animation self-contained without touching global CSS. */}
      <style>{`
        @keyframes lls-slide-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lls-track {
          display: flex;
          gap: 12px;
          width: max-content;
          animation: lls-slide-left var(--lls-duration, 40s) linear infinite;
        }
        .lls-wrap:hover .lls-track {
          animation-play-state: paused;
        }
        .lls-wrap:focus-within .lls-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .lls-track {
            animation: none;
            overflow-x: auto;
          }
          .lls-wrap {
            overflow-x: auto;
          }
        }
      `}</style>

      {/* Thin label strip — constrained to page max-width so the header
          aligns with the rest of the page chrome, while the track below
          bleeds full width. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b]">
            More Milton {propertyTypeLabel} for sale
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

      {/* Slider track — full-bleed inside the full-bleed section. Edge fades
          align with the viewport edges so the loop's seam blends into the
          navy band cleanly. */}
      <div
        className="lls-wrap relative overflow-hidden"
        style={{ ["--lls-duration" as string]: `${totalDurationSeconds}s` }}
      >
        {/* Left fade */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10"
          style={{ background: "linear-gradient(to right, #07111f, transparent)" }}
        />
        {/* Right fade */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10"
          style={{ background: "linear-gradient(to left, #07111f, transparent)" }}
        />

        <div className="lls-track px-4 sm:px-6">
          {doubled.map((listing, i) => {
            const days = daysAgo(new Date(listing.listedAt));
            const tag = days <= 7 ? `NEW · ${days}d` : `${days}d ago`;
            const streetAddr = listing.address.split(",")[0];
            const photoUrl = listing.photos?.[0];
            // First half = real listings, second half = the duplicated loop.
            // Keep a unique key per rendered slot so React reconciles correctly.
            const key = `${listing.mlsNumber}-${i < listings.length ? "a" : "b"}`;
            return (
              <div
                key={key}
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
                {/* Photo — portrait aspect ratio gives the image more
                    vertical weight in the card, which reads as a higher-
                    quality listing card on dense desktop layouts. */}
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

                {/* Info — unchanged layout, slightly more horizontal room
                    now that the card is 240px wide. */}
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
        </div>
      </div>

      <p className="text-[10px] text-[#64748b] text-center pt-3 pb-5 tracking-[0.2px]">
        Hover to pause · Tap any listing to view it
      </p>
    </section>
  );
}
