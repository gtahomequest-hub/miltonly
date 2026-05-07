// scripts/test-price-rounding.ts
// Unit tests for roundPricesInOutput.
// Run: npx tsx scripts/test-price-rounding.ts

import { __test__ } from "@/lib/ai/roundPricesInOutput";
const { roundPricesInString, roundPrice, findPriceTokens } = __test__;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  [✓] ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
  }
}

console.log("=== roundPrice (raw helper) ===");
check("$475,000 → $480,000 ($10K tier — $475K is multiple of $5K, not $10K)", roundPrice(475_000).rounded, 480_000);
check("$470,000 already rounded ($10K tier)",  roundPrice(470_000).rounded, 470_000);
check("$478,000 → $480,000 ($10K tier)",       roundPrice(478_000).rounded, 480_000);
check("$880,000 → $875,000 ($25K tier)",       roundPrice(880_000).rounded, 875_000);
check("$1,130,000 → $1,150,000 ($50K tier)",   roundPrice(1_130_000).rounded, 1_150_000);
check("$2,340,000 → $2,300,000 ($100K tier)",  roundPrice(2_340_000).rounded, 2_300_000);
check("$500,000 boundary (round to $25K, no change)", roundPrice(500_000).rounded, 500_000);
check("$1,000,000 boundary (no change)",       roundPrice(1_000_000).rounded, 1_000_000);
check("$2,000,000 boundary (no change)",       roundPrice(2_000_000).rounded, 2_000_000);
check("$2,950 rent → $3,000 ($100 tier)",      roundPrice(2_950).rounded, 3_000);
check("$2,925 rent → $2,900",                  roundPrice(2_925).rounded, 2_900);
check("$1,830 rent → $1,850 ($50 tier)",       roundPrice(1_830).rounded, 1_850);
check("$4,200 rent → $4,250 ($250 tier)",      roundPrice(4_200).rounded, 4_250);
check("$2,500 rent boundary",                  roundPrice(2_500).rounded, 2_500);

console.log("\n=== roundPricesInString — sale tiers ===");

// Test 1: under $500K — already rounded ($470K is multiple of $10K)
{
  const r = roundPricesInString("Sales typically land around $470,000.");
  check("under $500K already rounded → no change",
    r.text, "Sales typically land around $470,000.");
  check("  no change recorded",
    r.changes.length, 0);
}

// Test 2: under $500K — needs rounding
{
  const r = roundPricesInString("Average closes around $478,000 here.");
  check("under $500K $478K → $480K",
    r.text, "Average closes around $480,000 here.");
}

// Test 3: $500K-$999K
{
  const r = roundPricesInString("The typical price is $880,000 in trade.");
  check("$500K-$999K $880K → $875K",
    r.text, "The typical price is $875,000 in trade.");
}

// Test 4: $1M-$1.999M
{
  const r = roundPricesInString("Recent sales averaged $1,130,000.");
  check("$1M-$2M $1.13M (comma) → $1.15M (comma)",
    r.text, "Recent sales averaged $1,150,000.");
}

// Test 5: $2M+
{
  const r = roundPricesInString("A premium sample at $2,340,000 closed last quarter.");
  check("$2M+ $2.34M → $2.3M",
    r.text, "A premium sample at $2,300,000 closed last quarter.");
}

console.log("\n=== roundPricesInString — rent tiers ===");

// Test 6: rent $2,500-$3,999
{
  const r = roundPricesInString("Two-bed condos lease around $2,950 monthly.");
  check("rent $2,950 → $3,000",
    r.text, "Two-bed condos lease around $3,000 monthly.");
}

// Test 7: rent under $2,500
{
  const r = roundPricesInString("Smaller units rent for around $1,830.");
  check("rent $1,830 → $1,850",
    r.text, "Smaller units rent for around $1,850.");
}

// Test 8: rent $4,000+
{
  const r = roundPricesInString("Detached lease at $4,200 plus utilities.");
  check("rent $4,200 → $4,250",
    r.text, "Detached lease at $4,250 plus utilities.");
}

console.log("\n=== roundPricesInString — format preservation ===");

// Test 9: M-suffix in → M-suffix out
{
  const r = roundPricesInString("Higher-end stock around $1.13M.");
  check("$1.13M (M-suffix) → $1.15M",
    r.text, "Higher-end stock around $1.15M.");
}

// Test 10: K-suffix in → K-suffix out (under $500K)
{
  const r = roundPricesInString("Entry-level at $478K.");
  check("$478K → $480K (K-suffix preserved)",
    r.text, "Entry-level at $480K.");
}

// Test 11: M-suffix already aligned
{
  const r = roundPricesInString("Premium tier at $1.5M.");
  check("$1.5M already rounded → no change",
    r.text, "Premium tier at $1.5M.");
  check("  no change recorded",
    r.changes.length, 0);
}

// Test 12: M-suffix needing strip of trailing zero
{
  const r = roundPricesInString("Two-million-flat sample at $2.04M.");
  check("$2.04M → $2M (trailing-zero stripped, $100K rounding)",
    r.text, "Two-million-flat sample at $2M.");
}

console.log("\n=== roundPricesInString — multiple prices in one string ===");

// Test 13: multiple prices, one sale + one rent
{
  const r = roundPricesInString("Sales around $880,000; two-bed leases at $2,950.");
  check("two prices in one string both rounded",
    r.text, "Sales around $875,000; two-bed leases at $3,000.");
  check("  two changes recorded",
    r.changes.length, 2);
}

// Test 14: bare 4-digit rent (no comma)
{
  const r = roundPricesInString("Studios from $1900.");
  check("$1900 (no comma) → $1900 (already $50-aligned)",
    r.text, "Studios from $1900.");
}
{
  const r = roundPricesInString("Studios from $1955.");
  // Function normalizes to comma form on output (toLocaleString) — real
  // production text uses commas for 4-digit values, so this is the right
  // canonical form. Bare 4-digit input is the rare case.
  check("$1955 (bare 4-digit) → $1,950 (rounded + canonical comma form)",
    r.text, "Studios from $1,950.");
}

console.log("\n=== findPriceTokens — token detection coverage ===");

{
  const tokens = findPriceTokens("$880,000 and $1.13M and $2,950 and $425K");
  check("4 distinct prices detected",
    tokens.map(t => t.raw),
    ["$880,000", "$1.13M", "$2,950", "$425K"]);
}

{
  const tokens = findPriceTokens("MLS code 1044 - TR, postal L9T 7P9");
  check("non-price text → no tokens",
    tokens.length, 0);
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failed tests: ${failures.join(", ")}`);
  process.exit(1);
}
process.exit(0);
