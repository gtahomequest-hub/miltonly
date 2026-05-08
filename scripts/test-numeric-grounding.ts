// scripts/test-numeric-grounding.ts
//
// Unit tests for the numeric_ungrounded validator (Task 2).
// Covers the failure patterns surfaced in the Task-1 + Action-2 audits:
//   - Price band extrapolation (Etheridge $1.5M; dymott/leger high-$800s; etc.)
//   - Invented condition/position differentials (Asleton $30K; frost $30K;
//     whitlock $50K-$80K)
//
// Plus negative tests confirming GROUNDED prose passes:
//   - "around $825K" matching input typicalPrice = $824,500 (rounding tolerance)
//   - Yield calculation derived from input lease + sale (allowed derivation)
//   - Prose with no numerics (trivially passes)
//   - Year references (input has no construction-year; year alone fires)
//
// Run: npx tsx scripts/test-numeric-grounding.ts
//
// Exits 0 if all tests pass, 1 if any fail.

import { findUngroundedNumerics } from "@/lib/ai/validateStreetGeneration";
import type { StreetGeneratorInput } from "@/types/street-generator";

interface TestCase {
  name: string;
  input: StreetGeneratorInput;
  prose: string;
  expectFireCount: number;
  expectFireOn?: string[]; // raw tokens that should be in the findings
}

// Synthetic input mirroring the Asleton-class profile (rich data).
function richInput(overrides: Partial<StreetGeneratorInput["aggregates"]> = {}): StreetGeneratorInput {
  return {
    street: { name: "Test Street", slug: "test-street", shortName: "Test", type: "St", identityKey: "test", siblingSlugs: [], direction: "" },
    neighbourhoods: ["Willmott"],
    aggregates: {
      txCount: 37,
      salesCount: 15,
      leasesCount: 22,
      typicalPrice: 825_000,
      priceRange: { low: 725_000, high: 1_150_000 },
      daysOnMarket: 96,
      kAnonLevel: "full",
      ...overrides,
    },
    byType: {
      Townhouse: { count: 12, typicalPrice: 825_000, priceRange: { low: 725_000, high: 875_000 }, kFlag: "full" },
      Detached: { count: 3, typicalPrice: 1_150_000, priceRange: null, kFlag: "thin" },
    },
    leaseActivity: {
      byBed: {
        "3-bedroom": { count: 16, typicalRent: 3_000 },
        "4-bedroom": { count: 6, typicalRent: 3_200 },
      },
    },
    quarterlyTrend: [
      { quarter: "Q3 '24", typical: 875_000, count: 4 },
      { quarter: "Q3 '25", typical: 825_000, count: 5 },
      { quarter: "Q4 '25", typical: 925_000, count: 2 },
    ],
    nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
    commute: {
      toTorontoDowntown: { method: "GO", minutes: 70 },
      toMississauga: { method: "drive", minutes: 22 },
      toOakville: { method: "drive", minutes: 24 },
      toBurlington: { method: "drive", minutes: 20 },
      toPearson: { method: "drive", minutes: 32 },
    },
    activeListingsCount: 2,
    crossStreets: [],
  };
}

// Etheridge-class thin input (the audited fabrication).
function thinInput(): StreetGeneratorInput {
  return {
    street: { name: "Etheridge Avenue", slug: "etheridge-avenue-milton", shortName: "Etheridge", type: "Ave", identityKey: "etheridge", siblingSlugs: [], direction: "" },
    neighbourhoods: ["Ford"],
    aggregates: {
      txCount: 5,
      salesCount: 5,
      leasesCount: 0,
      typicalPrice: 1_271_000,
      priceRange: { low: 1_020_000, high: 1_415_000 },
      daysOnMarket: 60,
      kAnonLevel: "full",
    },
    byType: {
      Detached: { count: 5, typicalPrice: 1_271_000, priceRange: { low: 1_020_000, high: 1_415_000 }, kFlag: "full" },
    },
    leaseActivity: { byBed: {} },
    quarterlyTrend: [],
    nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
    commute: {
      toTorontoDowntown: { method: "GO", minutes: 70 },
      toMississauga: { method: "drive", minutes: 22 },
      toOakville: { method: "drive", minutes: 24 },
      toBurlington: { method: "drive", minutes: 20 },
      toPearson: { method: "drive", minutes: 32 },
    },
    activeListingsCount: 1,
    crossStreets: [],
  };
}

const TESTS: TestCase[] = [
  // === Failure patterns from production audit ===
  {
    name: "Etheridge price-ceiling extrapolation: $1.5M when input maxes $1.415M (and $1.2M lower-bound also outside tolerance)",
    input: thinInput(),
    prose: "Buyers considering Etheridge should expect a price point in the $1.2M to $1.5M range, consistent with similar homes in the vicinity.",
    expectFireCount: 2,
    expectFireOn: ["$1.5M", "$1.2M"],
  },
  {
    name: "Asleton invented end-unit-vs-interior $30K differential (no condition split in input)",
    input: richInput(),
    prose: "The price differential between end units and interior units is modest, typically within $30,000.",
    expectFireCount: 1,
    expectFireOn: ["$30,000"],
  },
  {
    name: "Whitlock invented premium range ($50K-$80K) — both ungrounded",
    input: richInput({ salesCount: 13 }),
    prose: "End-unit positions command a premium of $50,000 to $80,000 over interior units without upgrades.",
    expectFireCount: 2,
    expectFireOn: ["$50,000", "$80,000"],
  },
  {
    name: "Invented post-2015 era premium percentage",
    input: richInput(),
    prose: "Units built after 2015 trade at a 5.5% premium over older stock.",
    // 5.5% is in a "premium" context, and "2015" is a year-era qualifier.
    // Both should fire — 2 findings.
    expectFireCount: 2,
    expectFireOn: ["5.5%", "after 2015"],
  },
  // === Grounded prose — must NOT fire ===
  {
    name: "GROUNDED: typical price $825K matches input typicalPrice within tolerance",
    input: richInput(),
    prose: "Townhouses on the street typically trade around $825,000, with a range from the mid-$700s to the mid-$800s.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: yield calculation derives from input rent × 12 / sale",
    input: richInput(),
    // 3000 × 12 / 825000 = 4.36% — should derive cleanly
    prose: "Three-bedroom units lease around $3,000 against comparable sale prices near $825,000, implying gross yields near 4.4%.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: lease-to-sale ratio matches input (22/15 ≈ 1.5)",
    input: richInput(),
    prose: "Lease activity outpaces sales by a ratio of nearly 1.5 to 1, with 22 leases against 15 sales.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: DOM 96 matches input within ±5 tolerance",
    input: richInput(),
    prose: "Days on market average around 96, indicating a measured pace.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: prose with no numerics (trivially passes)",
    input: richInput(),
    prose: "The street trades primarily as a townhouse pocket, with detached homes appearing only sparingly.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: rounding tolerance — 'around $825K' when input is $824,500",
    input: richInput({ typicalPrice: 824_500 }),
    prose: "A typical townhome trades around $825,000 in this band.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: quarter labels 'Q3 2024' and 'Q3 2025' match input quarterlyTrend",
    input: richInput(),
    prose: "Prices have softened from $875,000 in Q3 2024 to $825,000 in Q3 2025.",
    expectFireCount: 0,
  },
  {
    name: "FABRICATED: quarter Q1 2026 not in input quarterlyTrend",
    input: richInput(),
    prose: "A three-bedroom townhome traded around $825,000 in Q1 2026.",
    expectFireCount: 1,
    expectFireOn: ["Q1 2026"],
  },
  {
    name: "FABRICATED: count '11 of 22 leases' invents numerator",
    input: richInput(), // byBed has 16 + 6 = 22 leases. 11 not in counts.
    prose: "Tenant demand is concentrated in three-bedroom units (11 of 22 leases).",
    expectFireCount: 1,
    expectFireOn: ["11 of 22"],
  },
  {
    name: "GROUNDED: count '16 of 22' matches input byBed (16 = 3-bed, 22 = total)",
    input: richInput(),
    prose: "Tenant demand concentrates in three-bedroom units, accounting for 16 of 22 leases on the street.",
    expectFireCount: 0,
  },
  {
    name: "GROUNDED: '2 active listings' matches activeListingsCount=2",
    input: richInput(),
    prose: "Only 2 active listings sit on the street currently.",
    expectFireCount: 0,
  },
  {
    name: "FABRICATED: '5 active listings' when input activeListingsCount=2",
    input: richInput(),
    prose: "Only 5 active listings sit on the street currently.",
    expectFireCount: 1,
    expectFireOn: ["Only 5 active"],
  },
];

interface Result { name: string; passed: boolean; detail: string }

function run(test: TestCase): Result {
  const findings = findUngroundedNumerics(test.prose, test.input);
  const actualCount = findings.length;
  const passed = actualCount === test.expectFireCount &&
    (test.expectFireOn?.every(tok => findings.some(f => f.raw === tok)) ?? true);
  if (passed) {
    return { name: test.name, passed: true, detail: `fires=${actualCount} (expected ${test.expectFireCount})` };
  }
  const detail = `fires=${actualCount} (expected ${test.expectFireCount})\n` +
    findings.map(f => `    fire: "${f.raw}" (${f.type}) — ${f.reason}`).join("\n");
  return { name: test.name, passed: false, detail };
}

function main() {
  console.log("Running numeric_ungrounded validator tests");
  console.log("=".repeat(70));
  const results = TESTS.map(run);
  let passed = 0;
  for (const r of results) {
    const mark = r.passed ? "✓" : "✗";
    console.log(`[${mark}] ${r.name}`);
    if (!r.passed) console.log(`    ${r.detail}`);
    if (r.passed) passed++;
  }
  console.log("=".repeat(70));
  console.log(`SUMMARY: ${passed}/${results.length} passed`);
  if (passed < results.length) process.exit(1);
}

main();
