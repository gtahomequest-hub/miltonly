// The neighbourhoodComparable section is written only when the input carries one, and the
// page layout is a function of the input rather than a guess from the output.
//
// WHY THIS EXISTS. MARKET_SECTION_IDS was unconditionally ["market", "neighbourhoodComparable"].
// jasper-street-milton's input carries no neighbourhood comparable at all, so the market half
// was asked, on every attempt, to describe a comparable that does not exist - and invented
// "$825,000" for it every time. That is why the half never converged, through two branches of
// fixes aimed at other sections entirely.
//
// The second half of this file guards something subtler. expectedOrderFor used to pick the
// canonical order by looking at the OUTPUT's own length: 8 meant the T2 layout, anything else
// meant legacy. A wrong shape therefore got to choose the order that excused it, and the
// validator would report a position mismatch instead of the missing or extra section. The
// layout is derived from the input now, so there is exactly one right answer and the error
// message names the real fault.
import {
  hasNeighbourhoodComparable,
  expectedOrderFor,
  expectedSectionCountFor,
  validateStreetGeneration,
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
    crossStreets: [
      { slug: "maple-avenue-milton", name: "Maple Avenue", distinctivePattern: "x", typicalPrice: 693_000 },
      { slug: "wilson-drive-milton", name: "Wilson Drive", distinctivePattern: "x", typicalPrice: 718_000 },
    ],
  } as StreetGeneratorInput;
}

const NC = {
  neighbourhood: "Old Milton", filterByPropertyType: "detached", filterByBedroomCount: null,
  fallbackApplied: "type-only" as const, sampleSize: 40, windowMonths: 12, mostRecentSoldAt: null,
  typicalSoldPrice: 1_050_000, priceRange: null, daysOnMarket: 88, priceChangeYoy: null,
  soldToAsk: null, kAnonLevel: "full" as const,
};

const noNc = base();
const withNc = base();
withNc.neighbourhoodComparable = { ...NC };

// CONTENT, NOT PRESENCE. A block carrying counts but no figure grounds nothing, and asking
// for the section on the strength of an empty container is the same fabrication one step
// removed.
const emptyNc = base();
emptyNc.neighbourhoodComparable = { ...NC, typicalSoldPrice: null, priceRange: null };

// ── The gate ────────────────────────────────────────────────────────────────
ok(!hasNeighbourhoodComparable(noNc), "no block at all -> section not requested");
ok(hasNeighbourhoodComparable(withNc), "a block with a typical -> section requested");
ok(!hasNeighbourhoodComparable(emptyNc), "a block with no figure grounds nothing and must not request it");

const rangeOnly = base();
rangeOnly.neighbourhoodComparable = { ...NC, typicalSoldPrice: null, priceRange: { low: 900_000, high: 1_200_000 } };
ok(hasNeighbourhoodComparable(rangeOnly), "a range alone is a figure and does request the section");

// ── The layout follows ──────────────────────────────────────────────────────
ok(!expectedOrderFor(noNc).includes("neighbourhoodComparable"),
   "the order must omit the section when the input carries no comparable");
ok(expectedOrderFor(withNc).includes("neighbourhoodComparable"),
   "and include it when the input does");
ok(expectedSectionCountFor(noNc) === 7, `no comparable, two comparators -> 7, got ${expectedSectionCountFor(noNc)}`);
ok(expectedSectionCountFor(withNc) === 8, `comparable + two comparators -> 8, got ${expectedSectionCountFor(withNc)}`);

// The order is a pure function of the input - one answer, not a menu. Under the old
// length-driven rule these two calls could not both be checked, because there was no single
// expected order to check against.
ok(expectedOrderFor(withNc)[4] === "neighbourhoodComparable",
   `the comparable sits at index 4, got [${expectedOrderFor(withNc).join(",")}]`);
ok(expectedOrderFor(noNc)[4] === "gettingAround",
   `without it, gettingAround moves up to index 4, got [${expectedOrderFor(noNc).join(",")}]`);

// ── The prompt says so ──────────────────────────────────────────────────────
const preamble = buildSectionSuppressionPreamble(noNc);
ok(/DO NOT WRITE A "neighbourhoodComparable" SECTION/.test(preamble),
   "the preamble must tell the model not to write the section");
ok(/fabrication about a real place/.test(preamble),
   "and must say why - the invented figure describes a neighbourhood that exists");
ok(buildSectionSuppressionPreamble(withNc) === "",
   "an input supporting the full layout must carry no suppression text at all");

// ── Rejection ───────────────────────────────────────────────────────────────
function out(ids: string[]): StreetGeneratorOutput {
  return { sections: ids.map((id) => ({ id, heading: "x", paragraphs: ["y"] })), faq: [] } as unknown as StreetGeneratorOutput;
}
const wrongly = out(["about", "homes", "amenities", "market", "neighbourhoodComparable", "gettingAround", "schools", "differentPriorities"]);
const v = validateStreetGeneration(wrongly, noNc);
const shape = v.filter((x) => x.rule === "invalid_json_shape");
ok(shape.some((x) => /neighbourhoodComparable" is present/.test(x.excerpt)),
   `a comparable section with no comparable must be named specifically; got [${shape.map((x) => x.excerpt.slice(0, 40)).join(" | ") || "nothing"}]`);
ok(!validateStreetGeneration(wrongly, withNc).some((x) => /neighbourhoodComparable" is present/.test(x.excerpt)),
   "and must not fire when the input does carry one");

// The specific reason must arrive even though the count is ALSO wrong - a wrong count is a
// true statement that explains nothing, and it used to return first and swallow the rest.
ok(shape.length >= 1 && shape[0].excerpt.includes("neighbourhoodComparable"),
   "the specific reason must come before the bare count mismatch");

if (failures.length) {
  console.error("test-market-section-shape: FAIL");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("test-market-section-shape: PASS (comparable gate, input-determined layout, rejection)");
