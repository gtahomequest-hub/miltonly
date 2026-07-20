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
  findComparatorNeighbourhoodClaims,
  findUngroundedBuilderName,
  validateSectionsSubset,
  validateFaq,
  validateStreetGeneration,
} from "../src/lib/ai/validateStreetGeneration";
import { rankComparatorCandidates } from "../src/lib/ai/buildGeneratorInput";

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

console.log("=== rankComparatorCandidates (batch-002: smallest delta above minimum spread) ===");
{
  // Subject $800K; min spread = max($75K, 10%) = $80K.
  const cands = [
    { slug: "same-tier", price: 830_000 },      // delta 30K < spread -> excluded
    { slug: "step-up", price: 950_000 },        // delta 150K -> qualifies
    { slug: "town-extreme", price: 1_800_000 }, // delta 1M -> qualifies but ranks LAST
    { slug: "step-down", price: 650_000 },      // delta 150K -> qualifies
  ];
  const ranked = rankComparatorCandidates(800_000, cands);
  check("below-spread candidate excluded", !ranked.some(r => r.slug === "same-tier"));
  check("town extreme no longer wins", !ranked.some(r => r.slug === "town-extreme"));
  check("nearest meaningfully-different picks win",
    ranked.length === 2 && ranked.every(r => ["step-up", "step-down"].includes(r.slug)));
  check("empty when nothing clears the spread",
    rankComparatorCandidates(800_000, [{ slug: "x", price: 810_000 }]).length === 0);
}

console.log("=== findComparatorNeighbourhoodClaims ===");
{
  const csNoNbhd = [{ slug: "wettlaufer-terrace-milton", shortName: "Wettlaufer Terr", distinctivePattern: "d", typicalPrice: 1_800_000 }];
  const csWithNbhd = [{ ...csNoNbhd[0], neighbourhood: "Bronte Meadows" }];
  const subjNbhds = ["Willmott"];

  check("no-data comparator + neighbourhood mention fires (fail closed)",
    findComparatorNeighbourhoodClaims("Elsewhere in Willmott, Wettlaufer Terr offers detached homes.", csNoNbhd, subjNbhds).length > 0);
  check("mismatched neighbourhood fires",
    findComparatorNeighbourhoodClaims("Wettlaufer Terr sits in Timberlea at a higher price point.", csWithNbhd, subjNbhds).length > 0);
  check("matching data neighbourhood passes",
    findComparatorNeighbourhoodClaims("In Bronte Meadows, Wettlaufer Terr trades around $1.8M.", csWithNbhd, subjNbhds).length === 0);
  check("generic same-neighbourhood without data fires",
    findComparatorNeighbourhoodClaims("Wettlaufer Terr keeps you in the same neighbourhood.", csNoNbhd, subjNbhds).length > 0);
  check("generic same-neighbourhood with mismatched data fires",
    findComparatorNeighbourhoodClaims("Both Wettlaufer Terr and the subject sit in the same neighbourhood.", csWithNbhd, subjNbhds).length > 0);
  check("generic same-neighbourhood grounded passes",
    findComparatorNeighbourhoodClaims("Wettlaufer Terr stays in the same neighbourhood.", csWithNbhd, ["Bronte Meadows"]).length === 0);
  check("bare base-name mention is caught",
    findComparatorNeighbourhoodClaims("Consider Wettlaufer for detached homes in Coates.", csWithNbhd, subjNbhds).length > 0);
  check("neighbourhood word as a STREET name does not fire",
    findComparatorNeighbourhoodClaims("Wettlaufer Terr trades differently than Scott Boulevard.", csWithNbhd, subjNbhds).length === 0);
  check("no comparator in sentence never fires",
    findComparatorNeighbourhoodClaims("The subject street sits in Willmott near the park.", csWithNbhd, subjNbhds).length === 0);
  check("price-only comparator sentence passes without location wording",
    findComparatorNeighbourhoodClaims("Wettlaufer Terr offers detached homes around $1.8M, a step up in price.", csNoNbhd, subjNbhds).length === 0);

  // Pairwise attribution (regen 2026-07-20 false-positive fix): two
  // comparators in one sentence, each with its own CORRECT neighbourhood.
  const twoCs = [
    { slug: "thimbleweed-court-milton", shortName: "Thimbleweed Crt", distinctivePattern: "d", typicalPrice: 950_000, neighbourhood: "Walker" },
    { slug: "baverstock-crescent-milton", shortName: "Baverstock Cres", distinctivePattern: "d", typicalPrice: 760_000, neighbourhood: "Clarke" },
  ];
  check("two grounded comparators in one sentence pass (pairwise, not cross-product)",
    findComparatorNeighbourhoodClaims(
      "Buyers exploring comparable options might consider Thimbleweed in Walker for townhouses trading around $950,000, or Baverstock in Clarke for townhouses around $760,000.",
      twoCs, subjNbhds).length === 0);
  check("two comparators with SWAPPED neighbourhoods still fire",
    findComparatorNeighbourhoodClaims(
      "Consider Thimbleweed in Clarke for townhouses, or Baverstock in Walker for a lower price point.",
      twoCs, subjNbhds).length > 0);
  check("leading neighbourhood with no preceding comparator falls back to fail-closed",
    findComparatorNeighbourhoodClaims(
      "In Timberlea, Thimbleweed Crt trades around $950,000.",
      twoCs, subjNbhds).length > 0);

  // Substring-collision regression (cedar-hedge, regen 2026-07-20): a
  // comparator short-named "Clark" must NOT count as mentioned inside the
  // word "Clarke" (the subject's own neighbourhood).
  const clarkCs = [{ slug: "clark-boulevard-milton", shortName: "Clark", distinctivePattern: "d", typicalPrice: 950_000, neighbourhood: "Beaty" }];
  check("'Clark' comparator does not fire on the subject's 'Clarke' neighbourhood prose",
    findComparatorNeighbourhoodClaims(
      "Cedar Hedge Road runs through the Clarke neighbourhood in Milton's north end.",
      clarkCs, ["Clarke"]).length === 0);
  check("real 'Clark' mention with wrong neighbourhood still fires",
    findComparatorNeighbourhoodClaims(
      "Clark offers detached homes in Clarke at a similar price point.",
      clarkCs, ["Clarke"]).length > 0);

  // Subject-own neighbourhood as comparison context (holdsworth FP,
  // 2026-07-20): grounded comparator + reference to the SUBJECT's area is
  // legitimate; a PLACEMENT of the comparator into the subject's area is not.
  const lancasterCs = [
    { slug: "lancaster-boulevard-milton", shortName: "Lancaster Blvd", distinctivePattern: "d", typicalPrice: 1_050_000, neighbourhood: "Beaty" },
    { slug: "laurier-avenue-milton", shortName: "Laurier Ave", distinctivePattern: "d", typicalPrice: 1_050_000, neighbourhood: "Timberlea" },
  ];
  check("subject-own neighbourhood as comparison context passes",
    findComparatorNeighbourhoodClaims(
      "Lancaster in Beaty offers detached homes trading around $1.05M, a slightly lower price point than the Coates area's typical detached home.",
      lancasterCs, ["Coates"]).length === 0);
  check("two grounded comparators vs subject-area comparison passes",
    findComparatorNeighbourhoodClaims(
      "Lancaster in Beaty and Laurier in Timberlea both offer detached homes trading around $1.05M, providing alternatives at a slightly lower price point than the Coates area.",
      lancasterCs, ["Coates"]).length === 0);
  check("PLACING a comparator in the subject's own neighbourhood still fires",
    findComparatorNeighbourhoodClaims(
      "Lancaster sits in Coates as well, with detached homes around $1.05M.",
      lancasterCs, ["Coates"]).length > 0);
}

console.log("=== comparator_neighbourhood_claim wiring ===");
{
  const inputWithNbhd: StreetGeneratorInput = {
    ...input,
    crossStreets: [{ slug: "wettlaufer-terrace-milton", shortName: "Wettlaufer Terr", distinctivePattern: "d", typicalPrice: 1_800_000, neighbourhood: "Bronte Meadows" }],
  };
  const viaSections = validateSectionsSubset(
    [{ id: "differentPriorities", heading: "If different priorities matter more", paragraphs: [
      "For buyers seeking detached homes in Willmott, Wettlaufer Terr trades around $1.8M, a clear step up from the subject street. The alternative suits those prioritizing lot size and interior space over entry price, and the tradeoff reads plainly in the numbers across recent activity.",
    ] }],
    ["differentPriorities"],
    inputWithNbhd,
  );
  check("mismatched claim fires through validateSectionsSubset", viaSections.some(v => v.rule === "comparator_neighbourhood_claim"));

  const cleanFaq = Array.from({ length: 6 }, (_, i) => ({
    question: ["What is the typical price on Testwood Crescent?",
      "How fast do homes sell on Testwood Crescent?",
      "What kinds of homes are on Testwood Crescent?",
      "Which schools are close to Testwood Crescent?",
      "How far is Testwood Crescent from Toronto?",
      "If Testwood Crescent isn't the right fit, what similar streets should I look at?"][i],
    answer: "The answer is factual and short; it stays inside the rounding rules.",
  }));
  const faqBad = [...cleanFaq.slice(0, 5), {
    question: "If Testwood Crescent isn't the right fit, what similar streets should I look at?",
    answer: "Consider Wettlaufer Terr for detached homes; both are in Willmott with similar access.",
  }];
  check("mismatched claim fires through validateFaq", validateFaq(faqBad, inputWithNbhd).some(v => v.rule === "comparator_neighbourhood_claim"));
  const faqGood = [...cleanFaq.slice(0, 5), {
    question: "If Testwood Crescent isn't the right fit, what similar streets should I look at?",
    answer: "Consider Wettlaufer Terr, in Bronte Meadows, for detached homes around $1.8M.",
  }];
  check("grounded claim passes through validateFaq", !validateFaq(faqGood, inputWithNbhd).some(v => v.rule === "comparator_neighbourhood_claim"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
