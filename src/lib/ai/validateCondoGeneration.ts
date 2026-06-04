// src/lib/ai/validateCondoGeneration.ts
// WS4 patch 2 (DEC-WS4-5, ADR 0002) — condo-building-tier validator.
//
// No net-new detector: this is the SAME W2 grounding gate re-pointed at condo
// building input via `condoInputToStreetAdapter`, exactly as
// validateHubGeneration re-points it at neighbourhood input via
// hubInputToStreetAdapter. The detectors (findPerTradeFabrications,
// findUngroundedNumerics, findTemporalPairings) are REUSED, never edited.
//
// Two building-tier specifics (DEC-WS4-5 fork):
//   1. The market section (`condoMarket`) is grounded on the SALE-side aggregate
//      only. On a lease-only building (saleCount12mo === 0) there is no sale data
//      to ground, so a `condoMarket` section must not exist — emitting one fires
//      the hard `condo_lease_only_market` rule.
//   2. Per-trade LEASE claims fire unless lease records exist at k ≥ 5. The
//      adapter forwards `lease.recentRecords` into `leaseActivity.recentRecords`,
//      so findPerTradeFabrications' existing lease-side data-existence gate does
//      the right thing at building tier with zero new logic.

import type {
  StreetGeneratorInput,
  ValidatorViolation,
} from "@/types/street-generator";
import type {
  CondoBuildingGeneratorInput,
  CondoSection,
  HubFAQItem,
} from "@/types/hub-generator";
import {
  findUngroundedNumerics,
  findTemporalPairings,
  findPerTradeFabrications,
  findSubkRangeReassembly,
} from "@/lib/ai/validateStreetGeneration";

// ---------------------------------------------------------------------------
// Adapter — re-point the W2 street-tier rules at condo (SALE-side) input. The
// detectors read aggregates / byType / quarterlyTrend / leaseActivity, all of
// which the condo input carries in a structurally-compatible shape. The SALE
// aggregate is the ONLY price source (the transaction_type split guarantees no
// lease value reached it); lease.recentRecords feeds the lease-side gate.
// ---------------------------------------------------------------------------

export function condoInputToStreetAdapter(input: CondoBuildingGeneratorInput): StreetGeneratorInput {
  const name = input.building.displayName;
  return {
    street: {
      name,
      slug: input.building.slug,
      shortName: name,
      type: "condo",
      identityKey: `${input.building.slug}|`,
      siblingSlugs: [input.building.slug],
      direction: "",
    },
    neighbourhoods: input.building.neighbourhoodName ? [input.building.neighbourhoodName] : [],
    aggregates: {
      txCount: input.saleAggregates.txCount,
      salesCount: input.saleAggregates.salesCount,
      leasesCount: input.saleAggregates.leasesCount,
      typicalPrice: input.saleAggregates.typicalPrice,
      priceRange: input.saleAggregates.priceRange,
      daysOnMarket: input.saleAggregates.daysOnMarket,
      kAnonLevel: input.saleAggregates.kAnonLevel,
    },
    byType: input.saleByType,
    quarterlyTrend: input.saleQuarterly
      .filter((q) => q.typical !== null)
      .map((q) => ({ quarter: q.quarter, typical: q.typical as number, count: q.count })),
    // Lease records forwarded so the per-trade LEASE gate keys on k≥5 existence.
    leaseActivity: input.lease.recentRecords
      ? {
          byBed: {},
          recentRecords: input.lease.recentRecords.map((r) => ({
            mlsNumber: "",
            address: r.address,
            listPrice: r.rent,
            soldPrice: r.rent, // = monthly rent for For Lease records
            beds: r.beds,
            baths: 0,
            sqftRange: null,
            daysOnMarket: r.daysOnMarket,
            propertyType: "condo",
            soldMonth: r.soldMonth,
            leaseTerm: null,
            furnished: null,
          })),
          ...(input.lease.rangeStats ? { rangeStats: input.lease.rangeStats } : {}),
        }
      : undefined,
    nearby: {
      parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [],
    },
    commute: {
      toTorontoDowntown: { method: "", minutes: 0 },
      toMississauga: { method: "", minutes: 0 },
      toOakville: { method: "", minutes: 0 },
      toBurlington: { method: "", minutes: 0 },
      toPearson: { method: "", minutes: 0 },
    },
    activeListingsCount: 0,
    crossStreets: [],
  };
}

// ---------------------------------------------------------------------------
// validateCondoSectionsSubset — the condo analogue of validateHubSectionsSubset.
//   - condoMarket on a lease-only building → condo_lease_only_market (hard).
//   - condoMarket / unitMix (sale-active) → re-pointed W2 aggregate gates.
//   - every section → per-trade fabrication scan (sale always fires; lease fires
//     below k=5). This is the W2 gate at building granularity.
// ---------------------------------------------------------------------------

export function validateCondoSectionsSubset(
  sections: CondoSection[],
  input: CondoBuildingGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];
  const adapter = condoInputToStreetAdapter(input);

  for (const section of sections) {
    const text = section.paragraphs.join("\n\n");

    // The sale market section cannot exist on a lease-only building — there is
    // no sale-side data to ground it (DEC-WS4-5 fork).
    if (section.id === "condoMarket" && input.leaseOnly) {
      violations.push({
        rule: "condo_lease_only_market",
        excerpt:
          `condoMarket section emitted on a lease-only building (saleCount12mo=0, ` +
          `recencyWeightedSold=${input.recencyWeightedSold}). No sale aggregate exists to ground a ` +
          `market section; a lease-only building is standard-tier with no sale market (DEC-WS4-5).`,
        severity: "hard",
      });
      // No sale data to ground — still scan for smuggled per-trade claims below.
    }

    const isAggregateSection =
      (section.id === "condoMarket" && !input.leaseOnly) || section.id === "unitMix";

    if (isAggregateSection) {
      for (const p of findPerTradeFabrications(text, adapter)) {
        violations.push({
          rule: "per_trade_fabrication",
          excerpt: `${p.side}-side: "${p.matchedPhrase}" — ${p.reason}; ctx: ${p.context}`,
          severity: "hard",
        });
      }
      for (const f of findUngroundedNumerics(text, adapter)) {
        violations.push({
          rule: "numeric_ungrounded",
          excerpt: `"${f.raw}" (${f.type}) — ${f.reason}; ctx: ${f.context}`,
          severity: "hard",
        });
      }
      if (section.id === "condoMarket") {
        for (const t of findTemporalPairings(text, adapter)) {
          violations.push({
            rule: "temporal_pairing",
            excerpt: `${t.type}: ${t.reason}; ctx: ${t.context}`,
            severity: "hard",
          });
        }
      }
      // WS5 — sub-k range reassembly: a low–high band when the building's sale
      // priceRange is k-anon suppressed (salesCount<10 — 39/41 sale-active
      // buildings). Mirror of validateHubGeneration's liveMarket wiring.
      // Aggregate sections ONLY — the editorial fees section cites legitimate
      // maintenance-fee bands and must not trip a price-band detector.
      for (const r of findSubkRangeReassembly(text, adapter)) {
        violations.push({
          rule: "subk_range_reassembly",
          excerpt: `${r.reason}; ctx: ${r.context}`,
          severity: "hard",
        });
      }
    } else {
      // Editorial sections (history / amenities / fees / CTAs / FAQ): no numeric
      // gate (fees cites grounded building attributes the adapter doesn't carry),
      // but per-trade claims are still fabrications. The lease-side gate fires
      // here when a lease-only building has no records at k≥5.
      for (const p of findPerTradeFabrications(text, adapter)) {
        violations.push({
          rule: "per_trade_fabrication",
          excerpt: `${p.side}-side: "${p.matchedPhrase}" — ${p.reason}; ctx: ${p.context}`,
          severity: "hard",
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// validateCondoFaq (WS5) — the condo analogue of validateHubFaq (Rule A). The
// condo FAQ was previously UNVALIDATED — the exact hole the hub had before
// Rule A (brookville's "$2.0M–$2.25M" band). Per-trade fabrication is banned
// in EVERY answer; the sub-k range gate runs on EVERY answer (mislabel-
// resistant — a price band cannot hide in an editorial-bucket answer); numeric
// grounding + temporal pairing run on aggregate-bucket answers, which at condo
// tier exist only on sale-active buildings (07-faq.md).
// ---------------------------------------------------------------------------

export function validateCondoFaq(
  faq: HubFAQItem[],
  input: CondoBuildingGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];
  const adapter = condoInputToStreetAdapter(input);

  for (const item of faq) {
    const q = item.question.slice(0, 48);
    const text = item.answer;

    // Per-trade fabrication is banned in any answer (input has no per-trade
    // sale rows; lease records gate at k≥5 via the adapter).
    for (const p of findPerTradeFabrications(text, adapter)) {
      violations.push({
        rule: "per_trade_fabrication",
        excerpt: `FAQ "${q}": ${p.side}-side: "${p.matchedPhrase}" — ${p.reason}`,
        severity: "hard",
      });
    }
    // Sub-k range band is banned in ANY answer (mislabel-resistant).
    for (const r of findSubkRangeReassembly(text, adapter)) {
      violations.push({
        rule: "subk_range_reassembly",
        excerpt: `FAQ "${q}": ${r.reason}; ctx: ${r.context}`,
        severity: "hard",
      });
    }
    // Aggregate-bucket answers cite aggregates → numeric grounding + temporal.
    if (item.bucket === "aggregate") {
      for (const f of findUngroundedNumerics(text, adapter)) {
        violations.push({
          rule: "numeric_ungrounded",
          excerpt: `FAQ "${q}": "${f.raw}" (${f.type}) — ${f.reason}`,
          severity: "hard",
        });
      }
      for (const t of findTemporalPairings(text, adapter)) {
        violations.push({
          rule: "temporal_pairing",
          excerpt: `FAQ "${q}": ${t.type}: ${t.reason}`,
          severity: "hard",
        });
      }
    }
  }
  return violations;
}
