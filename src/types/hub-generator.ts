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
    // Dispatch key (DEC-WS4 scope correction) — never `kind`. WS4 patch 2
    // (DEC-WS4-7) widened this union: rural_hub reuses this SAME input shape,
    // built by buildRuralHubInput. A rural_hub input always has hasVipTier=false
    // semantics, so `vipStreetCount` is always 0 and `projectedStreets` carries
    // no VIP-first ordering requirement (the 9 rural pools have no VIP tier).
    profile: "urban_hub" | "rural_hub";
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

// ===========================================================================
// CONDO BUILDING tier (WS4 patch 2, DEC-WS4-5 / DEC-WS4-7).
// ===========================================================================
// A condo building is keyed by (street_number, street_slug) → slug
// "<num>-<street_slug>" (ADR 0001 DEC-4). The defining discipline of this tier
// is the transaction_type SPLIT (entity-taxonomy spec): sale-side and lease-side
// aggregates are computed by SEPARATE queries and NEVER merged. Mixing them is
// the `490 Gordon Krantz avg 2370` regression (sale prices averaged with monthly
// rents). `saleAggregates` feeds the market section + VIP; `lease` is purely
// informational and can never enter `recencyWeightedSold` or the market section.

export interface CondoBuildingAttributes {
  slug: string;                    // "<streetNumber>-<streetSlug>"
  displayName: string;             // = buildingAddress at backfill (no clean name source)
  buildingAddress: string | null;
  streetNumber: string | null;
  streetName: string | null;
  streetSlug: string | null;       // parent street for link-graph (/streets/[slug])
  neighbourhoodName: string | null;
  totalUnits: number | null;
  legalStories: number | null;
  managementCo: string | null;
  avgMaintenanceFee: number | null;
  yearBuilt: number | null;
  condoCorpNumbers: string[];      // dirty/multi — attribute, never a key
}

// LEASE side — informational only. NEVER feeds the sale market section or VIP.
// recentRecords is populated only when leaseCount12mo ≥ K_ANON_PRICE (5): the
// W2 lease-side coverage rule applied at building tier (DEC-WS4-5). Below k, the
// per-trade lease gate fires on any per-trade lease claim.
export interface CondoLeaseInfo {
  leaseCount12mo: number;
  kAnonLevel: KAnonLevel;
  recentRecords?: Array<{
    address: string;       // PII-redacted: street# + streetName only
    rent: number;          // monthly rent (For Lease sold_price)
    beds: number;
    daysOnMarket: number;
    soldMonth: string;     // "YYYY-MM"
  }>;
  rangeStats?: { min: number; max: number };  // k ≥ 10
}

export interface CondoBuildingGeneratorInput {
  building: CondoBuildingAttributes;
  // SALE side ONLY (transaction_type='For Sale'). assembleAggregates derives
  // typicalPrice/priceRange/DOM from the sale query alone — lease values cannot
  // reach it. Same k-anon thresholds as every other tier (K_ANON_PRICE=5,
  // K_ANON_RANGE=10); they bite far more often at building granularity.
  saleAggregates: HubAggregates;
  saleByType: Record<string, HubTypeBucket>;
  saleQuarterly: HubQuarter[];
  // LEASE side — separate query, informational only.
  lease: CondoLeaseInfo;
  // Fork (DEC-WS4-5).
  saleActive: boolean;        // saleCount12mo > 0 OR recencyWeightedSold > 0
  leaseOnly: boolean;         // saleCount12mo === 0 → standard-tier page, no sale market
  vipEligible: boolean;       // === saleActive (lease-only never VIP — ADR 0001 DEC-5)
  isVip: boolean;             // from CondoBuilding.isVip (sticky; lease-only stays false)
  currentRank: number | null;
  recencyWeightedSold: number;
}

// Condo page sections (DEC-WS4-5 B3). `condoMarket` is emitted only for
// sale-active buildings; on a lease-only building it must not appear.
export type CondoSectionId =
  | "buildingHistory"   // editorial — year/stories/units where present
  | "unitMix"           // editorial/aggregate — by-type from sale side
  | "amenities"         // editorial
  | "fees"              // editorial — maintenance fee framing
  | "condoMarket"       // aggregate (sale-active ONLY) — per-trade/numeric/temporal gate
  | "buySellCtas"       // editorial (sales register allowed here only)
  | "faq"               // mixed (per-question)
  | "schemaMarkup";     // projected

export interface CondoSection {
  id: CondoSectionId;
  heading: string;
  paragraphs: string[];
}

export interface CondoGenerationMeta {
  buildingSlug: string;
  generatedAt: string;
  inputHash: string;
  validatorPassed: boolean;
  validatorViolations: ValidatorViolation[];
}
