// scripts/test-qualitative-grounding.ts
//
// Unit tests for qualitative_grounding (Cat A) validator (Task 3.8 Intervention 4).
// Catches subsegment-comparative fabrications that numeric_ungrounded misses
// when no specific dollar amount is stated.
//
// Run: npx tsx scripts/test-qualitative-grounding.ts
// Exits 0 if all tests pass, 1 if any fail.

import { findQualitativeGroundingViolations } from "@/lib/ai/validateStreetGeneration";

interface TestCase {
  name: string;
  prose: string;
  expectFireCount: number;
  expectSubsegmentTerm?: string;
  expectComparativeTerm?: string;
}

const TESTS: TestCase[] = [
  {
    name: "1. Valid: market prose with no subsegment-comparative pairings",
    prose: "Townhouses on Asleton trade between $725,000 and $875,000, with the typical price around $825,000. Days on market average 96.",
    expectFireCount: 0,
  },
  {
    name: "2. Invalid: end-units / premium pairing",
    prose: "End-units command a premium over interior units due to additional windows and corner exposure.",
    expectFireCount: 2, // both "end-units" and "interior units" trigger (each within 50 chars of "premium")
  },
  {
    name: "3. Invalid: older construction / discount pairing",
    prose: "Older construction units trade at a discount compared to newer builds.",
    expectFireCount: 2, // "older construction" + "newer builds" each near "discount"/"trade at a"
  },
  {
    name: "4. Invalid: finished basements / command pairing",
    prose: "Finished basements command higher prices than unfinished basements.",
    expectFireCount: 2, // both finished and unfinished within 50 chars of "command"
  },
  {
    name: "5. Invalid: larger lots / value higher pairing (3 fires — larger, smaller, south end)",
    prose: "The larger lots on the south end value higher than smaller lots near the arterial.",
    expectFireCount: 3, // larger lots + smaller lots + south end all near "value higher"
  },
  {
    name: "6. Invalid: end of street / above the typical pairing",
    prose: "Properties at the end of the street consistently sit above the typical price.",
    expectFireCount: 1,
  },
  {
    name: "7. Edge: 'end units' alone without comparative — should NOT fire",
    prose: "The street has 12 end units and 18 interior units across its rows.",
    expectFireCount: 0,
  },
  {
    name: "8. Edge: 'premium' alone without subsegment — should NOT fire",
    prose: "Buyers value the premium location near schools and parks.",
    expectFireCount: 0,
  },
  {
    name: "9. Edge: subsegment + comparative > 50 chars apart — should NOT fire",
    prose: "End-units sit at the corner of the street. Days on market average 96 across all stock. Interior pricing remains stable. The typical price commands a premium relative to nearby streets.",
    expectFireCount: 0, // "end-units" and "premium" are far apart (>50 chars), should not pair
  },
  {
    name: "10. Invalid: south end / commanding the upper end (Sonnet positive control)",
    // From actual Pass 2 fabrication patterns observed in Task 3.6: model wrote
    // about "south end" or "north end" as commanding higher prices.
    prose: "Townhouses on the south end commanding the upper end of the band reflect newer construction.",
    expectFireCount: 2, // "south end" + "newer construction" each near "commanding the upper end"
  },
  {
    name: "11. Invalid: corner units / trade above pairing",
    // "interior layout" doesn't match "interior unit" or "interior units"
    // (vocab list is specific to unit/lot subsegments). Only "corner units" fires.
    prose: "Corner units trade above the standard interior layout.",
    expectFireCount: 1,
  },
  {
    name: "12. Edge: prose mentions both subsegment and comparative for unrelated points",
    prose: "End-units make up 12 of the 30 properties. Lease activity is robust, with three-bedroom units commanding $3,000 monthly rent.",
    // "end-units" appears, "commanding" appears, but the subsegment is about
    // count not pricing, and the comparative is about rent not subsegment-vs-subsegment.
    // With 50-char window, "end-units" at idx ~0 vs "commanding" at idx ~80+ → far apart → no fire.
    expectFireCount: 0,
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const t of TESTS) {
  const findings = findQualitativeGroundingViolations(t.prose);
  const fireCount = findings.length;
  let ok = fireCount === t.expectFireCount;
  let detail = `expected ${t.expectFireCount}, got ${fireCount}`;

  if (ok) {
    passed++;
    console.log(`  ✓ ${t.name}`);
  } else {
    failed++;
    failures.push(`${t.name} — ${detail}`);
    console.log(`  ✗ ${t.name} — ${detail}`);
    for (const f of findings) {
      console.log(`      [${f.subsegmentTerm} × ${f.comparativeTerm}] ${f.context.slice(0, 100)}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed (${TESTS.length} total)`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
