// Prebuild case: a grounded park name is not a neighbourhood claim about a comparator.
//
// MC-009 (2026-09-11). anne-boulevard-milton's input carries "Bronte Meadows Park" (a Town park)
// and the comparator "Bronte Street" (neighbourhood: Old Milton). Every faithful attempt named
// the park; comparator_neighbourhood_claim read "Bronte Meadows" beside "Bronte Street" as a
// placement claim and refused ten attempts across two runs, $0.0355 for nothing. The rule now
// runs on text with the input's nearby place names masked (maskNearbyPlaceNames), which leaves
// cross streets and neighbourhoods readable, so a real placement claim still fires.
import { findComparatorNeighbourhoodClaims, maskNearbyPlaceNames } from "../src/lib/ai/validateStreetGeneration";
import type { StreetGeneratorInput } from "../src/types/street-generator";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };

const input = {
  street: { name: "Anne Boulevard", slug: "anne-boulevard-milton", type: "boulevard", identityKey: "anne|boulevard", siblingSlugs: ["anne-boulevard-milton"], direction: "" },
  neighbourhoods: ["Old Milton"],
  aggregates: { salesCount: 6, leasesCount: 0, typicalPrice: 900_000, priceRange: null, daysOnMarket: 12, kAnonLevel: "full" },
  byType: {},
  nearby: {
    parks: [{ name: "Bronte Meadows Park", minutes: 5 }, { name: "David Thompson Park", minutes: 4 }],
    schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [],
  },
  commute: {
    toTorontoDowntown: { method: "car", minutes: 60 }, toMississauga: { method: "car", minutes: 30 },
    toOakville: { method: "car", minutes: 25 }, toBurlington: { method: "car", minutes: 25 }, toPearson: { method: "car", minutes: 35 },
  },
  activeListingsCount: 1,
  crossStreets: [
    { slug: "bronte-street-milton", name: "Bronte Street", distinctivePattern: "x", typicalPrice: 850_000, neighbourhood: "Old Milton" },
  ],
} as unknown as StreetGeneratorInput;

const cs = input.crossStreets;
const nb = input.neighbourhoods;

// the sentence that burned the budget: a park named, no placement claim
const park = "Bronte Street is a few minutes from David Thompson Park and Bronte Meadows Park, both walkable.";
ok(findComparatorNeighbourhoodClaims(park, cs, nb).length > 0, "control: unmasked, the park name fires the rule (the defect)");
ok(findComparatorNeighbourhoodClaims(maskNearbyPlaceNames(park, input), cs, nb).length === 0, "masked: a grounded park name is not a neighbourhood claim");

// a real placement claim survives the mask
const claim = "Bronte Street sits within Bronte Meadows, a few blocks over.";
ok(findComparatorNeighbourhoodClaims(maskNearbyPlaceNames(claim, input), cs, nb).length === 1, "masked: a real placement claim about the comparator still fires");

// the mask leaves the comparator and the neighbourhood readable
const masked = maskNearbyPlaceNames(park, input);
ok(masked.includes("Bronte Street"), "mask: the cross street is left readable");
ok(!masked.includes("Bronte Meadows Park"), "mask: the park name is gone");
ok(maskNearbyPlaceNames("Old Milton is quiet.", input) === "Old Milton is quiet.", "mask: a neighbourhood name is left alone");

if (failures.length > 0) {
  console.error(`[comparator-park-mask] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[comparator-park-mask] PASS: ${assertions} assertions; a grounded park name no longer reads as a comparator placement claim, and a real one still does.`);
