// scripts/test-temporal-pairing.ts
//
// Unit tests for the temporal_pairing validator (Task 3.7).
//
// Surfaced by Task 3.5 audit on Sonnet 3a market section — model wrote
// "before a single detached-influenced trade in Q3 2025 pushed the all-type
// composite higher" but actual outlier in input was Q3 2026, not Q3 2025.
// The numeric_ungrounded rule didn't catch this because Q3 2025 IS in the
// input — what's wrong is the price/direction PAIRING for that quarter.
//
// Run: npx tsx scripts/test-temporal-pairing.ts
// Exits 0 if all tests pass, 1 if any fail.

import { findTemporalPairings } from "@/lib/ai/validateStreetGeneration";
import type { StreetGeneratorInput } from "@/types/street-generator";

interface TestCase {
  name: string;
  input: StreetGeneratorInput;
  prose: string;
  expectFireCount: number;
  expectFireType?: ("price_mismatch" | "direction_mismatch" | "count_mismatch")[];
  expectFireOnQuarter?: string[];
}

// Synthetic input mirroring the Asleton profile used for the actual audit.
function asletonInput(): StreetGeneratorInput {
  return {
    street: { name: "Asleton Boulevard", slug: "asleton-boulevard-milton", shortName: "Asleton", type: "boulevard", identityKey: "asleton||boulevard", siblingSlugs: [], direction: "" },
    neighbourhoods: ["Willmott"],
    aggregates: {
      txCount: 37,
      salesCount: 15,
      leasesCount: 22,
      typicalPrice: 929_666,
      priceRange: { low: 733_000, high: 1_134_000 },
      daysOnMarket: 96,
      kAnonLevel: "full",
    },
    byType: {
      townhouse: { count: 12, typicalPrice: 813_416, priceRange: { low: 733_000, high: 865_000 }, kFlag: "full" },
      detached: { count: 3, typicalPrice: null, priceRange: null, kFlag: "thin" },
    },
    leaseActivity: {
      byBed: {
        "3": { count: 13, typicalRent: 2_963 },
        "4": { count: 6, typicalRent: 3_225 },
      },
    },
    quarterlyTrend: [
      { quarter: "Q2 '24", typical: 865_000, count: 1 },
      { quarter: "Q3 '24", typical: 880_600, count: 5 },
      { quarter: "Q4 '24", typical: 879_625, count: 4 },
      { quarter: "Q2 '25", typical: 836_666, count: 3 },
      { quarter: "Q3 '25", typical: 833_000, count: 6 },
      { quarter: "Q4 '25", typical: 926_500, count: 2 },
      { quarter: "Q2 '26", typical: 815_000, count: 1 },
      { quarter: "Q3 '26", typical: 1_134_000, count: 1 },
    ],
    nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
    commute: {
      toTorontoDowntown: { method: "GO", minutes: 68 },
      toMississauga: { method: "drive", minutes: 22 },
      toOakville: { method: "drive", minutes: 24 },
      toBurlington: { method: "drive", minutes: 20 },
      toPearson: { method: "drive", minutes: 32 },
    },
    activeListingsCount: 2,
    crossStreets: [],
  };
}

const TESTS: TestCase[] = [
  {
    name: "1. Valid: price matches quarter (within $25K tolerance)",
    input: asletonInput(),
    // Q3 '25 = $833,000 → "around $825,000" is within tolerance ($8K diff)
    prose: "A three-bedroom townhome traded around $825,000 in Q3 2025, representative of the typical pattern.",
    expectFireCount: 0,
  },
  {
    name: "2. Invalid: price wildly mismatches quarter",
    input: asletonInput(),
    // Q3 '25 = $833K but prose claims $1.5M → fires price_mismatch
    prose: "A trade in Q3 2025 cleared at $1,500,000, well above typical band.",
    expectFireCount: 1,
    expectFireType: ["price_mismatch"],
    expectFireOnQuarter: ["Q3 2025"],
  },
  {
    name: "3. Valid: direction matches actual q-over-q change (down)",
    input: asletonInput(),
    // Q3 '25 ($833K) is down from Q2 '25 ($837K) → "softened" is correct
    prose: "Trade prices softened modestly through Q3 2025 against the previous quarter.",
    expectFireCount: 0,
  },
  {
    name: "4. Invalid: count_mismatch (Sonnet 3a positive control)",
    input: asletonInput(),
    // Sonnet wrote "single ... trade in Q3 2025" — Q3 '25 input count=6.
    // The actual single-trade quarter is Q3 '26 (count=1). Direction-mismatch
    // doesn't fire because Q3 '25 vs Q2 '25 q-over-q is flat (within tolerance);
    // count_mismatch catches the actual fabrication shape.
    prose: "Before a single detached-influenced trade in Q3 2025 pushed the all-type composite higher, the corridor had compressed.",
    expectFireCount: 1,
    expectFireType: ["count_mismatch"],
    expectFireOnQuarter: ["Q3 2025"],
  },
  {
    name: "4b. Invalid: direction contradicts actual (clean q-over-q opposite)",
    input: asletonInput(),
    // Q3 '26 = $1,134K, Q2 '26 = $815K → q-over-q +39% (UP).
    // Stated "fell sharply" (down) → opposite of UP → fires direction_mismatch.
    prose: "Prices fell sharply into Q3 2026 amid weakening demand.",
    expectFireCount: 1,
    expectFireType: ["direction_mismatch"],
    expectFireOnQuarter: ["Q3 2026"],
  },
  {
    name: "5. Valid: quarter mentioned alone with no direction or price (no fire)",
    input: asletonInput(),
    prose: "The trend was visible across multiple quarters including Q3 2025 and Q4 2025.",
    expectFireCount: 0,
  },
  {
    name: "6. No double-fire on quarter not in input (numeric_ungrounded handles)",
    input: asletonInput(),
    // Q3 '23 not in input — temporal_pairing should not fire (numeric_ungrounded does)
    prose: "Looking back to Q3 2023, prices were $750,000 and rose into 2024.",
    expectFireCount: 0,
  },
  {
    name: "7. Multiple quarters in same prose, each evaluated independently",
    input: asletonInput(),
    // Q3 '24 = $880K → "$880,000" matches ✓; Q3 '25 = $833K → "$1.5M" mismatches ✗
    prose: "In Q3 2024 the typical was $880,000, then in Q3 2025 prices reached $1,500,000.",
    expectFireCount: 1,
    expectFireType: ["price_mismatch"],
    expectFireOnQuarter: ["Q3 2025"],
  },
  {
    name: "8. Edge: quarter is first in input (no prev) — direction check skipped",
    input: asletonInput(),
    // Q2 '24 is first in trend; no prior quarter → direction check skipped
    prose: "Q2 2024 saw prices rise sharply, reflecting strong demand.",
    expectFireCount: 0,
  },
  {
    name: "9. Edge: rent price near quarter — should not fire price_mismatch",
    input: asletonInput(),
    // The $3,000 is rent (lease context), not sale — should be skipped
    prose: "In Q3 2025, three-bedroom units leased at $3,000 per month, with steady demand.",
    expectFireCount: 0,
  },
  {
    name: "10. Edge: flat actual change vs stated direction (no fire — only opposite triggers)",
    input: asletonInput(),
    // Q3 '25 vs Q2 '25 is ~flat (-0.4%). Prose says "rose" → flat is not "down", not opposite → no fire
    // Direction rule only fires when stated direction is OPPOSITE to actual.
    prose: "Q3 2025 prices rose slightly compared to the prior quarter.",
    expectFireCount: 0,
  },
  {
    name: "11. Edge: rounding tolerance — $850K vs input $833K within 5%",
    input: asletonInput(),
    // 5% of $833K = $41K. $850K - $833K = $17K, well within tolerance.
    prose: "Q3 2025 typical was around $850,000.",
    expectFireCount: 0,
  },
  {
    name: "12. Direction match (down stated, down actual)",
    input: asletonInput(),
    // Q2 '25 = $837K, Q4 '24 = $880K → q-over-q is down. "dropped" matches.
    prose: "Prices dropped notably into Q2 2025 against the close of 2024.",
    expectFireCount: 0,
  },
  {
    name: "13. Empty quarterlyTrend in input — rule no-ops",
    input: { ...asletonInput(), quarterlyTrend: [] },
    prose: "In Q3 2025 prices rose to $1,500,000.",
    expectFireCount: 0,
  },
  {
    name: "14. Quarter using two-digit year shorthand (Q3 '25)",
    input: asletonInput(),
    // Q3 '25 = $833K. Prose uses Q3 '25 shorthand with $1.5M → fires price_mismatch.
    prose: "Q3 '25 saw a trade at $1,500,000, well above prior quarters.",
    expectFireCount: 1,
    expectFireType: ["price_mismatch"],
    expectFireOnQuarter: ["Q3 2025"],
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const t of TESTS) {
  const findings = findTemporalPairings(t.prose, t.input);
  const fireCount = findings.length;
  let ok = fireCount === t.expectFireCount;
  let fireDetail = `expected ${t.expectFireCount}, got ${fireCount}`;

  if (ok && t.expectFireType) {
    const types = findings.map(f => f.type).sort();
    const expected = [...t.expectFireType].sort();
    if (JSON.stringify(types) !== JSON.stringify(expected)) {
      ok = false;
      fireDetail = `types expected [${expected.join(",")}], got [${types.join(",")}]`;
    }
  }
  if (ok && t.expectFireOnQuarter) {
    const qs = findings.map(f => f.quarter).sort();
    const expected = [...t.expectFireOnQuarter].sort();
    if (JSON.stringify(qs) !== JSON.stringify(expected)) {
      ok = false;
      fireDetail = `quarters expected [${expected.join(",")}], got [${qs.join(",")}]`;
    }
  }

  if (ok) {
    passed++;
    console.log(`  ✓ ${t.name}`);
  } else {
    failed++;
    failures.push(`${t.name} — ${fireDetail}`);
    console.log(`  ✗ ${t.name} — ${fireDetail}`);
    for (const f of findings) console.log(`      [${f.type}] quarter=${f.quarter} reason=${f.reason}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed (${TESTS.length} total)`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
