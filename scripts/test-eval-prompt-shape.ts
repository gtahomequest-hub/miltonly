// Prebuild case: the evaluative prompt says the same thing the suppression preamble says.
//
// MC-005 (2026-09-11). On a thin-data street the preamble said "do not write differentPriorities"
// and the prompt underneath said "exactly THREE sections ... differentPriorities" eleven times,
// including in the JSON schema and the self-check. DeepSeek followed the schema, the validator
// counted two, and 11 of the first batch's 18 failures were "sections length = 3, expected 2"
// through all five attempts. shapeEvaluativePrompt rewrites the prompt to the input before any
// preamble is prepended. This case reads the real doc and asserts, on fixtures:
//
//   · a street that keeps the section gets the doc back byte-identical
//   · a street that drops it gets a prompt with exactly one mention of the section (the notice),
//     no three-section statement, a two-id schema, a two-entry self-check, no comparison FAQ
//     question, the word targets reduced by the section's own range, and the routing rule withdrawn
//   · a street with no price at any grain gets the price, rental and investor questions out of
//     the bank and their cluster rules withdrawn
//   · the shaped prompt still carries the two sections it does want, their headings and the FAQ
//
// The assertions read the shaped text, not the shaper's internals, so a doc edit that moves a
// sentence the shaper anchors on fails here rather than in a cron at 03:00.
import { readFileSync } from "node:fs";
import { shapeEvaluativePrompt } from "../src/lib/ai/evalPromptShape";
import { OWN_PRICE_FAQ_TEMPLATES, COMPARISON_FAQ_TEMPLATE } from "../src/lib/ai/validateStreetGeneration";
import type { StreetGeneratorInput } from "../src/types/street-generator";

const failures: string[] = [];
let assertions = 0;
const ok = (cond: boolean, msg: string) => { assertions++; if (!cond) failures.push(msg); };

const doc = readFileSync("docs/phase-4.1/03-evaluative-prompt.md", "utf8");

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

// ── a priced street with two priced comparators keeps the doc byte for byte ──────────────────
const full = base();
full.aggregates = { salesCount: 12, leasesCount: 0, typicalPrice: 900_000, priceRange: { low: 800_000, high: 1_000_000 }, daysOnMarket: 14, kAnonLevel: "full" };
full.crossStreets = comparators(2);
ok(shapeEvaluativePrompt(doc, full) === doc, "full-data street: prompt returned byte-identical");

// ── a priced street with ONE priced comparator drops the section, keeps the price FAQ ────────
const oneComparator = base();
oneComparator.aggregates = { salesCount: 12, leasesCount: 0, typicalPrice: 900_000, priceRange: { low: 800_000, high: 1_000_000 }, daysOnMarket: 14, kAnonLevel: "full" };
oneComparator.crossStreets = comparators(1);
const shapedOne = shapeEvaluativePrompt(doc, oneComparator);
ok(shapedOne.split("differentPriorities").length - 1 === 1, "one comparator: exactly one mention of differentPriorities (the notice)");
ok(shapedOne.includes("is NOT written for this street"), "one comparator: the notice is present");
ok(!/\bTHREE\b|three sections|three entries/.test(shapedOne), "one comparator: no three-section statement survives");
ok(shapedOne.includes('id: "gettingAround" | "schools";'), "one comparator: the schema id union has two ids");
ok(shapedOne.includes("exactly two entries with the IDs `gettingAround`, `schools` in that order"), "one comparator: the self-check counts two");
ok(!shapedOne.includes(`- "${COMPARISON_FAQ_TEMPLATE}"`), "one comparator: the comparison FAQ question is out of the bank");
ok(shapedOne.includes("- ROUTING cluster: WITHDRAWN"), "one comparator: the routing rule is withdrawn");
ok(shapedOne.includes("MUST sum to between 190 and 270 words"), "one comparator: the section word target is reduced by the section's range");
ok(shapedOne.includes("Combined evaluative output (sections + FAQ): 490 to 720 words"), "one comparator: the combined word target is reduced");
ok(shapedOne.includes("- PRICE cluster: always include one or two."), "one comparator: a priced street keeps its price FAQ");
ok(shapedOne.includes("**`gettingAround`**") && shapedOne.includes("**`schools`**"), "one comparator: the two wanted sections keep their specifications");
ok(shapedOne.includes('Heading: "Schools nearby."'), "one comparator: the schools heading survives");
ok(shapedOne.includes("## FAQ") || /FAQ pairs/.test(shapedOne), "one comparator: the FAQ block survives");

// ── no price at any grain and no comparators: section and price FAQ both go ──────────────────
const zero = base();
const shapedZero = shapeEvaluativePrompt(doc, zero);
ok(shapedZero.split("differentPriorities").length - 1 === 1, "zero-price: exactly one mention of differentPriorities");
for (const t of OWN_PRICE_FAQ_TEMPLATES) ok(!shapedZero.includes(`- "${t}"\n`), `zero-price: withdrawn question is out of the bank: ${t}`);
ok(shapedZero.includes("- PRICE cluster: WITHDRAWN"), "zero-price: the price-cluster rule is withdrawn");
ok(shapedZero.includes("- RENTAL cluster: WITHDRAWN"), "zero-price: the rental-cluster rule is withdrawn");
ok(shapedZero.includes("- LEASE COUNT cluster: WITHDRAWN"), "zero-price: the lease-count-cluster rule is withdrawn");
ok(shapedZero.includes('- "Which schools are close to {Street}?"'), "zero-price: a question that needs no figure stays");
ok(shapedZero.includes('- "How far is {Street} from Toronto?"'), "zero-price: the commute questions stay");

if (failures.length > 0) {
  console.error(`[eval-prompt-shape] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[eval-prompt-shape] PASS: ${assertions} assertions; the shaped prompt agrees with the gate on three fixtures and the full-data prompt is untouched.`);
