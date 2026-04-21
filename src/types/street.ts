// Street-page prop types.
//
// These are the SHAPES components consume. They deliberately do not match the
// data-fetch shape exactly — each component accepts a narrow slice. The master
// `StreetPageData` type at the bottom composes the whole-page payload for
// Phase 3's route-level fetch.
//
// Spec: docs/street-template-data-spec.md (sections 2, 3, 6).

import type { ReactNode } from "react";

// ───── Primitive building blocks ──────────────────────────────────────────

export type ProductTypeKey =
  | "detached"
  | "semi"
  | "townhouse"
  | "condo"
  | "link"
  | "freehold-townhouse";

export type TransactionType = "sold" | "leased";

export interface PriceRange {
  low: number;
  high: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/** A single key/value cell in a stat grid (sidebar facts, type summary grid, glance tile). */
export interface StatCell {
  label: string;
  value: string;
  detail?: string;
}

/** Quarterly data point for sale/lease charts. `quarter` is a label like "Q1 '25". */
export interface QuarterlyDataPoint {
  quarter: string;
  value: number;
  count: number;
}

// ───── Street identity ────────────────────────────────────────────────────

export interface StreetIdentity {
  id: string;
  name: string;            // "Whitlock Avenue"
  slug: string;            // "whitlock-avenue"
  shortName: string;       // "Whitlock" — used in widget / injected copy
  neighbourhoods: string[];
  primaryBuilder?: string;
  characterSummary: string; // 1-sentence hero subtitle
  coordinates: Coordinates;
}

// ───── Hero ────────────────────────────────────────────────────────────────

export interface HeroStat {
  /** Mono-caps label above the stat ("Typical price", "Transactions tracked"). */
  label: string;
  /** Primary value — pass as ReactNode so callers can embed italic `<em>` on units. */
  value: ReactNode;
  /** Optional sub-text row below the value. */
  sub?: string;
}

export interface ProductPillData {
  type: ProductTypeKey;
  /** "Detached" / "Town" / "Condo" — short display name on the pill. */
  displayName: string;
  /** Transaction count on this pill. */
  count: number;
  /** Typical price (sale) or typical rent (lease). `null` when suppressed by k-anonymity. */
  typicalPrice: number | null;
  /** "typical" | "typical rent" | "sample too small" etc. */
  priceLabel: string;
  /** Deep-link anchor on the page ("#type-detached"). */
  anchor: string;
}

export interface ProductPillRow {
  /** "Recent sales" / "Recent leases". */
  label: string;
  /** Dot colour next to the label (maps to accent token). */
  dotColor: "navy" | "blue" | "blue-muted" | "gold";
  pills: ProductPillData[];
}

export interface StreetHeroProps {
  eyebrow: string;         // "Street Profile · Cobban · Ford · Milton, ON"
  streetName: string;      // "Whitlock Avenue" — last word rendered italic
  subtitle: string;        // characterSummary
  heroStats: HeroStat[];   // up to 4 tiles
  productTypePills: ProductPillRow[]; // 0-2 rows (sold + leased)
  /** Raw numeric typical price, pre-formatting. Used by generateMetadata so the
   *  title/meta description can apply prose-level rounding without re-parsing
   *  the formatted string. Null when k-anonymity suppresses the figure. */
  rawTypicalPrice?: number | null;
  /** Raw numeric transaction count for metadata interpolation. */
  rawTotalTransactions?: number;
}

// ───── Description sidebar + body ─────────────────────────────────────────

export interface NearbyPlace {
  category: string;    // "Park" / "School" / "Mosque" / "Grocery"
  name: string;
  distance: string;    // "5 min walk" / "2 km"
  icon?: string;       // Unicode or short string
  href?: string;
}

export interface SidebarCTAData {
  eyebrow: string;
  headline: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  trustLine?: string;
}

export interface DescriptionSidebarProps {
  streetFacts: Record<string, string>;
  nearbyPlaces: NearbyPlace[];
  sidebarCTA: SidebarCTAData;
}

export interface BestFitItem {
  strong: string;
  body: string;
}
export type DifferentPriorityItem = BestFitItem;

export interface DescriptionSection {
  id?: string;     // optional anchor id
  heading: string;
  paragraphs: string[];
}

export interface DescriptionBodyProps {
  sections: DescriptionSection[];
  bestFitFor: BestFitItem[];
  differentPriorities: DifferentPriorityItem[];
  /** Slot children rendered inline between sections (e.g. an InlineCTA). */
  inlineSlot?: ReactNode;
  /** Index (0-based) of `sections` to render the inlineSlot after. Default: 1. */
  inlineSlotAfter?: number;
}

// ───── InlineCTASection variants ──────────────────────────────────────────

export type InlineCTAVariant = "owner" | "detached" | "semi" | "townhouse" | "condo";

export interface InlineCTASectionProps {
  variant: InlineCTAVariant;
  streetShort: string;     // "Whitlock"
  typicalPrice: number;    // drives the italic stat figure
  actionHref?: string;     // defaults per variant
}

// ───── TypeSection ────────────────────────────────────────────────────────

export interface MiniChartConfig {
  headline: string;
  note: string;
  trendLabel: string;
  data: QuarterlyDataPoint[];
}

export interface TypeSectionProps {
  type: ProductTypeKey;
  displayName: string;     // "Detached" / "Townhouse" / "Condo"
  hasData: boolean;
  intro: string;
  streetName: string;
  streetShort: string;
  typicalPrice: number;    // drives the InlineCTASection's italic stat
  statsSold: StatCell[];
  statsLeased?: StatCell[];
  chartSold?: MiniChartConfig;
  chartLeased?: MiniChartConfig;
  noDataMessage?: string;
  /** True when sample size is < 5 (k-anonymity). Surfaces a contact-team note and hides the chart. */
  showContactTeamPrompt?: boolean;
}

// ───── AtAGlanceGrid ──────────────────────────────────────────────────────

export type GlanceTile = StatCell;
export interface AtAGlanceGridProps {
  tiles: GlanceTile[];     // exactly 12 expected
}

// ───── PatternBlock ───────────────────────────────────────────────────────

export interface PatternCTA {
  label: string;   // small mono label
  title: string;   // bigger Fraunces title
  href: string;
}

export interface PatternBlockProps {
  eyebrow: string;
  headline: string;
  body: string;
  ctas: PatternCTA[];      // exactly 3 expected
}

// ───── MarketActivity ─────────────────────────────────────────────────────

export interface MarketSummary {
  title: string;
  body: string;
  stats: StatCell[];       // 3 cells per card
}

export interface RentByBedsTile {
  label: string;   // "1 bed" / "2 bed" / etc.
  value: string;   // "$2,400"
  detail?: string; // "typical"
}

/** Matches the SoldListItem shape from src/lib/sold-data.ts. */
export interface SoldTableRow {
  mls_number: string;
  address: string;
  sold_price: number;
  list_price: number;
  sold_to_ask_ratio: number;
  sold_date: string;
  days_on_market: number;
  beds: number | null;
  baths: number | null;
  property_type: string;
  transaction_type: "For Sale" | "For Lease";
  list_office_name: string | null;
}

export interface MarketActivityProps {
  salesSummary: MarketSummary;
  leasesSummary?: MarketSummary;
  priceChart: { data: QuarterlyDataPoint[]; caption: string } | null;
  rentByBeds?: RentByBedsTile[];
  soldTable: SoldTableRow[];
  /** If false, the table is blurred behind a VowGate prompt. */
  canSeeRecords: boolean;
  currentPath: string;
  streetName: string;
  streetSlug: string;
}

// ───── CommuteGrid ────────────────────────────────────────────────────────

export interface CommuteDestination {
  name: string;
  primaryTime: string;     // "7 min drive"
  secondaryTime?: string;  // "25 min transit"
  /** schema.org @type for this destination. */
  schemaType?:
    | "CollegeOrUniversity"
    | "School"
    | "Hospital"
    | "Park"
    | "TrainStation"
    | "SubwayStation"
    | "BusStation"
    | "GroceryStore"
    | "ShoppingCenter"
    | "PlaceOfWorship"
    | "Place";
  href?: string;
}

export interface CommuteCategory {
  id: string;              // used as React key
  title: string;
  subtitle: string;
  /** Inline SVG string or emoji/symbol. */
  icon: ReactNode;
  destinations: CommuteDestination[];
}

export interface CommuteGridProps {
  categories: CommuteCategory[];
}

// ───── ActiveInventory ────────────────────────────────────────────────────

export interface ActiveListingCard {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  daysOnMarket: number | null;
  photo?: string;
  href: string;
}

export interface ActiveInventoryProps {
  listings: ActiveListingCard[];
  streetName: string;
  streetShort: string;
}

// ───── ContextCards ───────────────────────────────────────────────────────

export interface ContextStreetCard {
  slug: string;
  name: string;
  avgPrice: number;
  count: number;
}
export interface ContextNeighbourhoodCard {
  slug: string;
  name: string;
  summary: string;
}
export interface ContextSchoolCard {
  slug: string;
  name: string;
  board: string;
  level: string;
}

export interface ContextCardsProps {
  similarStreets: ContextStreetCard[];
  neighbourhoods: ContextNeighbourhoodCard[];
  schools: ContextSchoolCard[];
}

// ───── FAQ ────────────────────────────────────────────────────────────────

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQProps {
  faqs: FAQItem[];
}

// ───── FinalCTAs ──────────────────────────────────────────────────────────

export interface FinalCTAData {
  eyebrow: string;
  headline: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  /** Secondary variant uses outline style on navy. */
  secondary?: boolean;
}

export interface FinalCTAsProps {
  sellerCTA: FinalCTAData;
  buyerCTA: FinalCTAData;
}

// ───── CornerWidget ───────────────────────────────────────────────────────

export interface SectionInsight {
  /** Section id (e.g. "s1", "type-detached") — matched against `document.getElementById`. */
  id: string;
  text: string;
}

export interface CornerWidgetProps {
  streetName: string;
  streetShort: string;
  heroHeadline: string;            // "986K typical · 244 transactions"
  sectionInsights: SectionInsight[];
  /** Optional: dismiss state is persisted in localStorage under this key. */
  storageKey?: string;
}

// ───── ExitIntent ─────────────────────────────────────────────────────────

export interface ExitIntentProps {
  streetName: string;
  streetShort: string;
  /** Storage key for the 7-day cooldown. Defaults to `miltonly:exit:<slug>`. */
  storageKey?: string;
  /** Optional custom headline/body — defaults per street. */
  headline?: string;
  body?: string;
}

// ───── Master page shape (for Phase 3 reference) ──────────────────────────

export interface StreetPageData {
  street: StreetIdentity;
  heroProps: StreetHeroProps;
  descriptionSidebar: DescriptionSidebarProps;
  descriptionBody: DescriptionBodyProps;
  detectedPattern?: PatternBlockProps;
  productTypes: TypeSectionProps[];
  glanceTiles: GlanceTile[];
  marketActivity: MarketActivityProps;
  commuteGrid: CommuteGridProps;
  activeInventory: ActiveInventoryProps;
  contextCards: ContextCardsProps;
  faqs: FAQItem[];
  finalCTAs: FinalCTAsProps;
  cornerWidget: CornerWidgetProps;
  lastUpdated: string;
}
