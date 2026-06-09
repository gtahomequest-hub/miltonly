// src/components/street/v2/types.ts
// THE SEAM. Data window implements getStreetV2Data(slug): Promise<StreetV2Data | null>
// (the loader the data window wires, mirroring getHubData / getCondoData). Layout
// window consumes it here. All fields serializable (server -> client boundary).
//
// K-ANON CONTRACT (the whole reason this contract is shaped the way it is):
//   - Any suppressible numeric field typed `number | null` === null  => render the
//     SILENT state (.s-silent: italic + muted), NEVER a fabricated number.
//   - Any pre-formatted suppressible value typed `string | null` === null => silent.
//   - The loader (data window) owns the k-anon math (price k>=5, range k>=10) and
//     passes null where getStreetPageData() currently suppresses. The design owns
//     ONLY how silence LOOKS. It must never invent a value where one is null.
//
//   PROSE (sections[]) is already privacy-vetted at generation time — rendered
//   verbatim, no per-paragraph logic. `placeholder: true` => no generated prose
//   exists (render the "profile in preparation" state instead of the body).

export type ProductTypeKey =
  | 'detached'
  | 'semi'
  | 'townhouse'
  | 'condo'
  | 'link'
  | 'freehold-townhouse';

// ───── Hero ─────────────────────────────────────────────────────────────────

export interface StreetStat {
  label: string;
  /** null => silent. `kind` controls formatting of a non-null value. */
  value: number | null;
  kind: 'price' | 'count' | 'text';
  /** when kind==='text', the string to show (value still drives silent gating via textValue===null) */
  textValue?: string | null;
  /** optional sub-line (e.g. price range). null => omitted (e.g. range below k>=10). */
  sub?: string | null;
  /** copy shown in the silent state. Defaults to "sample too small to publish". */
  silentNote?: string;
}

export interface ProductPill {
  type: ProductTypeKey;
  displayName: string;
  count: number;
  /** null => suppressed (k<5); the pill still shows its count and stays clickable. */
  typicalPrice: number | null;
  /** "typical" | "sample too small" | "typical / mo" */
  priceLabel: string;
  anchor: string;
}

export interface StreetHeroData {
  stats: StreetStat[]; // up to 4 tiles (housing mix, typical price, transactions, active)
  salePills: ProductPill[];
  leasePills: ProductPill[]; // empty when leased_count < k
}

// ───── Prose (the 8 + optional 9th generated sections) ───────────────────────

export interface StreetProseSection {
  id: string; // about | homes | amenities | market | gettingAround | schools | bestFitFor | differentPriorities | neighbourhoodComparable
  heading: string;
  paragraphs: string[];
}

// ───── Sidebar ───────────────────────────────────────────────────────────────

export interface StreetFact {
  label: string;
  value: string; // already suppressed upstream — a fact is simply absent when below k.
}

export interface NearbyPlace {
  category: string;
  name: string;
  distance: string;
  icon?: string;
  href?: string;
}

export interface StreetCta {
  eyebrow: string;
  headline: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  trustLine?: string;
  secondary?: boolean;
}

export interface StreetSidebar {
  facts: StreetFact[];
  nearby: NearbyPlace[];
  cta: StreetCta;
}

// ───── Per-housing-type sections ─────────────────────────────────────────────

export interface ChartPoint {
  quarter: string; // "Q1 '25"
  value: number;
  count: number;
}

export interface TypeBlock {
  type: ProductTypeKey;
  displayName: string;
  intro: string;
  salesCount: number;
  /** null => k<5 silent. */
  typicalPrice: number | null;
  priceBand: { low: number; high: number } | null; // null => not publishable
  dom: number | null;
  soldToAsk: number | null; // 0..1 ratio
  activeCount: number | null;
  activeAvgList: number | null;
  /** null when k<5 or fewer than 3 quarters. */
  chart: { headline: string; note: string; trendLabel: string; data: ChartPoint[] } | null;
  /** true at 0 < salesCount < 5 — surfaces the "contact the team" prompt, chart hidden. */
  contactTeamPrompt: boolean;
}

// ───── At-a-glance (12 tiles) ────────────────────────────────────────────────

export interface GlanceTile {
  label: string;
  /** null => silent ("under publish threshold"). Pre-formatted string when publishable. */
  value: string | null;
  detail?: string;
  silentNote?: string;
}

// ───── Market activity ───────────────────────────────────────────────────────

export interface MarketStat {
  label: string;
  value: string | null; // null => silent "—"
}

export interface MarketSummaryCard {
  title: string;
  body: string;
  stats: MarketStat[];
}

export interface RentByBedTile {
  label: string;
  value: string | null; // null => silent
  detail?: string;
}

export interface MarketBlock {
  sales: MarketSummaryCard;
  leases: MarketSummaryCard | null;
  /** null => suppressed (k<5): a quarterly line would expose individual prices. */
  priceChart: { data: ChartPoint[]; caption: string } | null;
  rentByBeds: RentByBedTile[] | null;
}

// ───── Sold records island (TREB-VOW sign-in gated) ──────────────────────────

export interface SoldRecord {
  mlsNumber: string;
  date: string;
  address: string;
  beds: number | null;
  soldPrice: number;
  soldToAsk: number; // 0..1
  dom: number;
  brokerage: string | null;
}

export interface SoldRecordsBlock {
  caption: string;
  /** Registered-access gate. When false: design shows the blurred/locked overlay. */
  canSee: boolean;
  /** Populated only when canSee (server). Below the gate the rows still render blurred behind the overlay. */
  records: SoldRecord[];
  /** sign-in deep link, preserving redirect + intent. */
  signinHref: string;
}

// ───── Commute ───────────────────────────────────────────────────────────────

export interface CommuteDestination {
  name: string;
  primaryTime: string;
  secondaryTime?: string;
  href?: string;
}

export interface CommuteCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: 'transit' | 'schools' | 'health' | 'parks' | 'shopping' | 'worship';
  destinations: CommuteDestination[];
}

// ───── Active inventory ──────────────────────────────────────────────────────

export interface ListingCard {
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

// ───── Context cards ─────────────────────────────────────────────────────────

export interface ContextStreet {
  slug: string;
  name: string;
  avgPrice: number;
  count: number;
}
export interface ContextNeighbourhood {
  slug: string;
  name: string;
  summary: string;
}
export interface ContextSchool {
  slug: string;
  name: string;
  board: string;
  level: string;
}
export interface ContextBlock {
  similarStreets: ContextStreet[];
  neighbourhoods: ContextNeighbourhood[];
  schools: ContextSchool[];
}

// ───── FAQ ───────────────────────────────────────────────────────────────────

export interface StreetFaq {
  question: string;
  answer: string;
}

// ───── Master page shape (the seam getStreetV2Data returns) ──────────────────

export interface StreetV2Data {
  slug: string;
  name: string; // display: "Main Street East"
  shortName: string; // prose: "Main St E"
  eyebrow: string; // "Street Profile · Old Milton · Milton, ON"
  subtitle: string; // characterSummary
  neighbourhoods: string[];

  hero: StreetHeroData;

  /** true => no generated prose; render the "profile in preparation" placeholder. */
  placeholder: boolean;
  sections: StreetProseSection[]; // empty when placeholder
  /** owner inline-CTA stat figure; null => no publishable typical, so the inline CTA is hidden. */
  ownerCtaPrice: number | null;

  sidebar: StreetSidebar;
  productTypes: TypeBlock[];
  glance: GlanceTile[]; // exactly 12
  market: MarketBlock;
  soldRecords: SoldRecordsBlock;
  commute: CommuteCategory[];
  activeListings: ListingCard[];
  context: ContextBlock;
  faqs: StreetFaq[];
  finalCtas: { seller: StreetCta; buyer: StreetCta };
  lastUpdated: string;
}
