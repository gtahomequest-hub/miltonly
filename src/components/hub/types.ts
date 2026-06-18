// src/components/hub/types.ts
// THE SEAM. Data window implements getHubData(slug): Promise<HubData | null>.
// Layout window consumes it. All fields serializable (server -> client boundary).
// k-anon contract: any *PriceRounded field === null => suppress/silent state.
// profile === 'rural' => VIP strip + heavy stats hidden, character-led instead.

export type HubProfile = 'urban' | 'rural';

export interface HubStats {
  typicalPrice: number | null; // null => k-anon silent (thin activity)
  sold12mo: number | null;
  onMarket: number | null;
  dom: number | null; // days on market
}

/** the fast "is this neighbourhood right for me?" answer */
export interface HubAtAGlance {
  priceRange: string | null; // "$845K – $1.4M" — null when k-anon silent
  dominantType: string; // "Detached & townhomes"
  suits: string[]; // ["Families", "Move-up buyers"]
  commute: string; // "8 min to Milton GO · 45 min to Union"
  schools: string; // "Strong public + Catholic options"
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
  typicalPriceRounded: number | null; // null => price-silent
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

export interface HubSibling {
  name: string;
  slug: string;
  character: string;
  typicalPriceRounded: number | null;
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
}
