// src/components/condo/types.ts
// THE SEAM. Data window implements getCondoData(slug): Promise<CondoData | null>.
// Condos are the thinnest data tier — EVERY market/fee/rule field is nullable so the
// page degrades honestly (k-anon silent / "not stated") instead of faking numbers.

export interface CondoIntentSquare {
  key: 'buy' | 'sell' | 'rent' | 'invest';
  label: string;
  sub: string;
  href: string;
}

/** headline building facts (mostly static, building-level) */
export interface CondoFacts {
  units: number | null;
  storeys: number | null;
  yearBuilt: number | null;
  developer: string | null;
  propertyType: string | null; // "Condo apartment", "Stacked townhome"
}

/** the differentiator: true monthly cost of ownership */
export interface CondoOwnership {
  typicalPrice: number | null; // null => k-anon silent
  priceRange: string | null; // "$520K – $740K"
  maintenanceFee: string | null; // "~$0.62 / sq ft" or "~$640 / month"
  feeIncludes: string[]; // ["Heat", "Water", "1 parking"] — empty if unknown
  feeNote?: string; // shown when maintenanceFee is null
}

export interface CondoBedRow {
  label: string; // "1 bedroom"
  typicalPrice: number | null; // null => silent
  soldCount: number | null;
}

export interface CondoListing {
  title: string; // "Unit 1204 · 2 bed"
  meta: string; // "2 bed · 2 bath · 920 sqft"
  price: string; // "$685,000" or "$2,650/mo"
  tenure: 'sale' | 'lease';
  href: string;
}

export interface CondoRules {
  pets: string | null; // "Permitted with restrictions"
  rentals: string | null; // "Allowed" — investor-critical
  parking: string | null; // "1 owned + visitor"
  locker: string | null;
}

export interface CondoFaq {
  question: string;
  answer: string;
}

export interface CondoNearby {
  name: string;
  slug: string;
  meta?: string;
}

export interface CondoCta {
  heading: string;
  body: string;
  buttonLabel: string;
  href: string;
}

export interface CondoData {
  slug: string;
  name: string;
  address: string;
  character: string; // one-line read
  neighbourhood: { name: string; slug: string }; // links UP to parent hub
  intents: CondoIntentSquare[];
  facts: CondoFacts;
  ownership: CondoOwnership;
  bedrooms: CondoBedRow[]; // price-by-bedroom table; empty when unknown
  overview: string[];
  listings: CondoListing[]; // live units (sale + lease); data-window fed; empty ok
  amenities: string[]; // empty when unknown -> section hidden
  rules: CondoRules;
  faqs: CondoFaq[];
  nearbyCondos: CondoNearby[];
  ctaBuyer: CondoCta;
  ctaSeller: CondoCta;
}
