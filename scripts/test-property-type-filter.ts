// Unit tests for mapPropertyTypeToFilter. Asserts the slider's default-pill
// derivation across production-normalized strings, TRREB raw formats,
// case-insensitive variants, and safe-fallback edge cases.
//
// Run: pnpm tsx scripts/test-property-type-filter.ts

import { mapPropertyTypeToFilter } from "../src/components/landing/LiveListingSlider";

let passed = 0;
function assertMap(input: string | null | undefined, expected: string, label: string) {
  const actual = mapPropertyTypeToFilter(input);
  if (actual !== expected) {
    console.error(`✗ FAIL [${label}] input=${JSON.stringify(input)} → expected "${expected}", got "${actual}"`);
    process.exit(1);
  }
  console.log(`✓ [${label}] ${JSON.stringify(input)} → "${actual}"`);
  passed++;
}

console.log("=== mapPropertyTypeToFilter — production-normalized strings ===");
assertMap("detached", "detached", "1/17 production detached");
assertMap("semi", "semi", "2/17 production semi");
assertMap("townhouse", "townhouse", "3/17 production townhouse");
assertMap("condo", "condo", "4/17 production condo");

console.log("\n=== TRREB raw formats ===");
assertMap("Detached", "detached", "5/17 TRREB Detached");
assertMap("Semi-Detached", "semi", "6/17 TRREB Semi-Detached");
assertMap("Att/Row/Townhouse", "townhouse", "7/17 TRREB Att/Row/Townhouse");
assertMap("Condo Apartment", "condo", "8/17 TRREB Condo Apartment");
assertMap("Condo Townhouse", "condo", "9/17 TRREB Condo Townhouse");

console.log("\n=== Case-insensitivity edge cases ===");
assertMap("DETACHED", "detached", "10/17 all-caps DETACHED");
assertMap("semi-detached", "semi", "11/17 lowercase semi-detached");
assertMap("att/row/townhouse", "townhouse", "12/17 lowercase att/row/townhouse");

console.log("\n=== Safe fallbacks ===");
assertMap("", "similar", "13/17 empty string");
assertMap(null, "similar", "14/17 null");
assertMap(undefined, "similar", "15/17 undefined");
assertMap("loft", "similar", "16/17 recognized-but-unmapped (loft)");
assertMap("asdf123", "similar", "17/17 gibberish (asdf123)");

console.log(`\n✓ All ${passed}/17 assertions passed.`);
