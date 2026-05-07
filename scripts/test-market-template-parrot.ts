// scripts/test-market-template-parrot.ts
// Unit tests for findMarketTemplateParrot — the regex backstop that
// catches the specific worked-example phrases that were getting lifted
// verbatim across the B3 sample series. Phrase substring match,
// case-insensitive.
// Run: npx tsx scripts/test-market-template-parrot.ts

import { findMarketTemplateParrot } from "@/lib/ai/validateStreetGeneration";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function expectFire(name: string, text: string, expectedFragment: string) {
  const r = findMarketTemplateParrot(text);
  if (!r) {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      expected fire on "${expectedFragment}", got: null`);
    return;
  }
  const ok = r.matchedPhrase.toLowerCase().includes(expectedFragment.toLowerCase());
  if (ok) {
    passed++;
    console.log(`  [✓] ${name}`);
    console.log(`      matched: "${r.matchedPhrase}"`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      expected match containing "${expectedFragment}", got "${r.matchedPhrase}"`);
  }
}

function expectClean(name: string, text: string) {
  const r = findMarketTemplateParrot(text);
  if (r === null) {
    passed++;
    console.log(`  [✓] ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      expected clean, got match: "${r.matchedPhrase}" — excerpt: ${r.excerpt}`);
  }
}

console.log("=== Banned phrases — exact match ===");
expectFire(
  "exact: 'end units and units with finished basements consistently land...'",
  "End units and units with finished basements consistently land in the upper third of the band.",
  "end units and units with finished basements",
);
expectFire(
  "exact: 'interior units without basement finish trade closer to...'",
  "Interior units without basement finish trade closer to the bottom of the range.",
  "interior units without basement finish trade",
);
expectFire(
  "exact: 'investor demand is anchored'",
  "With 22 leases against 15 sales over the period, investor demand is anchored at this scale.",
  "investor demand is anchored",
);

console.log("\n=== Capitalization variants — should still fire ===");
expectFire(
  "uppercase 'END UNITS AND UNITS WITH FINISHED BASEMENTS'",
  "END UNITS AND UNITS WITH FINISHED BASEMENTS take a clear premium.",
  "END UNITS AND UNITS WITH FINISHED BASEMENTS",
);
expectFire(
  "title case: 'Investor Demand Is Anchored'",
  "The lease ratio shows that Investor Demand Is Anchored on this street.",
  "Investor Demand Is Anchored",
);
expectFire(
  "mixed case 'End Units and units With Finished Basements'",
  "On Asleton, End Units and units With Finished Basements consistently top the band.",
  "End Units and units With Finished Basements",
);

console.log("\n=== Embedded in real-shaped market prose — should fire ===");
expectFire(
  "the canonical S1 parrot from B3",
  "Asleton Boulevard has seen 15 sales over the period. End units and units with finished basements consistently land in the upper third; interior units without basement finish trade closer to the bottom. Days on market sit around three months.",
  "end units and units with finished basements",
);

console.log("\n=== Close variants that should NOT trigger ===");
expectClean(
  "'end units sell at a premium' — different phrasing, same concept, allowed",
  "End units sell at a premium of around 5 percent on this street, reflecting more natural light and a wider lot.",
);
expectClean(
  "'finished basements push price up' — different phrasing, allowed",
  "Finished basements push price up by $20K to $30K consistently, but only when the rest of the unit is well-presented.",
);
expectClean(
  "'investors anchor the rental market' — different phrasing, allowed",
  "Investors anchor the rental market here; the lease-to-sale ratio of 22:15 reflects strong tenant demand.",
);
expectClean(
  "'units without basement finishing' — different word order, allowed",
  "Units without basement finishing trade for less, particularly on smaller floor plans.",
);
expectClean(
  "'interior units lacking basement finishes' — different phrasing, allowed",
  "Interior units lacking basement finishes typically trade $30K below end units with comparable upgrades.",
);

console.log("\n=== Original analytical content — should be clean ===");
expectClean(
  "S2-style original analysis (no parroting)",
  "Townhomes on the south end trade $30,000 to $50,000 above the north end consistently, reflecting closer transit and the elementary catchment boundary. Q3 2025 saw three south-end trades at $785,000 to $815,000 against two north-end at $735,000 to $755,000. The pattern has been stable for two years.",
);
expectClean(
  "S5-style original analysis with input-grounded numbers",
  "Townhomes have traded in a range from the low-$725,000s to the mid-$850,000s, with typical prices settling around $800,000 to $850,000. Detached homes, though rare, trade in the $1.1M to $1.15M range.",
);

console.log("\n=== Substring boundary cases ===");
expectFire(
  "phrase appears mid-sentence with surrounding context",
  "Looking at the data, end units and units with finished basements seem to do better in spring.",
  "end units and units with finished basements",
);
expectClean(
  "'end' and 'units' separated by other words — should NOT trigger (substring requires consecutive)",
  "At the south end of the street, units priced under $750K have moved quickly.",
);

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failed tests: ${failures.join(", ")}`);
  process.exit(1);
}
process.exit(0);
