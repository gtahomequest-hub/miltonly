// scripts/test-sales-register.ts
// Unit tests for findSalesRegisterLeak — the sales-register pivot detector
// that catches advisory/promotional voice in editorial prose.
// Run: npx tsx scripts/test-sales-register.ts

import { findSalesRegisterLeak } from "@/lib/ai/validateStreetGeneration";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function expectLeak(name: string, text: string, expectedPhraseFragment: string) {
  const r = findSalesRegisterLeak(text);
  if (!r) {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      expected leak with "${expectedPhraseFragment}", got: null`);
    return;
  }
  const ok = r.matchedPhrase.toLowerCase().includes(expectedPhraseFragment.toLowerCase());
  if (ok) {
    passed++;
    console.log(`  [✓] ${name}`);
    console.log(`      matched: "${r.matchedPhrase}"`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      expected match containing "${expectedPhraseFragment}", got "${r.matchedPhrase}"`);
  }
}

function expectClean(name: string, text: string) {
  const r = findSalesRegisterLeak(text);
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

console.log("=== Canonical sales-pivot from prior B1 sample ===");
expectLeak(
  "the canonical 'Our team monitors' phrase",
  "Our team monitors the street closely and can provide detailed guidance on current listings and off-market opportunities.",
  "Our team",
);

console.log("\n=== First-person plural advisory pivots ===");
expectLeak(
  "'we follow this market closely'",
  "The street has tight inventory. We follow this market closely and have insight into pricing patterns.",
  "We follow",
);
expectLeak(
  "'we track' pattern",
  "We track every transaction on this street so buyers can see the texture of the market.",
  "We track",
);
expectLeak(
  "'our view' pattern",
  "In our view, the street offers a calm base with strong school options.",
  "our view",
);
expectLeak(
  "'we'll' contraction",
  "If you're considering this street, we'll walk you through the comparable sets.",
  "we'll",
);

console.log("\n=== Reader-contact invitations ===");
expectLeak(
  "'reach out' invitation",
  "For tailored recommendations on this street, reach out to discuss your priorities.",
  "reach out",
);
expectLeak(
  "'feel free to'",
  "Feel free to schedule a conversation if Asleton fits your priorities.",
  "feel free",
);
expectLeak(
  "'off-market opportunities' triggers (caught by 'We can' first, off-market also a leak phrase)",
  "We can introduce you to off-market opportunities that don't appear on public sites.",
  "We can",
);
// Test with off-market-only (no pronoun pivot), to make sure off-market triggers on its own
expectLeak(
  "'off-market' alone (no preceding pronoun pivot)",
  "Buyers sometimes find off-market opportunities through informal networks here.",
  "off-market",
);

console.log("\n=== Editorial-clean prose (should NOT fire) ===");
expectClean(
  "third-person observation",
  "Asleton Boulevard sits in the Willmott neighbourhood, a quiet residential stretch that connects parks to schools.",
);
expectClean(
  "passive observational tone",
  "Homes here typically trade in the high-$700s to the mid-$800s. The rental market is active for three-bedroom units.",
);
expectClean(
  "factual schools description",
  "Public elementary draws to Sam Sherratt Public School. Catholic students attend St. Scholastica Catholic Elementary, walkable from the street.",
);
expectClean(
  "differentPriorities qualitative form",
  "Buyers exploring comparable options often look toward older neighbourhoods south of the 401, where homes were built in the late 1990s with deeper lots.",
);

console.log("\n=== Edge cases ===");
expectClean(
  "common 'our' in pronoun position is not a sales pivot",
  "Local schools are within walking distance from our chosen test sample street.",
);
// Note: This last one tests a borderline case. "our" used as a generic
// possessive in non-promotional context. The regex requires phrasal context
// like "our team" or "our view" to fire.

console.log("\n=== Editorial-we in FAQ (allowed by spec) ===");
expectClean(
  "'we'd note' editorial-we (FAQ-tolerated)",
  "We'd note that the street has limited inventory.",
);

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failed tests: ${failures.join(", ")}`);
  process.exit(1);
}
process.exit(0);
