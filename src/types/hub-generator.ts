// src/types/hub-generator.ts
// WS4 (DEC-WS4, ADR 0002) — schema contract for urban_hub neighbourhood-tier
// generation. Parallel to src/types/street-generator.ts but at the NEIGHBOURHOOD
// granularity: aggregates roll up every sale-side trade in the neighbourhood's
// rawStrings[], and entity-backed sections project from a ResidentialStreet[]
// array rather than being free-generated (DEC-WS4-2).
//
// This file is consumed by:
//   - src/lib/ai/buildHubInput.ts          (the input builder)
//   - src/lib/ai/hub/projectHubEntities.ts (projected street list + schema)
//   - src/lib/ai/validateHubGeneration.ts  (comparison_mismatch + hub gate)
//
// WS4 authors prompts + input + validator only. Hub CONTENT generation is WS5.

import type { ValidatorViolation } from "@/types/street-generator";

// ---------------------------------------------------------------------------
// Section taxonomy (DEC-WS4-1)
// ---------------------------------------------------------------------------
// Bucket per section drives which validator rules apply + which claim-types the
// prompt bans. `editorial` = no numeric gate; `aggregate` = grounded on nbhd /
// milton-wide aggregates, per-trade banned; `grounded-external` = schools (data
// sourced separately, gates WS5); `projected` = entity-backed, LLM writes only
// connective prose around a server-rendered list.
export type HubSectionId =
  | "openingIdentity"          // editorial
  | "liveMarket"               // aggregate
  | "inventorySnapshot"        // aggregate
  | "schoolsCatchments"        // grounded-external (DEPENDS-ON, not generated in WS4/WS5-pre-data)
  | "amenities"                // editorial
  | "comparedToMilton"         // aggregate, 2-sided — comparison_mismatch gate
  | "bestFitFor"               // editorial
  | "streetsInNeighbourhood"   // projected (DEC-WS4-2)
  | "buySellCtas"              // editorial
  | "faq"                      // mixed (per-question)
  | "schemaMarkup";            // projected (DEC-WS4-2)

export type HubSectionBucket =
  | "editorial"
  | "aggregate"
  | "grounded-external"
  | "projected";

export interface HubSection {
  id: HubSectionId;
  heading: string;
  paragraphs: string[];
}

export interface HubFAQItem {
  question: string;
  answer: string;
  // Per-question bucket classification (DEC-WS4-1 FAQ row): the validator
  // applies that bucket's rules per-question, not a blanket gate.
  bucket?: HubSectionBucket;
}

export interface HubGeneratorOutput {
  sections: HubSection[];
  faq: HubFAQItem[];
}

// ---------------------------------------------------------------------------
// Aggregate shapes — sale-side, k-anon gated, identical discipline to W2.
// ---------------------------------------------------------------------------

export type KAnonLevel = "full" | "thin" | "zero";

export interface HubAggregates {
  txCount: number;        // sale + lease, trailing 12mo
  salesCount: number;     // For Sale, trailing 12mo (live)
  leasesCount: number;    // For Lease, trailing 12mo
  typicalPrice: number | null;   // null when salesCount < K_ANON_PRICE (5)
  priceRange: { low: number; high: number } | null;  // null when salesCount < K_ANON_RANGE (10)
  daysOnMarket: number | null;
  kAnonLevel: KAnonLevel;
}

export interface HubTypeBucket {
  count: number;
  typicalPrice: number | null;
  priceRange: { low: number; high: number } | null;
  kFlag: KAnonLevel;
}

// Chronological via sortKey = year*4 + quarter (same ordering key as W2 Step 5).
export interface HubQuarter {
  quarter: string;   // canonical "Q3 2025"
  typical: number | null;
  count: number;
  sortKey: number;   // year*4 + quarter
}

// A residential street projected into the streets-in-this-neighbourhood section.
// `displayName` is already expandStreetName-normalized (WS3 carry-forward) so the
// renderer never emits "Farmstead. Dr". currentRank order, VIP first.
export interface HubProjectedStreet {
  slug: string;
  displayName: string;
  shortName: string | null;
  isVip: boolean;
  currentRank: number | null;
  soldCount12mo: number;
}

// ---------------------------------------------------------------------------
// HubGeneratorInput — the per-neighbourhood payload (urban_hub only).
// ---------------------------------------------------------------------------

export interface HubGeneratorInput {
  neighbourhood: {
    slug: string;
    name: string;
    profile: "urban_hub";   // dispatch key (DEC-WS4 scope correction) — never `kind`
    kind: string;
    rawStrings: string[];
  };
  aggregates: HubAggregates;
  byType: Record<string, HubTypeBucket>;
  quarterlyTrend: HubQuarter[];   // chronological, count >= 2 filtered, sale-side
  activeListingsCount: number;
  activeByType: Record<string, number>;
  // ResidentialStreet[] ordered by currentRank (VIP first) — the projected
  // streets section (DEC-WS4-2). The LLM never authors these names.
  projectedStreets: HubProjectedStreet[];
  vipStreetCount: number;
  streetCount: number;
  // schoolsCatchments is DEPENDS-ON external Halton DSB + HCDSB boundary data
  // (gates WS5, not WS4). Absent here until that sourcing task lands; the
  // section is not generated while this is undefined.
  schools?: {
    sourced: false;   // WS4: never sourced yet. WS5 flips this when data lands.
  };
}

// ---------------------------------------------------------------------------
// MiltonWideContext (DEC-WS4-3) — computed ONCE per generation run, shared
// across all 14 hubs. Feeds the second side of the compared-to-milton section.
// ---------------------------------------------------------------------------

export interface MiltonWideContext {
  scope: "milton-wide";
  aggregates: HubAggregates;
  quarterlyTrend: HubQuarter[];
  activeListingsCount: number;
  neighbourhoodCount: number;   // number of hub neighbourhoods rolled up
}

// ---------------------------------------------------------------------------
// Projected schema markup (DEC-WS4-2) — projects from the same input as the
// gated body; never free-generated. No claim may contradict the gated prose.
// ---------------------------------------------------------------------------

export interface HubSchemaProjection {
  "@context": "https://schema.org";
  "@type": "Place";
  name: string;
  containedInPlace: { "@type": "City"; name: string };
  // ItemList of the projected residential streets (display names only).
  mainEntity: {
    "@type": "ItemList";
    numberOfItems: number;
    itemListElement: Array<{
      "@type": "ListItem";
      position: number;
      name: string;
      url: string;
    }>;
  };
  // Aggregate offer summary — only present when k-anon allows (typicalPrice).
  aggregatePrice?: {
    "@type": "PriceSpecification";
    priceCurrency: "CAD";
    price: number;
  };
}

// Validation-facing meta (parallel to StreetGenerationMeta).
export interface HubGenerationMeta {
  neighbourhoodSlug: string;
  generatedAt: string;
  inputHash: string;
  validatorPassed: boolean;
  validatorViolations: ValidatorViolation[];
}
