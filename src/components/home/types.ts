// src/components/home/types.ts
// THE SEAM. The data window implements getHomepageData(): Promise<HomepageData>.
// The layout window consumes it. Every field is serializable (server -> client boundary).
// k-anonymity contract: NeighbourhoodCard.typicalPriceRounded === null => silent card state.

import type { NeighbourhoodCard as HubCard } from '@/lib/neighbourhoodCards';
import type { StreetVideoCard } from '@/lib/homeSignals';
import type { ListingCardData } from '@/components/listings/v2/types';

export type { HubCard };

/** A newest-listing card plus the ONE thing the card needs and the grid's card lacks:
 *  the canonical published hub this listing belongs to, resolved server-side. null when
 *  the raw TREB string maps to no published hub, in which case the card shows no
 *  neighbourhood link rather than a slugified guess that would 404. */
export interface HomeListingCard extends ListingCardData {
  hubSlug: string | null;
  hubName: string | null;
}

export type MlsTabKey = 'wealth' | 'buy' | 'sell' | 'rent';

export interface MiltonStats {
  /** raw dollars, e.g. 1_090_000 — component formats to $1.09M */
  typicalPrice: number;
  sold12mo: number;
  onMarket: number;
  /** days on market */
  dom: number;
  /** active sale listings first advertised in the last 7 days */
  newThisWeek: number;
  /** calendar month TO DATE — the label must say "so far", because it is */
  soldMonthToDate: number;
  /** k-gated: null below K_ANON_PRICE, never 0 */
  soldMonthTypical: number | null;
  /** Milton rentals available today — the SAME figure /rentals publishes. Not sale-side. */
  rentalsAvailable: number;
}

export interface TrustInfo {
  rating: number; // 5.0
  reviewCount: number; // 235
  credentials: string[]; // ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"]
  idx: string; // "1809031"
  vow: string; // "1848370"
}

export interface HeroPill {
  label: string;
  href: string; // real destination the pill navigates to
  cta?: boolean; // true => "Talk to Aamir" conversion style (outlined accent, not signal green)
}

export interface HeroContent {
  headline: string; // "Milton" — h1 line 1, Kaushan Script, warm gradient (the site's only one)
  headlineAccent: string; // "Real Estate Encyclopedia" — h1 line 2, Playfair Display 500 white
  lede: string;
  askPlaceholder: string;
  /** rotating examples typed out in the ask bar */
  askExamples: string[];
  pills: HeroPill[];
}

/** MarketCommentary === the prose (spec: "string"); kept as paragraphs + source. */
export interface MarketCommentary {
  paragraphs: string[]; // first paragraph receives the drop-cap
  source: string;
}

export interface NeighbourhoodCard {
  name: string;
  character: string;
  /** null => k-anon SILENT card state (price suppressed) */
  typicalPriceRounded: number | null;
  /** shown only when typicalPriceRounded is null */
  silentNote?: string;
  slug: string;
  group: 'urban' | 'rural';
}

export interface VipStreet {
  name: string;
  soldCount: number;
  slug: string;
}

export interface MlsChip {
  label: string;
  compare?: boolean; // true => dashed Compare-as-mode chip
  href?: string; // live destination; absent => editorial chip, no click affordance
}

export interface MlsListingCard {
  title: string; // "Triplex · Clarke"
  meta: string; // "3 units · ~$1.2M"
  signal: string; // "▲ est. gross yield ~5.1%" — mono accent line
}

export interface MlsVowCapture {
  text: string;
  sub: string;
  buttonLabel: string; // the single neon control
}

export interface MlsLens {
  key: MlsTabKey;
  tabLabel: string;
  badgeLabel: string; // "Active lens"
  badgePill?: string; // wealth only: short badge pill (currently unset)
  headline: string;
  description: string;
  chips: MlsChip[];
  listings?: MlsListingCard[]; // wealth + buy only
  vow: MlsVowCapture;
  compareRow?: string; // wealth only
  vowNote?: string; // wealth only
}

export interface MlsExploreConfig {
  defaultTab: MlsTabKey; // 'wealth' leads
  lenses: MlsLens[]; // array order = display order
}

export interface FooterData {
  /** EVERY published hub. A truncated list cost 19 crawlable links and bought nothing. */
  neighbourhoods: { name: string; slug: string }[];
  topStreets: { name: string; slug: string }[];
  neighbourhoodCount: number;
  /** SURFACED ENTITIES — streets that may appear in search and hub ladders (738). */
  streetCount: number;
  /** PUBLISHED PAGES — the sitemap's set (444). Different number, different noun. */
  streetPageCount: number;
}

export interface HomepageData {
  stats: MiltonStats;
  hero: HeroContent;
  trust: TrustInfo;
  /** the 22 published hubs, priced by their own page's k-gated aggregate */
  neighbourhoods: HubCard[];
  /** PAGES, the set the sitemap emits. Not the surfaced-entity count. */
  streetPageCount: number;
  /** all-Milton 12-month sold-to-ask as a PERCENT (98.1), k-gated. null = suppressed */
  soldToAskPct: number | null;
  videoStreets: StreetVideoCard[];
  videoCount: number;
  newestListings: HomeListingCard[];
  inDemandStreets: { name: string; slug: string }[];
  // Optional: the Board is the homepage's market read now, so getHomepageData no
  // longer computes these (perf trim). mockData still provides them for reference.
  commentary?: MarketCommentary;
  neighbourhoodCount?: number;
  vipStreets?: VipStreet[];
  streetCount?: number;
  mls?: MlsExploreConfig; // homepage no longer renders the MLS-explore section; kept optional for reuse

  footer: FooterData;
}
