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
} from "@/types/hub-generator";
import {
  findUngroundedNumerics,
  findTemporalPairings,
  findPerTradeFabrications,
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
