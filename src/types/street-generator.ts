// src/types/street-generator.ts
// Schema contract between generateStreet.ts and DescriptionBody component.

export type StreetSectionId =
  | "about"
  | "homes"
  | "amenities"
  | "market"
  | "gettingAround"
  | "schools"
  | "bestFitFor"
  | "differentPriorities";

export interface StreetSection {
  id: StreetSectionId;
  heading: string;
  paragraphs: string[];
}

export interface StreetFAQItem {
  question: string;
  answer: string;
}

export interface StreetGeneratorOutput {
  sections: StreetSection[];    // length = 8, ordered per canonical sequence
  faq: StreetFAQItem[];         // length 6-8
}

// --- Validation-facing augment (persisted alongside output, not returned by model) ---

export interface StreetGenerationMeta {
  model: "claude-opus-4-7" | "deepseek-chat";
  generatedAt: string;          // ISO
  inputHash: string;            // sha256 of StreetGeneratorInput for drift detection
  attemptCount: 1 | 2 | 3 | 4 | 5;
  validatorPassed: boolean;
  validatorViolations: ValidatorViolation[];  // empty if passed
  wordCounts: Record<StreetSectionId, number>;
  totalWords: number;
}

export interface ValidatorViolation {
  rule: ValidatorRule;
  sectionId?: StreetSectionId;
  excerpt: string;              // the offending substring, ~80 chars window
  severity: "hard" | "soft";    // hard = always retry; soft = retry only if other hard fails
}

export type ValidatorRule =
  | "em_dash"
  | "superlative"
  | "cliche_opener"
  | "methodology_leak"
  | "hedging_builder"
  | "precise_price"
  | "invented_cross_street"
  | "builder_without_high_confidence"
  | "section_word_floor"
  | "section_word_ceiling"
  | "total_word_floor"
  | "total_word_ceiling"
  | "missing_section_id"
  | "heading_out_of_bank"
  | "faq_count_out_of_range"
  | "faq_answer_length"
  | "faq_question_out_of_bank"
  | "sales_register_leak"
  | "market_template_parrot"
  | "numeric_ungrounded"
  | "invalid_json_shape";

// --- Frontend contract (what DescriptionBody consumes) ---

export interface DescriptionBodyProps {
  sections: StreetSection[];                    // all 8, frontend filters as needed
  faq: StreetFAQItem[];
}

// -----------------------------------------------------------------
// StreetGeneratorInput
// -----------------------------------------------------------------
// The full input payload consumed by the generator. Reverse-engineered
// from the system prompt's field references and validated against
// all three regression examples in docs/phase-4.1/03-examples.ts.
// Shape is authoritative; do not modify without a corresponding
// update to the system prompt and example fixtures.

// Step 13m — identity-keyed metadata. Generator receives the list of
// sibling slugs + the street's direction (when multi-direction identity)
// so it can frame dual-column pages correctly.
export type Direction = "" | "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

// Per-direction stats populated only when an identity has multiple directions
// with independent data. Model uses this to anchor "east vs west" framing on
// dual-column pages. Absent / undefined on single-direction identities.
export interface DirectionalStats {
  direction: Direction;
  salesCount: number;
  typicalPrice: number | null;
  priceRange: { low: number; high: number } | null;
  dominantType?: string;
}

export interface StreetGeneratorInput {
  street: {
    name: string;
    slug: string;
    shortName: string;
    type: string;
    identityKey: string;
    siblingSlugs: string[];
    direction: Direction;
  };
  directionalStats?: DirectionalStats[];
  neighbourhoods: string[];
  primaryBuilder?: {
    name: string;
    confidence: "high" | "medium" | "low";
    evidence?: string;
  };
  aggregates: {
    txCount: number;
    salesCount: number;
    leasesCount: number;
    typicalPrice: number | null;
    priceRange: { low: number; high: number } | null;
    daysOnMarket: number | null;
    kAnonLevel: "full" | "thin" | "zero";
  };
  byType: Record<string, {
    count: number;
    typicalPrice: number | null;
    priceRange: { low: number; high: number } | null;
    kFlag: string;
  }>;
  dominantStyle?: string;
  lotSize?: { typical: string; range: string };
  leaseActivity?: {
    byBed: Record<string, { count: number; typicalRent: number }>;
  };
  quarterlyTrend?: Array<{
    quarter: string;
    typical: number;
    count: number;
  }>;
  nearby: {
    parks: Array<{ name: string; distanceMin: number; walkable: boolean }>;
    // School `distanceMin` is nullable: many Milton schools don't have
    // hardcoded coordinates yet. Null means "coord not on file; distance
    // unknown" — callers must surface as null rather than fabricate.
    schoolsPublic: Array<{ name: string; level: string; board: string; distanceMin: number | null }>;
    schoolsCatholic: Array<{ name: string; level: string; board: string; distanceMin: number | null }>;
    mosques: Array<{ name: string; distanceMin: number }>;
    grocery: Array<{ name: string; distanceMin: number }>;
    hospital?: { name: string; distanceMin: number };
    goStation?: { name: string; distanceMin: number };
    highway?: { name: string; onrampDistanceMin: number };
  };
  commute: {
    toTorontoDowntown: { method: string; minutes: number };
    toMississauga: { method: string; minutes: number };
    toOakville: { method: string; minutes: number };
    toBurlington: { method: string; minutes: number };
    toPearson: { method: string; minutes: number };
  };
  activeListingsCount: number;
  crossStreets: Array<{
    slug: string;
    shortName: string;
    distinctivePattern: string;
    typicalPrice: number;
  }>;
}
