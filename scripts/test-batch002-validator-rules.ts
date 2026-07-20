// scripts/test-batch002-validator-rules.ts
// Regression cases for the batch-002 fix wave (2026-07-20):
//   physical_detail_ungrounded, spatial_precision_claim, "serve the area"
//   catchment equivalent, "versus" mixed-pool gap. Fire-cases quote batch-002
//   verbatim. Run: npx tsx --tsconfig tsconfig.test.json scripts/test-batch002-validator-rules.ts

import type { StreetGeneratorInput } from "../src/types/street-generator";
import {
  findUngroundedPhysicalDetails,
  findSpatialPrecisionClaims,
  findMixedPoolClaims,
  validateSectionsSubset,
} from "../src/lib/ai/validateStreetGeneration";
import { findCatchmentVocabulary } from "../src/lib/ai/catchmentVocabulary";

let passed = 0, failed = 0;
function check(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  [PASS] ${label}`); }
  else { failed++; console.log(`  [FAIL] ${label}`); }
}

const input: StreetGeneratorInput = {
  street: { name: "Testwood Crescent", slug: "testwood-crescent-milton", shortName: "Testwood Cres", type: "crescent", identityKey: "testwood-crescent-milton|", siblingSlugs: ["testwood-crescent-milton"], direction: "" },
  neighbourhoods: ["Willmott"],
  aggregates: { salesCount: 6, leasesCount: 6, typicalPrice: 800_000, priceRange: { low: 700_000, high: 900_000 }, daysOnMarket: 30, kAnonLevel: "full" },
  byType: {},
  nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
  commute: {
    toTorontoDowntown: { method: "GO+TTC (drive to GO)", minutes: 70 },
    toMississauga: { method: "drive", minutes: 22 }, toOakville: { method: "drive", minutes: 24 },
    toBurlington: { method: "drive", minutes: 20 }, toPearson: { method: "drive", minutes: 32 },
  },
  activeListingsCount: 1,
  crossStreets: [],
};

console.log("=== physical_detail_ungrounded ===");
check("frontage feet fires", findUngroundedPhysicalDetails("Lot sizes are generous, with frontages typically ranging from 40 to 50 feet.", input).length > 0);
check("built-in-era fires", findUngroundedPhysicalDetails("The homes were built in the early 2000s.", input).length > 0);
check("two-phase construction fires", findUngroundedPhysicalDetails("The street's housing stock was built in two phases.", input).length > 0);
check("sqft range fires", findUngroundedPhysicalDetails("Floor plans range from 1,500 to 2,500 square feet.", input).length > 0);
check("interior finish fires", findUngroundedPhysicalDetails("The master suite occupies the entire second-floor front, with hardwood throughout.", input).length > 0);
check("exterior material fires", findUngroundedPhysicalDetails("Brick and vinyl exteriors with stone accents and gabled roofs.", input).length > 0);
check("grounded type-mix prose does not fire", findUngroundedPhysicalDetails("Townhouses dominate the street, accounting for most recent sales, with a handful of semis at the edges.", input).length === 0);
check("lotSize field present suppresses dimension patterns", findUngroundedPhysicalDetails("Frontages typically run 40 feet.", { ...input, lotSize: { typical: "40 ft", range: "36-45 ft" } }).length === 0);
check("era fires even with lotSize present", findUngroundedPhysicalDetails("Built in the early 2000s.", { ...input, lotSize: { typical: "40 ft", range: "36-45 ft" } }).length > 0);
check("eraOnly mode ignores finishes", findUngroundedPhysicalDetails("Hardwood floors and quartz counters.", input, { eraOnly: true }).length === 0);

console.log("=== spatial_precision_claim ===");
check("right on the street itself fires", findSpatialPrecisionClaims("Chris Hadfield PS is right on Borden Lane itself, a zero-minute walk.").length > 0);
check("directly adjacent school fires", findSpatialPrecisionClaims("St. Scholastica Catholic Elementary School is directly adjacent to the street.").length > 0);
check("both directly on the street fires", findSpatialPrecisionClaims("E.W. Foster Public School and W.I. Dick Middle School, both directly on the street.").length > 0);
check("park steps-from fires", findSpatialPrecisionClaims("Ford District Park is steps from Hamman Way.").length > 0);
check("plain distance claim does not fire", findSpatialPrecisionClaims("The school is a five-minute walk from the crescent.").length === 0);
check("under a minute's walk does not fire", findSpatialPrecisionClaims("The school is under a minute's walk away.").length === 0);
check("non-entity sentence does not fire", findSpatialPrecisionClaims("The porch sits steps from the driveway.").length === 0);

console.log("=== catchment 'serve the area' equivalent ===");
check("schools serve the area fires", findCatchmentVocabulary("Several public schools serve the area, including Chris Hadfield PS.") !== null);
check("worship serve the area does not fire", findCatchmentVocabulary("Several places of worship serve the area.") === null);

console.log("=== mixed-pool 'versus' gap ===");
check("leases versus sales fires", findMixedPoolClaims("Lease activity outpaces sales, with 24 leases versus 11 sales in recent records.").length > 0);
check("vs. form fires", findMixedPoolClaims("11 sales vs. 24 leases over the window.").length > 0);
check("separate pool sentences do not fire", findMixedPoolClaims("The street recorded 11 sales. Rentals were active, with 24 leases.").length === 0);

console.log("=== wiring: homes section fail-closed ===");
{
  const v = validateSectionsSubset(
    [{ id: "homes", heading: "The homes here", paragraphs: [
      "Townhouses dominate the street, built in the early 2000s, with frontages typically ranging from 40 to 50 feet and hardwood flooring throughout the open-concept main levels of most units across the full length of the crescent and its quiet corners.",
    ] }],
    ["homes"], input,
  );
  check("homes section fires physical_detail_ungrounded", v.some(x => x.rule === "physical_detail_ungrounded"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
