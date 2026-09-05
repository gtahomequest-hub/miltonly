// DEC-ZERO-PRICE-PRIORITIES. A no-price street writes no differentPriorities section, and
// the validator rejects one that appears anyway.
//
// WHY THIS EXISTS. differentPriorities places this street against others by price, sourced
// from input.crossStreets. A street with no price at any grain has comparators with no price
// either - every crossStreets[].typicalPrice is null - so the section asks the model to
// characterise streets it has been given no figures for. It does the only thing it can: it
// invents the figures, then invents the streets to hang them on.
//
// This is not a prompt-strength problem, and that was established by experiment rather than
// assumed. jasper-street-milton was run on 2026-09-05 with the explicit no-price preamble AND
// the Opus fallback: by attempt 3 every zero_tier_price was gone - the instruction worked -
// and what remained was invented_cross_street ("Dorset Park") and a sales-register leak. The
// section is impossible on this data, so it is not requested.
//
// Two halves, both asserted here because either alone leaves the hole open:
//   SUPPRESSION - the generator must not ask for the section or its FAQ arm.
//   REJECTION   - the validator must fail a section that appears regardless.
// A generator that stops asking is not a guarantee; a model can still volunteer it.
import {
  dropsDifferentPriorities,
  expectedOrderFor,
  validSectionCountsFor,
  allowedFaqQuestionsFor,
  validateStreetGeneration,
  COMPARISON_FAQ_TEMPLATE,
} from "../src/lib/ai/validateStreetGeneration";
import { buildZeroPricePreamble } from "../src/lib/ai/compliance";
import type { StreetGeneratorInput, StreetGeneratorOutput } from "../src/types/street-generator";

const failures: string[] = [];
const ok = (cond: boolean, msg: string) => { if (!cond) failures.push(msg); };

function base(): StreetGeneratorInput {
  return {
    street: { name: "Jasper Street", slug: "jasper-street-milton", type: "street", identityKey: "jasper|street", siblingSlugs: ["jasper-street-milton"], direction: "" },
    neighbourhoods: ["Old Milton"],
    aggregates: { salesCount: 1, leasesCount: 0, typicalPrice: null, priceRange: null, daysOnMarket: null, kAnonLevel: "thin" },
    byType: {},
    nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
    commute: {
      toTorontoDowntown: { method: "car", minutes: 60 },
      toMississauga: { method: "car", minutes: 30 },
      toOakville: { method: "car", minutes: 25 },
      toBurlington: { method: "car", minutes: 25 },
      toPearson: { method: "car", minutes: 35 },
    },
    activeListingsCount: 0,
    crossStreets: [],
  } as StreetGeneratorInput;
}

const noPrice = base();
const priced = base();
priced.aggregates.typicalPrice = 1_100_000;
priced.aggregates.kAnonLevel = "full";

// ── The gate ────────────────────────────────────────────────────────────────
ok(dropsDifferentPriorities(noPrice), "a no-price input must drop differentPriorities");
ok(!dropsDifferentPriorities(priced), "a priced input must KEEP differentPriorities");

// ── SUPPRESSION: the shapes the generator asks for ──────────────────────────
const [nMin, nMax] = validSectionCountsFor(noPrice);
ok(nMin === 6 && nMax === 7, `no-price counts must be 6 or 7, got ${nMin}/${nMax}`);
const [pMin, pMax] = validSectionCountsFor(priced);
ok(pMin === 7 && pMax === 8, `priced counts must be 7 or 8, got ${pMin}/${pMax}`);

const order6 = expectedOrderFor(noPrice, 6);
ok(!order6.includes("differentPriorities"), "the 6-section order must not contain differentPriorities");
ok(order6.length === 6 && order6[order6.length - 1] === "schools",
   `the 6-section order must end at schools, got [${order6.join(",")}]`);
const order7t2 = expectedOrderFor(noPrice, 7);
ok(!order7t2.includes("differentPriorities"), "the 7-section no-price order must not contain differentPriorities");
ok(order7t2.includes("neighbourhoodComparable"), "the 7-section no-price order is the T2 layout minus differentPriorities");
ok(expectedOrderFor(priced, 7).includes("differentPriorities"),
   "a priced 7-section page must still contain differentPriorities");

// The FAQ arm goes with it.
const noPriceFaq = allowedFaqQuestionsFor(noPrice);
const comparison = COMPARISON_FAQ_TEMPLATE.replace("{Street}", "Jasper Street");
ok(!noPriceFaq.has(comparison), "the comparison FAQ question must leave the bank on a no-price input");
ok(allowedFaqQuestionsFor(priced).has(comparison), "a priced input keeps the comparison FAQ question");
ok(noPriceFaq.size > 0 && noPriceFaq.has("How fast do homes sell on Jasper Street?"),
   "dropping one question must not empty or corrupt the bank");

// And the prompt says so, in the words the model reads.
const preamble = buildZeroPricePreamble(noPrice);
ok(/DO NOT WRITE A "differentPriorities" SECTION/.test(preamble),
   "the preamble must tell the model not to write the section");
ok(/one section fewer/.test(preamble), "the preamble must say the output is one section shorter");
ok(preamble.includes(comparison), "the preamble must name the FAQ question that is withdrawn");
ok(!/DO NOT WRITE A "differentPriorities" SECTION/.test(buildZeroPricePreamble(priced)),
   "a priced input's preamble must not carry the suppression text");

// ── REJECTION: the validator fails one that shows up anyway ─────────────────
function sectionsFor(ids: string[]) {
  return ids.map((id) => ({ id, heading: "x", paragraphs: ["y"] }));
}
const withDp: StreetGeneratorOutput = {
  sections: sectionsFor(["about", "homes", "amenities", "market", "gettingAround", "schools", "differentPriorities"]),
  faq: [],
} as unknown as StreetGeneratorOutput;
const v = validateStreetGeneration(withDp, noPrice);
ok(v.some((x) => x.rule === "zero_price_priorities"),
   `a differentPriorities section on a no-price input must raise zero_price_priorities; got [${[...new Set(v.map((x) => x.rule))].join(",")}]`);
ok(v.find((x) => x.rule === "zero_price_priorities")?.severity === "hard",
   "zero_price_priorities must be hard severity so the retry budget applies");

// The same output against a PRICED input must not raise it - the rule self-gates.
const vPriced = validateStreetGeneration(withDp, priced);
ok(!vPriced.some((x) => x.rule === "zero_price_priorities"),
   "zero_price_priorities must not fire on a priced input");

// A 7-section page is a VALID COUNT for a no-price T2 input, which is exactly why the
// presence check is separate from the length check - the count alone would let it through.
ok(validSectionCountsFor(noPrice).includes(7),
   "7 is a valid no-price count, so the presence check cannot be folded into the length check");

if (failures.length) {
  console.error("test-zero-price-priorities: FAIL");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("test-zero-price-priorities: PASS (19 assertions across suppression and rejection)");
