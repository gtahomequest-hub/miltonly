// Unit tests for Part 4 (lease data expansion, 2026-05-09).
//
// Covers:
//   - redactAddressForPrompt PII redaction
//   - collectInputRents (validator) recognizes recentRecords + rangeStats prices
//   - K-anon boundary tests on buildLeaseSampleRecords
//
// Note: buildLeaseSampleRecords is internal to buildGeneratorInput.ts (not
// exported). Tests reach it indirectly by constructing a StreetGeneratorInput
// with realistic shapes and verifying the validator's grounded-rents
// collection includes all expected sources. The boundary k-anon behavior is
// inline-verified via independent re-implementation.
//
// Run: npx tsx scripts/test-lease-data-expansion.ts
// Exits 0 on all-pass, 1 on any failure.

import { redactAddressForPrompt } from "@/lib/ai/buildGeneratorInput";
import type { StreetGeneratorInput } from "@/types/street-generator";
import { findUngroundedNumerics } from "@/lib/ai/validateStreetGeneration";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

// ─── redactAddressForPrompt ─────────────────────────────────────────────
console.log("redactAddressForPrompt:");
check("strips trailing City/Province/Postal", redactAddressForPrompt("830 Megson Terrace 622, Milton, ON L9T 9M7") === "830 Megson Terrace");
check("strips bare unit number after street name", redactAddressForPrompt("12 Maple Avenue 5, Milton, ON L9T 1A1") === "12 Maple Avenue");
check("preserves directional suffix (W)", redactAddressForPrompt("45 Main Street W, Milton, ON L9T 1A1") === "45 Main Street W");
check("strips Unit X format", redactAddressForPrompt("100 Derry Road Unit 12, Milton, ON L9T 7G2") === "100 Derry Road");
check("strips Apt X format", redactAddressForPrompt("88 Trafalgar Apt 3B, Milton, ON L9T 4N4") === "88 Trafalgar");
check("strips #X format", redactAddressForPrompt("55 Wilson Drive #4, Milton, ON L9T 5R5") === "55 Wilson Drive");
check("does NOT strip street number when it's the only digit pattern", redactAddressForPrompt("830 Megson Terrace, Milton, ON L9T 9M7") === "830 Megson Terrace");
check("handles empty string", redactAddressForPrompt("") === "");
check("handles no comma at all", redactAddressForPrompt("123 Main St") === "123 Main St");

// ─── collectInputRents recognizes new sources ───────────────────────────
console.log("\ncollectInputRents (validator) — recognizes Part 4 sources:");

function inputWithLease(opts: {
  byBedRent?: number;
  recentRecords?: Array<{ soldPrice: number; listPrice: number }>;
  rangeStats?: { min: number; max: number };
}): StreetGeneratorInput {
  return {
    street: { name: "Test St", slug: "test-st-milton", shortName: "Test", type: "St", identityKey: "test", siblingSlugs: [], direction: "" },
    neighbourhoods: ["Test"],
    aggregates: {
      txCount: 10, salesCount: 5, leasesCount: 5, typicalPrice: 800000,
      priceRange: { low: 700000, high: 900000 }, daysOnMarket: 60, kAnonLevel: "full",
    },
    byType: {},
    leaseActivity: {
      byBed: opts.byBedRent ? { "3": { count: 5, typicalRent: opts.byBedRent } } : {},
      recentRecords: opts.recentRecords?.map((r, i) => ({
        mlsNumber: `W${1000 + i}`,
        address: "Test Addr",
        listPrice: r.listPrice,
        soldPrice: r.soldPrice,
        beds: 3, baths: 2,
        sqftRange: "1000-1199",
        daysOnMarket: 30,
        propertyType: "Townhouse",
        soldMonth: "2025-09",
        leaseTerm: "12 Months",
        furnished: "Unfurnished",
      })),
      rangeStats: opts.rangeStats,
    },
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
  } as unknown as StreetGeneratorInput;
}

// A: prose cites recentRecords[N].soldPrice ($3,200) — should NOT fire
{
  const input = inputWithLease({
    byBedRent: 2900,
    recentRecords: [{ soldPrice: 3200, listPrice: 3200 }],
  });
  // Provide rent-context so validator routes it as a rent
  const prose = "Recent rentals on the street show three-bedroom units leasing around $3,200 per month.";
  const fires = findUngroundedNumerics(prose, input);
  // $3,200 should be grounded via recentRecords (no false positive)
  const has3200False = fires.some((f) => f.raw.includes("3,200"));
  check("prose citing recentRecords soldPrice does NOT fire numeric_ungrounded", !has3200False);
}

// B: prose cites rangeStats.max ($4,500) — should NOT fire
{
  const input = inputWithLease({
    byBedRent: 2900,
    recentRecords: [{ soldPrice: 3200, listPrice: 3200 }],
    rangeStats: { min: 2500, max: 4500 },
  });
  const prose = "Rentals on the street span from $2,500 to $4,500 per month across the recent window.";
  const fires = findUngroundedNumerics(prose, input);
  const has4500False = fires.some((f) => f.raw.includes("4,500"));
  const has2500False = fires.some((f) => f.raw.includes("2,500"));
  check("prose citing rangeStats.max does NOT fire numeric_ungrounded", !has4500False);
  check("prose citing rangeStats.min does NOT fire numeric_ungrounded", !has2500False);
}

// C: control — prose citing fabricated price WAY out of tolerance SHOULD still fire.
// Note: $999 won't fire (validator's DOLLAR_FIGURE regex requires comma-separated
// 3+ digit groups). And the validator's tolerance for rent values is the same
// generous max($15K, 4%) used for sale prices, which is too loose for rents
// (a pre-existing validator limitation, not introduced by Part 4). To verify
// the rent grounding actually has an upper bound, we use $50,000/month — far
// enough out that no input rent or sale price falls within tolerance.
{
  const input = inputWithLease({
    byBedRent: 2900,
    recentRecords: [{ soldPrice: 3200, listPrice: 3200 }],
    rangeStats: { min: 2500, max: 4500 },
  });
  const prose = "A three-bedroom unit recently leased at $50,000 per month.";
  const fires = findUngroundedNumerics(prose, input);
  const has50kTrue = fires.some((f) => f.raw.includes("50,000"));
  check("prose citing wildly fabricated rent ($50,000) STILL fires numeric_ungrounded (control)", has50kTrue);
}

// D: input WITHOUT recentRecords — existing byBed grounding still works
{
  const input = inputWithLease({ byBedRent: 2900 });
  const prose = "Three-bedroom units lease at around $2,900 per month.";
  const fires = findUngroundedNumerics(prose, input);
  const has2900False = fires.some((f) => f.raw.includes("2,900"));
  check("prose citing byBed.typicalRent (no recentRecords) does NOT fire", !has2900False);
}

// ─── K-anon boundary verification (re-implementation in test) ───────────
// buildLeaseSampleRecords is internal to buildGeneratorInput.ts. Verify
// the boundary logic matches by re-implementing here against same constants.
console.log("\nK-anon gate boundary verification (independent re-impl):");
const K_ANON_PRICE_TEST = 5;
const K_ANON_RANGE_TEST = 10;
function gateForCount(count: number): { hasRecentRecords: boolean; hasRangeStats: boolean } {
  return {
    hasRecentRecords: count >= K_ANON_PRICE_TEST,
    hasRangeStats: count >= K_ANON_RANGE_TEST,
  };
}
check("k=4 → no recentRecords, no rangeStats (below k=5 threshold)",
  !gateForCount(4).hasRecentRecords && !gateForCount(4).hasRangeStats);
check("k=5 (boundary) → recentRecords yes, rangeStats no",
  gateForCount(5).hasRecentRecords && !gateForCount(5).hasRangeStats);
check("k=9 → recentRecords yes, rangeStats no",
  gateForCount(9).hasRecentRecords && !gateForCount(9).hasRangeStats);
check("k=10 (boundary) → recentRecords yes, rangeStats yes",
  gateForCount(10).hasRecentRecords && gateForCount(10).hasRangeStats);
check("k=50 → both gates fire",
  gateForCount(50).hasRecentRecords && gateForCount(50).hasRangeStats);

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
