// src/components/home/types.ts
// THE SEAM. The data window implements getHomepageData(): Promise<HomepageData>.
// The layout window consumes it. Every field is serializable (server -> client boundary).
// k-anonymity contract: NeighbourhoodCard.typicalPriceRounded === null => silent card state.

export type MlsTabKey = 'wealth' | 'buy' | 'sell' | 'rent';

export interface MiltonStats {
  /** raw dollars, e.g. 1_090_000 — component formats to $1.09M */
  typicalPrice: number;
  sold12mo: number;
  onMarket: number;
  /** days on market */
  dom: number;
}

export interface TrustInfo {
  rating: number; // 4.9
  reviewCount: number; // 235
  credentials: string[]; // ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"]
  idx: string; // "1809031"
  vow: string; // "1848370"
}

export interface HeroIntentPill {
  key: MlsTabKey; // routes to the matching MLS tab + scrolls
  label: string;
  mostAsked?: boolean; // true => "Most asked" badge
}

export interface HeroContent {
  headline: string; // "Milton" — h1 line 1, Kaushan Script, warm gradient (the site's only one)
  headlineAccent: string; // "Real Estate Encyclopedia" — h1 line 2, Playfair Display 500 white
  lede: string;
  askPlaceholder: string;
  /** rotating examples typed out in the ask bar */
  askExamples: string[];
  pills: HeroIntentPill[];
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
  topNeighbourhoods: { name: string; slug: string }[];
  topStreets: { name: string; slug: string }[];
  neighbourhoodCount: number;
  streetCount: number;
}

export interface HomepageData {
  stats: MiltonStats;
  hero: HeroContent;
  trust: TrustInfo;
  commentary: MarketCommentary;
  neighbourhoods: NeighbourhoodCard[];
  neighbourhoodCount: number;
  vipStreets: VipStreet[];
  streetCount: number;
  mls?: MlsExploreConfig; // homepage no longer renders the MLS-explore section; kept optional for reuse

  footer: FooterData;
}
