// Smoke test for extractHighlights. Verifies:
//   1. W13120162 produces a non-empty bullet array + virtual tour URL.
//   2. An all-null input produces empty bullets + null URL.
//   3. Premium-feature allowlist is doing the gating (filters out generics).
//
// Pure-function test; no DB. The W13120162 input fixture is hand-copied from
// the recon-highlights.ts output of the same listing to keep this script
// hermetic — running it locally never hits the DB or network.
//
// Run: pnpm tsx scripts/test-highlights.ts

import { extractHighlights } from "../src/lib/listing-highlights";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

// 1. W13120162 — should produce rich output.
const W13120162 = {
  description:
    "Explore This Home In 3D-Click The Virtual Tour Link! Executive Fully Detached 4-Bedroom Home Showcasing Over $100,000 In Professional Upgrades And No Rental Items! This Meticulously Maintained 2,170 Sq. Ft. Residence Boasts 9-Foot Ceilings On Both The Main And Second Levels, Creating A Grand, Airy Atmosphere Throughout. A $6,000 Modern Steel Front Door, Rectangular Transom, And High-Security Multi-Point Hardware.",
  architecturalStyle: "2-Storey",
  approximateAge: "0-5",
  heatType: "Heat Pump",
  cooling: "Central Air",
  interiorFeatures: [
    "ERV/HRV",
    "Auto Garage Door Remote",
    "Built-In Oven",
    "On Demand Water Heater",
    "Sump Pump",
    "Water Heater Owned",
    "Water Softener",
  ],
  exteriorFeatures: [],
  fireplace: true,
  construction: "Brick",
  foundation: "Poured Concrete",
  virtualTourUrl: "https://winsold.com/matterport/embed/456908/GvamZwgSCaG",
};

const r1 = extractHighlights(W13120162);
console.log("\n=== W13120162 extracted ===");
for (const b of r1.bullets) console.log(`  • ${b}`);
console.log(`  virtualTourUrl = ${r1.virtualTourUrl}`);

assert(r1.bullets.length > 0, "W13120162 produces at least one bullet");
assert(r1.bullets.length <= 6, "W13120162 respects MAX_BULLETS cap");
assert(r1.virtualTourUrl === W13120162.virtualTourUrl, "W13120162 surfaces virtualTourUrl");
assert(
  r1.bullets.some((b) => /\$100,000/.test(b)),
  "W13120162 surfaces the $100,000 dollar claim",
);
assert(
  r1.bullets.some((b) => /^Listed with|^Seller notes/.test(b)),
  "Dollar bullets carry attribution prefix",
);
assert(
  r1.bullets.some((b) => /9-foot ceilings/i.test(b)),
  "W13120162 surfaces the 9-foot ceiling bullet",
);
assert(
  r1.bullets.some((b) => /heat pump heating/i.test(b)),
  "Heat Pump heatType produces a heating bullet",
);
assert(
  !r1.bullets.some((b) => /auto garage door remote/i.test(b)),
  "Generic interiorFeature 'Auto Garage Door Remote' is filtered out by allowlist",
);
assert(
  !r1.bullets.some((b) => /2,170\s?sq/i.test(b)),
  "Description sqft is skipped (mismatches structured field)",
);
assert(
  !r1.bullets.some((b) => /4[-\s]bedroom/i.test(b)),
  "Description bedroom-count is skipped",
);

// 2. Empty input — card must hide.
const r2 = extractHighlights({
  description: null,
  architecturalStyle: null,
  approximateAge: null,
  heatType: null,
  cooling: null,
  interiorFeatures: [],
  exteriorFeatures: [],
  fireplace: false,
  construction: null,
  foundation: null,
  virtualTourUrl: null,
});
console.log("\n=== Empty input ===");
console.log(`  bullets.length = ${r2.bullets.length}`);
console.log(`  virtualTourUrl = ${r2.virtualTourUrl}`);
assert(r2.bullets.length === 0, "Empty input → zero bullets");
assert(r2.virtualTourUrl === null, "Empty input → null virtualTourUrl");

// 3. Generic-only structured input — allowlist filters everything.
const r3 = extractHighlights({
  description: null,
  architecturalStyle: "Bungalow",
  approximateAge: "31-50",
  heatType: "Forced Air",
  cooling: "Central Air",
  interiorFeatures: ["Auto Garage Door Remote", "Carpet"],
  exteriorFeatures: ["Patio"],
  fireplace: false,
  construction: "Vinyl Siding",
  foundation: "Concrete Block",
  virtualTourUrl: null,
});
console.log("\n=== Generic-only structured input ===");
console.log(`  bullets.length = ${r3.bullets.length}`);
for (const b of r3.bullets) console.log(`  • ${b}`);
assert(
  r3.bullets.length === 0,
  "Generic-only structured input → zero bullets (age 31-50 excluded, all features non-premium)",
);
assert(r3.virtualTourUrl === null, "Generic-only input → null virtualTourUrl");

// 4. Mid-age (6-15) should produce the "5 to 15 years new" bullet.
const r4 = extractHighlights({
  description: null,
  architecturalStyle: "2-Storey",
  approximateAge: "11-15",
  heatType: null,
  cooling: null,
  interiorFeatures: [],
  exteriorFeatures: [],
  fireplace: true,
  construction: null,
  foundation: null,
  virtualTourUrl: null,
});
assert(
  r4.bullets.some((b) => /5 to 15 years new/i.test(b)),
  "Age 11-15 surfaces 5-to-15-years bullet",
);
assert(
  r4.bullets.some((b) => /fireplace/i.test(b)),
  "Fireplace true surfaces as a bullet",
);

console.log("\n✓ All assertions passed.");
