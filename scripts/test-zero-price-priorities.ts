// DEC-ZERO-PRICE-PRIORITIES. differentPriorities is written only when there is something to
// compare against, and the validator rejects it when there is not.
//
// WHY, and WHY THE GATE MOVED. The section compares this street to others BY PRICE, sourced
// from input.crossStreets. The first version of this rule keyed on the street being priceless,
// on the stated grounds that its comparators would be priceless too. That was simply false:
// jasper-street-milton's own snapshot holds Maple Avenue at $693,000 and Wilson Drive at
// $718,000. A street with no price of its own can write this section perfectly well by citing
// named comparators, and the first gate suppressed exactly that case.
//
// What actually makes the section unwritable is having fewer than two priced comparators -
// nothing to compare against - so that is the gate now, and it is independent of what this
// street costs. A fully priced street with one comparator is suppressed too.
//
// Two halves, because either alone leaves the hole open:
//   SUPPRESSION - the generator does not ask for the section, and says so in the prompt.
//   REJECTION   - the validator fails one that appears regardless.
// A generator that stops asking is not a guarantee; a model can still volunteer it.
import {
  dropsDifferentPriorities,
  expectedOrderFor,
  expectedSectionCountFor,
  allowedFaqQuestionsFor,
  validateStreetGeneration,
  pricedCrossStreetCount,
  MIN_PRICED_CROSS_STREETS,
  COMPARISON_FAQ_TEMPLATE,
} from "../src/lib/ai/validateStreetGeneration";
import { buildSectionSuppressionPreamble } from "../src/lib/ai/compliance";
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

const comparators = (n: number) =>
  [
    { slug: "maple-avenue-milton", name: "Maple Avenue", distinctivePattern: "x", typicalPrice: 693_000 },
    { slug: "wilson-drive-milton", name: "Wilson Drive", distinctivePattern: "x", typicalPrice: 718_000 },
  ].slice(0, n) as StreetGeneratorInput["crossStreets"];

// No comparator carries a price: unwritable whatever this street costs.
const noComparators = base();
// One priced comparator is not enough to compare against.
const oneComparator = base();
oneComparator.crossStreets = comparators(1);
// Two: writable, even though this street has no price of its own. The case the first gate
// got wrong, and the reason the gate moved.
const twoComparators = base();
twoComparators.crossStreets = comparators(2);
// A fully priced street with only one comparator is suppressed too - the gate is not about
// this street's price.
const pricedOneComparator = base();
pricedOneComparator.aggregates.typicalPrice = 1_100_000;
pricedOneComparator.aggregates.kAnonLevel = "full";
pricedOneComparator.crossStreets = comparators(1);

// ── The gate ────────────────────────────────────────────────────────────────
ok(dropsDifferentPriorities(noComparators), "no priced comparators must drop the section");
ok(dropsDifferentPriorities(oneComparator), `${MIN_PRICED_CROSS_STREETS - 1} priced comparator is not enough`);
ok(!dropsDifferentPriorities(twoComparators),
   "two priced comparators must KEEP the section even when this street has no price of its own");
ok(dropsDifferentPriorities(pricedOneComparator),
   "a fully priced street with one comparator is suppressed too - the gate is the comparator set");
ok(pricedCrossStreetCount(twoComparators) === 2, "pricedCrossStreetCount counts comparators carrying a figure");
ok(pricedCrossStreetCount(noComparators) === 0, "and returns 0 on an empty comparator set");

// A comparator present but carrying no figure does not count.
const zeroPricedComparator = base();
zeroPricedComparator.crossStreets = [
  { slug: "a-milton", name: "A Street", distinctivePattern: "x", typicalPrice: 0 },
  { slug: "b-milton", name: "B Street", distinctivePattern: "x", typicalPrice: 0 },
] as StreetGeneratorInput["crossStreets"];
ok(dropsDifferentPriorities(zeroPricedComparator),
   "two comparators carrying no figure are not two priced comparators");

// ── SUPPRESSION: the layout the generator asks for ──────────────────────────
// Fully determined by the input now - one expected count, not a pair. It used to be inferred
// from the OUTPUT's own length, which let a wrong shape select the order that excused it.
ok(expectedSectionCountFor(noComparators) === 6,
   `no comparators and no comparable -> 6, got ${expectedSectionCountFor(noComparators)}`);
ok(expectedSectionCountFor(twoComparators) === 7,
   `two comparators, no comparable -> 7, got ${expectedSectionCountFor(twoComparators)}`);

const suppressed = expectedOrderFor(noComparators);
ok(!suppressed.includes("differentPriorities"), "the suppressed order must not contain the section");
ok(suppressed[suppressed.length - 1] === "schools",
   `the suppressed order must end at schools, got [${suppressed.join(",")}]`);
ok(expectedOrderFor(twoComparators).includes("differentPriorities"),
   "two priced comparators must put the section back in the order");

// The comparison FAQ arm follows the section, not this street's price.
const comparison = COMPARISON_FAQ_TEMPLATE.replace("{Street}", "Jasper Street");
ok(!allowedFaqQuestionsFor(noComparators).has(comparison),
   "the comparison question must leave the bank when the section is suppressed");
ok(allowedFaqQuestionsFor(twoComparators).has(comparison),
   "and must return when two priced comparators exist, even on a street with no price");

// The prompt says so, for EVERY input that needs it - not only zero-price ones. The validator
// enforces the layout on every street, so a priced street with one comparator has to be told,
// or it is rejected for a shape it was never asked for.
const preamble = buildSectionSuppressionPreamble(noComparators);
ok(/DO NOT WRITE A "differentPriorities" SECTION/.test(preamble),
   "the preamble must tell the model not to write the section");
ok(/one section fewer/.test(preamble), "the preamble must say the output is one section shorter");
ok(/DO NOT WRITE A "differentPriorities" SECTION/.test(buildSectionSuppressionPreamble(pricedOneComparator)),
   "a fully priced street must get the instruction too, not just zero-price ones");
ok(!/DO NOT WRITE A "differentPriorities" SECTION/.test(buildSectionSuppressionPreamble(twoComparators)),
   "an input that supports the section must not carry the suppression text");

// ── REJECTION: the validator fails one that shows up anyway ─────────────────
function out(ids: string[]): StreetGeneratorOutput {
  return {
    sections: ids.map((id) => ({ id, heading: "x", paragraphs: ["y"] })),
    faq: [],
  } as unknown as StreetGeneratorOutput;
}
const withDp = out(["about", "homes", "amenities", "market", "gettingAround", "schools", "differentPriorities"]);
const v = validateStreetGeneration(withDp, noComparators);
ok(v.some((x) => x.rule === "zero_price_priorities"),
   `a differentPriorities section with no priced comparators must raise zero_price_priorities; got [${[...new Set(v.map((x) => x.rule))].join(",")}]`);
ok(v.find((x) => x.rule === "zero_price_priorities")?.severity === "hard",
   "zero_price_priorities must be hard so the retry budget applies");
ok(!validateStreetGeneration(withDp, twoComparators).some((x) => x.rule === "zero_price_priorities"),
   "it must not fire when two priced comparators exist");

if (failures.length) {
  console.error("test-zero-price-priorities: FAIL");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("test-zero-price-priorities: PASS (comparator gate, layout, suppression, rejection)");
