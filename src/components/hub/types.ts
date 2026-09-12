// src/components/hub/types.ts
// THE SEAM. Data window implements getHubData(slug): Promise<HubData | null>.
// Layout window consumes it. All fields serializable (server -> client boundary).
// k-anon contract: any *PriceRounded field === null => suppress/silent state.
// profile === 'rural' => VIP strip + heavy stats hidden, character-led instead.

import type { StreetVideoCard } from '@/lib/homeSignals';
import type { HubSchool } from '@/lib/hubSchools';

export type { StreetVideoCard, HubSchool };

export type HubProfile = 'urban' | 'rural';

export interface HubStats {
  typicalPrice: number | null; // null => k-anon silent (thin activity)
  sold12mo: number | null;
  onMarket: number | null;
  dom: number | null; // days on market
}

/** the fast "is this neighbourhood right for me?" answer */
/** ONE DERIVED FACT. Every entry in the glance panel is now one of these: a figure, a
 *  label, and the basis the figure was computed over. `basis` is not optional — a number
 *  without its sample is the defect this codebase spends most of its guards on. */
export interface HubFact {
  key: string;
  value: string;
  label: string;
  basis: string;
  /** where the reader goes to check it, when there is such a page */
  href?: string;
}

export interface HubAtAGlance {
  /** NOTHING STATIC SURVIVES HERE (ruling, 2026-09-10). `suits`, `commute` and `schools`
   *  were per-profile constants presented beside live figures: every urban hub claimed the
   *  same three buyer types, the same commute sentence and the same schools sentence, none
   *  of which distinguished one neighbourhood from another. Each is replaced by a fact
   *  derived from data, or dropped. An empty array renders no panel. */
  facts: HubFact[];
}

export interface HubMarketCommentary {
  paragraphs: string[]; // first gets the drop-cap
  source: string;
}

/** compact comparison: this neighbourhood vs Milton overall */
export interface HubMarketCompare {
  metricLabel: string; // "Typical price"
  neighbourhoodValue: string; // "$1.15M"
  miltonValue: string; // "$1.09M"
  delta?: string; // "+5% vs Milton"
}

export interface HubStreetCard {
  name: string;
  slug: string;
  soldCount: number | null;
  /** THE STREET PAGE'S OWN TYPICAL. null => below the k floor, and the row says so. */
  typicalPriceRounded: number | null;
  /** the mandatory window+sample disclosure that travels with the price */
  basis: string | null;
  /** the street carries a filmed clip — the ladder marks it, the strip above shows it */
  hasVideo: boolean;
  signal?: string; // optional badge: "Most active", "Top sold"
}

export interface HubVipStreet {
  name: string;
  slug: string;
  soldCount: number;
}

export interface HubCondoBuilding {
  name: string;
  slug: string;
  meta?: string; // "24 units · est. ~$650K"
}

export interface HubFaq {
  question: string; // "How much are homes in Dempsey?"
  answer: string;
}

/** A nearby hub's card. Every line on it is derived; the hand-written character line is gone. */
export interface HubSibling {
  name: string;
  slug: string;
  typicalPriceRounded: number | null; // null => k-anon silent, and the card says so
  salesCount: number; // 12-month sales, the sample behind the typical
  streetPages: number; // published street guides in that hub
  distanceKm: number | null; // boundary centre to boundary centre; null when either has no polygon
}

export interface HubCta {
  heading: string;
  body: string;
  buttonLabel: string;
  href: string;
}

export interface HubIntentSquare {
  key: 'buy' | 'sell' | 'rent' | 'invest';
  label: string; // "I'm buying"
  sub: string; // "See streets & listings here"
  href: string;
}

export interface HubData {
  slug: string;
  name: string;
  profile: HubProfile;
  character: string; // one-line read shown in hero
  intents: HubIntentSquare[]; // hero 2x2 intent grid
  stats: HubStats;
  atAGlance: HubAtAGlance;
  overview: string[]; // editorial read paragraphs (the depth)
  marketCompare: HubMarketCompare[]; // small visual comparison rows
  commentary: HubMarketCommentary;
  streets: HubStreetCard[];
  streetCount: number;
  // NEIGHBOURHOOD HUBS ONLY. The tenure hubs (/freehold, /condos-guide, /potl) reuse this
  // seam and have no streets of their own, so these are optional rather than empty-array
  // ceremony on a page where the concept does not apply.
  /** rung one: the hood's filmed streets, poster-gated. Empty on the 14 hubs with none. */
  videoStreets?: StreetVideoCard[];
  /** schools standing inside the Town's boundary for this hood. Empty renders nothing. */
  schools?: HubSchool[];
  /** the sample and window behind stats.typicalPrice, e.g. "across 159 sales in the last 12 months" */
  typicalBasis?: string | null;
  /** the same disclosure for the Milton-wide figure the market section compares against */
  miltonBasis?: string | null;
  /** true when `siblings` are the nearest by the Town's polygons; false when the hub has no
   *  polygon and the list is simply the other hubs of its tier. The heading depends on it. */
  nearbyByDistance?: boolean;
  // True only when this neighbourhood has MORE published streets than the ladder cap — gates the
  // "View all streets →" overflow link so it never points at a redundant/thin page. Optional so
  // tenure hubs (condo/POTL) that never have a street-overflow page can leave it unset (= no link).
  hasStreetOverflow?: boolean;
  vipStreets: HubVipStreet[]; // urban only; empty for rural
  condos: HubCondoBuilding[]; // empty when none
  faqs: HubFaq[];
  siblings: HubSibling[];
  ctaBuyer: HubCta;
  ctaSeller: HubCta;
  // Optional tenure-hub glance label overrides (condo/POTL). Neighbourhood hubs
  // and the shared HubPage/HubGlance ignore this; only the tenure render reads it,
  // with defaults so unset = the freehold labels (freehold stays byte-identical).
  glanceLabels?: { fee?: string; vs?: string };
  // Optional tenure-hub section-title + breadcrumb overrides (per ownership type).
  // Only the tenure render (tenure-sections) reads these; defaults reproduce the
  // freehold strings so freehold stays byte-identical and POTL supplies its own.
  breadcrumbLabel?: string;
  sectionTitles?: { explained: string; market: string; faq: string };
  // NULL-STATS mode (POTL): sub-k activity -> no stats shown at all. When true,
  // the tenure render hides the hero stat tiles, the at-a-glance card, and the
  // market section entirely (editorial + FAQ + CTA only). Number-free by design.
  nullStats?: boolean;
  // COMPARE FACTS (optional, additive). Surfaces the SAME already-computed,
  // k-anon-gated numbers getTenureHubData bakes into prose, as a structured
  // object — so the /compare two-column composer can render a grounded
  // side-by-side table from the SAME seam (no new queries, no new data layer).
  // Only the ComparePage reads this; every existing consumer (neighbourhood
  // hubs, tenure hubs) ignores it -> zero regression. Every field null-degrades.
  compareFacts?: TenureCompareFacts;
}

/** Structured, k-safe facts for the /compare side-by-side table. Mirrors the
 *  numbers getTenureHubData already computes; nulls are silent (never $0/NaN). */
export interface TenureCompareFacts {
  activeCount: number | null; // onMarket inventory count (unfiltered)
  medianList: number | null; // active sale-only median LIST price
  listLo: number | null; // active sale-only min/max LIST (plausibility-floored)
  listHi: number | null;
  soldTypical: number | null; // avg sold 12mo, k-anon gated (K>=5)
  soldCount: number | null; // DISTINCT mls sold 12mo
  dom: number | null; // avg days on market (sold-derived)
  subtypeMedians: { label: string; value: number }[]; // k-gated active medians
  hasFee: boolean; // this tenure carries a monthly fee (condo) vs none (freehold)
  feeLo: number | null; // typical monthly-fee range, k-gated (condo only)
  feeHi: number | null;
}
