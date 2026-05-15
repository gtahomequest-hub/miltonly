// Smoke test for extractKeyFacts. 11 assertions covering clean feet data,
// sanity floor triggers, fireplace edge cases, formatting variants, and
// empty state. Plus one bonus assertion that the dev-mode console.warn
// fires when the sanity floor catches a meter-mis-entry pattern (pass
// criterion #8 of the commit spec).
//
// Run: pnpm tsx scripts/test-key-facts.ts

import { extractKeyFacts, type KeyFactsInput } from "../src/lib/listing-key-facts";

let passed = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`✗ FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
  passed++;
}

const FULL: KeyFactsInput = {
  mlsNumber: "W12345678",
  lotWidth: 36,
  lotDepth: 100,
  crossStreet: "Main St & First Ave",
  directionFaces: "West",
  construction: "Brick",
  roof: "Asphalt Shingle",
  foundation: "Poured Concrete",
  fireplace: true,
  taxAmount: 5200,
  taxYear: 2025,
};

// 1. Full populated listing (clean feet data) → 10 rows.
const r1 = extractKeyFacts(FULL);
console.log("\n=== Full populated input ===");
for (const f of r1) console.log(`  ${f.label.padEnd(16)} ${f.value}`);
assert(r1.length === 10, `1/11 full input → 10 rows (got ${r1.length})`);
assert(
  r1.some((f) => f.label === "Lot frontage" && f.value === "36 ft"),
  "1/11 lot frontage rendered as '36 ft' (no trailing decimal)",
);
assert(
  r1.some((f) => f.label === "Lot depth" && f.value === "100 ft"),
  "1/11 lot depth rendered as '100 ft'",
);

// 2. Sanity floor triggered (meter-mis-entry pattern from W13120162).
const r2 = extractKeyFacts({ ...FULL, lotWidth: 9.15, lotDepth: 27 });
assert(r2.length === 8, `2/11 floor-triggered input → 8 rows (got ${r2.length})`);
assert(
  !r2.some((f) => /^Lot /.test(f.label)),
  "2/11 floor-triggered: no Lot * rows emitted",
);

// 3. Sanity floor partial — lotWidth below floor, lotDepth above.
const r3 = extractKeyFacts({ ...FULL, lotWidth: 12, lotDepth: 100 });
assert(r3.length === 8, `3/11 partial floor (width<15, depth ok) → 8 rows`);
assert(
  !r3.some((f) => /^Lot /.test(f.label)),
  "3/11 partial floor: both Lot rows omitted (either trigger skips both)",
);

// 4. Listing with only lotWidth populated, lotDepth null → no lot rows.
const r4 = extractKeyFacts({ ...FULL, lotWidth: 36, lotDepth: null });
assert(
  !r4.some((f) => /^Lot /.test(f.label)),
  "4/11 partial data (lotDepth null) → no lot rows (need both)",
);

// 5. Fireplace = false → row absent.
const r5 = extractKeyFacts({ ...FULL, fireplace: false });
assert(
  !r5.some((f) => f.label === "Fireplace"),
  "5/11 fireplace=false → no Fireplace row",
);

// 6. Fireplace = true → 'Yes' rendered.
const r6 = extractKeyFacts({ ...FULL, fireplace: true });
assert(
  r6.some((f) => f.label === "Fireplace" && f.value === "Yes"),
  "6/11 fireplace=true → 'Yes' value",
);

// 7. Fireplace null/falsy treated same as false. (KeyFactsInput types
// fireplace as boolean — null at the DB level is never expected since the
// schema has @default(false). This guards against the TypeScript types
// being widened later.)
const r7 = extractKeyFacts({ ...FULL, fireplace: false });
assert(
  !r7.some((f) => f.label === "Fireplace"),
  "7/11 fireplace falsy → no Fireplace row",
);

// 8. All fields null → empty array (card hides).
const r8 = extractKeyFacts({
  mlsNumber: "",
  lotWidth: null,
  lotDepth: null,
  crossStreet: null,
  directionFaces: null,
  construction: null,
  roof: null,
  foundation: null,
  fireplace: false,
  taxAmount: null,
  taxYear: null,
});
assert(r8.length === 0, "8/11 all-null input → empty array");

// 9. Tax formatting: 4766 + 2025 → '$4,766/year (2025)'.
const r9 = extractKeyFacts({ ...FULL, taxAmount: 4766, taxYear: 2025 });
assert(
  r9.some((f) => f.label === "Property taxes" && f.value === "$4,766/year (2025)"),
  "9/11 tax formatting: 4766 + 2025 → '$4,766/year (2025)'",
);

// 10. Numeric formatting: lotWidth=50 → '50 ft' (no decimal).
const r10 = extractKeyFacts({ ...FULL, lotWidth: 50, lotDepth: 100 });
assert(
  r10.some((f) => f.label === "Lot frontage" && f.value === "50 ft"),
  "10/11 lotWidth=50 → '50 ft' (no trailing decimal)",
);

// 11. Numeric formatting: lotWidth=36.14 → '36.14 ft' (decimal preserved).
const r11 = extractKeyFacts({ ...FULL, lotWidth: 36.14, lotDepth: 98.59 });
assert(
  r11.some((f) => f.label === "Lot frontage" && f.value === "36.14 ft"),
  "11/11 lotWidth=36.14 → '36.14 ft' (decimal preserved)",
);
assert(
  r11.some((f) => f.label === "Lot depth" && f.value === "98.59 ft"),
  "11/11 lotDepth=98.59 → '98.59 ft' (decimal preserved)",
);

// Bonus — pass criterion #8: dev-mode console.warn fires when the sanity
// floor catches a meter-mis-entry. Capture warn output, set NODE_ENV to
// "development", run the floor-triggering case, restore environment.
const origWarn = console.warn;
const origEnv = process.env.NODE_ENV;
const warns: string[] = [];
console.warn = (...args: unknown[]) => warns.push(args.map(String).join(" "));
// process.env.NODE_ENV is typed readonly in some TS configs; cast to escape.
(process.env as Record<string, string | undefined>).NODE_ENV = "development";
try {
  extractKeyFacts({ ...FULL, mlsNumber: "W13120162", lotWidth: 9.15, lotDepth: 27 });
  assert(
    warns.some((w) => w.includes("Lot dimensions skipped for W13120162")),
    "BONUS dev-mode console.warn fires on floor trigger (pass criterion #8)",
  );
} finally {
  console.warn = origWarn;
  (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
}

// And the inverse: production-mode silence — no warn fires when the
// floor triggers, so paid-traffic logs stay clean.
const warns2: string[] = [];
console.warn = (...args: unknown[]) => warns2.push(args.map(String).join(" "));
(process.env as Record<string, string | undefined>).NODE_ENV = "production";
try {
  extractKeyFacts({ ...FULL, mlsNumber: "W13120162", lotWidth: 9.15, lotDepth: 27 });
  assert(warns2.length === 0, "BONUS production-mode: NO warn fires on floor trigger");
} finally {
  console.warn = origWarn;
  (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
}

// ── transactionType="For Lease" branch ─────────────────────────────────
// Lease keyFacts: taxes row omitted; furnished + pets + rentIncludes
// appended when their inputs are populated. Sale call sites do not pass
// the lease-only fields, so they remain undefined and the rows never emit.

// L1. Lease drops taxes row even when taxAmount is populated.
const lease1 = extractKeyFacts(FULL, "For Lease");
assert(
  !lease1.some((f) => f.label === "Property taxes"),
  "lease/1 transactionType=For Lease omits Property taxes row",
);

// L2. Furnished value populated → "Furnished" row rendered.
const lease2 = extractKeyFacts({ ...FULL, furnished: "Unfurnished" }, "For Lease");
assert(
  lease2.some((f) => f.label === "Furnished" && f.value === "Unfurnished"),
  "lease/2 furnished populated → 'Furnished' row with passthrough value",
);

// L3. petsAllowed 4-value mapping.
const PETS_CASES: Array<[string, string | null]> = [
  ["Yes", "Pets allowed"],
  ["Yes-with Restrictions", "Pets allowed (restrictions apply)"],
  ["Restricted", "Pets restricted"],
  ["No", null], // omitted entirely
];
for (const [raw, expected] of PETS_CASES) {
  const r = extractKeyFacts({ ...FULL, petsAllowed: raw }, "For Lease");
  const row = r.find((f) => f.label === "Pets");
  if (expected === null) {
    assert(row === undefined, `lease/3 petsAllowed="${raw}" → Pets row omitted`);
  } else {
    assert(row !== undefined && row.value === expected, `lease/3 petsAllowed="${raw}" → "${expected}"`);
  }
}

// L4. rentIncludes joined with comma-space.
const lease4 = extractKeyFacts(
  { ...FULL, rentIncludes: ["Central Air Conditioning", "Common Elements", "Heat", "Parking", "Water"] },
  "For Lease",
);
assert(
  lease4.some(
    (f) => f.label === "Included in rent" && f.value === "Central Air Conditioning, Common Elements, Heat, Parking, Water",
  ),
  "lease/4 rentIncludes joined with comma-space into 'Included in rent' row",
);

// L5. Empty rentIncludes → row omitted.
const lease5 = extractKeyFacts({ ...FULL, rentIncludes: [] }, "For Lease");
assert(
  !lease5.some((f) => f.label === "Included in rent"),
  "lease/5 empty rentIncludes → 'Included in rent' row omitted",
);

// L6. Sale variant explicitly ignores lease-only inputs even if passed.
const sale6 = extractKeyFacts(
  { ...FULL, furnished: "Furnished", petsAllowed: "Yes", rentIncludes: ["Heat"] },
  "For Sale",
);
assert(
  !sale6.some((f) => f.label === "Furnished" || f.label === "Pets" || f.label === "Included in rent"),
  "lease/6 sale variant ignores lease-only inputs (rows do not emit)",
);
assert(
  sale6.some((f) => f.label === "Property taxes"),
  "lease/6 sale variant keeps Property taxes row",
);

console.log(`\n✓ All ${passed} assertions passed.`);
