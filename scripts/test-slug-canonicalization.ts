// scripts/test-slug-canonicalization.ts
//
// Unit tests for write-time slug canonicalization (R2 fix).
//
// generateStreetContent() in src/lib/generateStreet.ts now canonicalizes its
// streetSlug parameter via deriveIdentity().canonicalSlug at function entry,
// so all StreetGeneration / StreetContent writes use the full-word canonical
// suffix (court, boulevard, avenue, drive, trail, crescent, terrace, …).
//
// These tests pin the 7 abbreviation patterns called out in the audit, plus
// negative tests confirming already-canonical slugs pass through unchanged
// and that direction-collapse / numeric-base / unknown-suffix paths behave as
// expected.
//
// Run: npx tsx scripts/test-slug-canonicalization.ts
//
// Exits 0 if all tests pass, 1 if any fail.

import { deriveIdentity } from "@/lib/streetUtils";

interface TestCase {
  name: string;
  input: string;
  expected: string; // expected canonicalSlug
}

function canonicalize(slug: string): string {
  return deriveIdentity(slug)?.canonicalSlug ?? slug;
}

const TESTS: TestCase[] = [
  // --- The 7 abbreviation patterns the audit called out ---
  { name: "crt -> court", input: "aird-crt-milton", expected: "aird-court-milton" },
  { name: "blvd -> boulevard", input: "asleton-blvd-milton", expected: "asleton-boulevard-milton" },
  { name: "ave -> avenue", input: "etheridge-ave-milton", expected: "etheridge-avenue-milton" },
  { name: "dr -> drive", input: "field-dr-milton", expected: "field-drive-milton" },
  { name: "trl -> trail", input: "andrews-trl-milton", expected: "andrews-trail-milton" },
  { name: "cres -> crescent", input: "allan-cres-milton", expected: "allan-crescent-milton" },
  { name: "terr -> terrace", input: "auger-terr-milton", expected: "auger-terrace-milton" },

  // --- Pass-through: already-canonical inputs round-trip unchanged ---
  { name: "court pass-through", input: "aird-court-milton", expected: "aird-court-milton" },
  { name: "boulevard pass-through", input: "asleton-boulevard-milton", expected: "asleton-boulevard-milton" },
  { name: "avenue pass-through", input: "etheridge-avenue-milton", expected: "etheridge-avenue-milton" },
  { name: "drive pass-through", input: "field-drive-milton", expected: "field-drive-milton" },
  { name: "trail pass-through", input: "andrews-trail-milton", expected: "andrews-trail-milton" },
  { name: "crescent pass-through", input: "allan-crescent-milton", expected: "allan-crescent-milton" },
  { name: "terrace pass-through", input: "auger-terrace-milton", expected: "auger-terrace-milton" },

  // --- Multi-word base (legacy) + abbreviated suffix ---
  { name: "multi-word base + cres", input: "james-snow-cres-milton", expected: "james-snow-crescent-milton" },

  // --- Numeric-base rural side road preserves base, suffix canonicalized ---
  { name: "numeric base + rd -> road", input: "3-side-rd-milton", expected: "3-side-road-milton" },

  // --- Direction collapse — directional slugs canonicalize WITHOUT direction
  //     (per the existing identityKey design — main-st-e and main-st-w both
  //      route to a single canonical /streets/main-street-milton page with
  //      per-direction h2 sub-sections). This is intentional and the canonical
  //      slug for write-time is the direction-stripped form.
  { name: "direction-collapse: main-st-e -> main-street", input: "main-st-e-milton", expected: "main-street-milton" },
  { name: "direction-collapse: bronte-street-n -> bronte-street", input: "bronte-street-n-milton", expected: "bronte-street-milton" },

  // --- Unknown / non-suffix tokens fall through. The base captures everything
  //     up to the city suffix when no recognized street-suffix is present.
  { name: "unknown-suffix slug passes through", input: "moonseed-place-milton", expected: "moonseed-place-milton" },
];

function runTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  console.log("Running slug-canonicalization tests");
  console.log("=".repeat(70));
  for (const t of TESTS) {
    const got = canonicalize(t.input);
    const ok = got === t.expected;
    if (ok) {
      console.log(`[ok] ${t.name.padEnd(48)}  ${t.input} -> ${got}`);
      passed++;
    } else {
      console.log(`[FAIL] ${t.name.padEnd(46)}  ${t.input} -> ${got}  (expected ${t.expected})`);
      failed++;
    }
  }
  console.log("=".repeat(70));
  console.log(`SUMMARY: ${passed}/${TESTS.length} passed${failed > 0 ? `, ${failed} failed` : ""}`);
  return { passed, failed };
}

const { failed } = runTests();
process.exit(failed === 0 ? 0 : 1);
