// scripts/test-batch001-validator-rules.ts
// Unit tests for the batch-001 remediation validator rules (2026-07-19):
//   - mixed_pool_claim  (sale + lease pools combined in one claim)
//   - adjacency_claim   (physical placement of comparison streets)
//   - catchment_vocabulary wiring in section + FAQ validators
//   - builder_without_high_confidence, absent-builder arm
//   - bestFitFor removal from canonical shape + FAQ bank
// Run: npx tsx --tsconfig tsconfig.test.json scripts/test-batch001-validator-rules.ts

import type { StreetGeneratorInput, StreetGeneratorOutput } from "../src/types/street-generator";
import {
  findMixedPoolClaims,
  findAdjacencyClaims,
  findUngroundedBuilderName,
  validateSectionsSubset,
  validateFaq,
  validateStreetGeneration,
} from "../src/lib/ai/validateStreetGeneration";

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  [PASS] ${label}`); }
  else { failed++; console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`); }
}

const input: StreetGeneratorInput = {
  street: {
    name: "Testwood Crescent", slug: "testwood-crescent-milton", shortName: "Testwood Cres",
    type: "crescent", identityKey: "testwood-crescent-milton|", siblingSlugs: ["testwood-crescent-milton"], direction: "",
  },
  neighbourhoods: ["Willmott"],
  aggregates: {
    salesCount: 6, leasesCount: 6, typicalPrice: 800_000,
    priceRange: { low: 700_000, high: 900_000 }, daysOnMarket: 30, kAnonLevel: "full",
  },
  byType: {},
  nearby: {
    parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [],
  },
  commute: {
    toTorontoDowntown: { method: "GO+TTC (drive to GO)", minutes: 70 },
    toMississauga: { method: "drive", minutes: 22 },
    toOakville: { method: "drive", minutes: 24 },
    toBurlington: { method: "drive", minutes: 20 },
    toPearson: { method: "drive", minutes: 32 },
  },
  activeListingsCount: 1,
  crossStreets: [
    { slug: "wettlaufer-terrace-milton", shortName: "Wettlaufer Terr", distinctivePattern: "Detached trading around $1.8M", typicalPrice: 1_800_000 },
  ],
};

console.log("=== findMixedPoolClaims ===");
// Verbatim-shape sentences from the batch-001 audit.
check("gross yield fires", findMixedPoolClaims("implying gross yields around 4.5%").length > 0);
check("cap rate fires", findMixedPoolClaims("the typical cap rate pattern here").length > 0);
check("lease-to-sale ratio fires", findMixedPoolClaims("the lease-to-sale ratio is elevated").length > 0);
check("total transactions fires", findMixedPoolClaims("the street recorded 11 total transactions").length > 0);
check("split between sales and leases fires", findMixedPoolClaims("11 transactions split between 5 sales and 6 leases").length > 0);
check("lease against sales fires", findMixedPoolClaims("one lease against three sales points toward an owner-occupied street").length > 0);
check("yields near X fires", findMixedPoolClaims("gross yields near 3.8% on four-bedroom units").length > 0);
check("clean pool-separated prose does not fire",
  findMixedPoolClaims("Three-bedroom townhomes rented around $3,000 per month. Sales clustered near $800,000.").length === 0);
check("non-financial 'yields a' does not fire",
  findMixedPoolClaims("the cul-de-sac layout yields a quiet rhythm").length === 0);

console.log("=== findAdjacencyClaims ===");
check("runs between fires", findAdjacencyClaims("It runs between Wettlaufer Terr and Apple Terrace.", input.crossStreets).length > 0);
check("connects to fires", findAdjacencyClaims("The street connects to Wettlaufer Terr at its north end.", input.crossStreets).length > 0);
check("cross-street label fires", findAdjacencyClaims("cross-street comparables like Wettlaufer Terr", input.crossStreets).length > 0);
check("comparison framing does not fire",
  findAdjacencyClaims("Elsewhere in Willmott, Wettlaufer Terr offers detached homes around $1.8M.", input.crossStreets).length === 0);
check("empty crossStreets never fires", findAdjacencyClaims("It runs between two quiet courts.", []).length === 0);
check("adjacency phrase without a comparison street does not fire",
  findAdjacencyClaims("The crescent connects to the arterial road network.", input.crossStreets).length === 0);

console.log("=== findUngroundedBuilderName (absent primaryBuilder) ===");
check("Mattamy with no primaryBuilder fires", findUngroundedBuilderName("The builder is Mattamy, whose confidence in this subdivision is high.", input) === "Mattamy");
check("clean prose does not fire", findUngroundedBuilderName("The homes share consistent rooflines and brick exteriors.", input) === null);
check("suppressed when primaryBuilder present",
  findUngroundedBuilderName("Built by Mattamy.", { ...input, primaryBuilder: { name: "Mattamy", confidence: "high" } }) === null);

console.log("=== validateSectionsSubset wiring ===");
{
  const catchSection = validateSectionsSubset(
    [{ id: "schools", heading: "Schools nearby", paragraphs: [
      "Public catchment falls to a nearby elementary school, drawing families from the western half of the street. Older students draw to the closest secondary school. The walk is short, the routes are direct, and the morning rhythm is calm across the full length of the crescent for households at every stage.",
    ] }],
    ["schools"],
    input,
  );
  check("catchment vocabulary in schools section fires", catchSection.some(v => v.rule === "catchment_vocabulary"));
}
{
  const mixed = validateSectionsSubset(
    [{ id: "market", heading: "The market right now", paragraphs: [
      "Against typical sale prices near $800,000, gross yields on three-bedroom units land in the 4% range. The street trades steadily through the year with sales clustering in a narrow band and buyers meeting sellers close to asking across the recent window of activity on the crescent.",
    ] }],
    ["market"],
    input,
  );
  check("mixed-pool claim in market section fires", mixed.some(v => v.rule === "mixed_pool_claim"));
}
{
  const adj = validateSectionsSubset(
    [{ id: "about", heading: "About Testwood Crescent", paragraphs: [
      "Testwood Crescent runs between Wettlaufer Terr and the park edge, framed by mature trees. The crescent sits inside Willmott with a short loop shape, consistent setbacks, and a built form that has settled comfortably into the surrounding grid over the years since construction finished across the pocket.",
    ] }],
    ["about"],
    input,
  );
  check("adjacency claim in about section fires", adj.some(v => v.rule === "adjacency_claim"));
}
{
  const legacyHeading = validateSectionsSubset(
    [{ id: "schools", heading: "Schools and catchment", paragraphs: [
      "The nearest public elementary is a short walk from the crescent, and the Catholic option sits a few minutes further by car. Secondary students have a direct route north. Families should confirm current school assignment directly with the boards before making any enrolment decisions this year.",
    ] }],
    ["schools"],
    input,
  );
  check("legacy 'Schools and catchment' heading now rejected", legacyHeading.some(v => v.rule === "heading_out_of_bank"));
  check("catchment word in the legacy heading also fires vocabulary rule", legacyHeading.some(v => v.rule === "catchment_vocabulary"));
}

console.log("=== validateFaq wiring ===");
{
  const faq = Array.from({ length: 6 }, (_, i) => ({
    question: ["What is the typical price on Testwood Crescent?",
      "How fast do homes sell on Testwood Crescent?",
      "What kinds of homes are on Testwood Crescent?",
      "Which schools are close to Testwood Crescent?",
      "How far is Testwood Crescent from Toronto?",
      "If Testwood Crescent isn't the right fit, what similar streets should I look at?"][i],
    answer: "The answer is factual and short; it stays inside the rounding rules.",
  }));
  check("clean bank questions pass", validateFaq(faq, input).every(v => v.rule !== "faq_question_out_of_bank"));

  const whoSuits = [...faq.slice(0, 5), { question: "Who is Testwood Crescent a good fit for?", answer: "Families." }];
  check("retired who-suits question now out of bank", validateFaq(whoSuits, input).some(v => v.rule === "faq_question_out_of_bank"));

  const capRate = [...faq.slice(0, 5), { question: "What's the typical cap rate pattern on Testwood Crescent?", answer: "Unavailable." }];
  const capViol = validateFaq(capRate, input);
  check("retired cap-rate question now out of bank", capViol.some(v => v.rule === "faq_question_out_of_bank"));
  check("cap-rate wording also fires mixed-pool", capViol.some(v => v.rule === "mixed_pool_claim"));

  const catchAns = [...faq.slice(0, 5), { question: "Which schools are close to Testwood Crescent?", answer: "The street is zoned for the nearest elementary school." }];
  check("catchment vocabulary in FAQ answer fires", validateFaq(catchAns, input).some(v => v.rule === "catchment_vocabulary"));
}

console.log("=== canonical shape (bestFitFor removed) ===");
{
  const mk = (ids: string[]): StreetGeneratorOutput => ({
    sections: ids.map((id) => ({ id: id as StreetGeneratorOutput["sections"][number]["id"], heading: "x", paragraphs: ["y"] })),
    faq: [],
  });
  const with8Legacy = validateStreetGeneration(mk(["about","homes","amenities","market","gettingAround","schools","bestFitFor","differentPriorities"]), input);
  check("legacy 8-section layout with bestFitFor now fails order check", with8Legacy.some(v => v.rule === "missing_section_id"));
  const with7 = validateStreetGeneration(mk(["about","homes","amenities","market","gettingAround","schools","differentPriorities"]), input);
  check("7-section layout passes the shape/order gate", !with7.some(v => v.rule === "invalid_json_shape" || v.rule === "missing_section_id"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
