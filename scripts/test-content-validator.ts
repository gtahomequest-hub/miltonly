// The Content tier's validator guard. Prebuild test 20.
//
// WHY THIS EXISTS. Guides and Market Watch editions are template-authored, so
// their figures cannot drift — code puts them there. The one thing that CAN
// drift is the single optional generated paragraph each surface may carry, and
// nothing in src/lib/ai/validateStreetGeneration.ts can check it: every rule
// there takes `input: StreetGeneratorInput` and reads `.aggregates` / `.nearby`
// / `.primaryBuilder`, and SUPERLATIVE_PHRASES is module-private. So the four
// required rules are reimplemented against GroundedFigures, and this guard is
// what stops the reimplementation from being weaker than it looks.
//
// It asserts BOTH directions on every rule. A validator that only proves it
// fires is satisfied by one that fires on everything, which would drop every
// paragraph forever and look like a working gate.
import {
  validateContentProse,
  findUngroundedNumbers,
  findSuperlatives,
  findInventedEntities,
  findPriceWithoutInput,
  findPunctuation,
  extractProseNumerics,
  parseDollar,
} from "../src/lib/content/validateContentProse";
import type { GroundedFigures } from "../src/lib/content/groundedFigures";
import { hasNoDollarFigure, livingFigures, figuresForPrompt } from "../src/lib/content/groundedFigures";

const failures: string[] = [];
let assertions = 0;

function check(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(`  ${msg}`);
}

// ── fixtures ──────────────────────────────────────────────────────────────

const PRICED: GroundedFigures = {
  figures: [
    { key: "weekly.count", value: 40, label: "sales, week of 2026-08-31", source: "test", kind: "count" },
    { key: "weekly.median", value: 1_075_000, label: "typical sold price, week of 2026-08-31", source: "test", kind: "dollar" },
    { key: "weekly.dom", value: 21, label: "days on market, week of 2026-08-31", source: "test", kind: "days" },
    { key: "weekly.soldToAsk", value: 98.4, label: "sold to ask, week of 2026-08-31", source: "test", kind: "percent" },
    { key: "form.condo.median", value: null, label: "typical condo price, trailing 28 days", source: "test", kind: "dollar" },
  ],
  entities: ["Milton", "Old Milton", "Hawthorne Village"],
};

const PRICELESS: GroundedFigures = {
  figures: [
    { key: "weekly.count", value: 3, label: "sales, week of 2026-08-31", source: "test", kind: "count" },
    { key: "weekly.median", value: null, label: "typical sold price, week of 2026-08-31", source: "test", kind: "dollar" },
  ],
  entities: ["Milton"],
};

// ── the bundle helpers ────────────────────────────────────────────────────
{
  check(hasNoDollarFigure(PRICELESS), "hasNoDollarFigure true when every dollar figure is suppressed");
  check(!hasNoDollarFigure(PRICED), "hasNoDollarFigure false when a dollar figure survives");
  check(livingFigures(PRICED).length === 4, `livingFigures(PRICED) = ${livingFigures(PRICED).length}, want 4`);
  check(livingFigures(PRICELESS).length === 1, `livingFigures(PRICELESS) = ${livingFigures(PRICELESS).length}, want 1`);

  const prompt = figuresForPrompt(PRICED);
  check(prompt.includes("NOT AVAILABLE"), "a suppressed figure is STATED as suppressed in the prompt, not omitted");
  check(prompt.includes("Hawthorne Village"), "entities reach the prompt");
  check(
    figuresForPrompt({ figures: [], entities: [] }).includes("Do not name any place"),
    "an empty entity list forbids naming rather than permitting anything",
  );
}

// ── parseDollar, both magnitude forms ─────────────────────────────────────
{
  check(parseDollar("$1,075,000") === 1_075_000, `parseDollar("$1,075,000") = ${parseDollar("$1,075,000")}`);
  check(parseDollar("$1.05M") === 1_050_000, `parseDollar("$1.05M") = ${parseDollar("$1.05M")}`);
  check(parseDollar("$1.05 million") === 1_050_000, `parseDollar("$1.05 million") = ${parseDollar("$1.05 million")}`);
  check(parseDollar("$900 thousand") === 900_000, `parseDollar("$900 thousand") = ${parseDollar("$900 thousand")}`);
  check(parseDollar("$850K") === 850_000, `parseDollar("$850K") = ${parseDollar("$850K")}`);
  check(parseDollar("not a price") === null, "parseDollar declines prose");
}

// ── extraction does not double-count ──────────────────────────────────────
{
  const nums = extractProseNumerics("A typical sale closed at $1.05M, 98.4% of asking, in 21 days.");
  check(nums.filter((n) => n.kind === "dollar").length === 1, "one dollar token");
  check(nums.filter((n) => n.kind === "percent").length === 1, "one percent token");
  const plains = nums.filter((n) => n.kind === "plain");
  check(plains.length === 1 && plains[0].raw === "21", `plain tokens = ${plains.map((p) => p.raw).join(",")}, want just 21`);
}

// ── RULE 1 ungrounded_number ──────────────────────────────────────────────
{
  const good = "Forty sales closed in the week, with a typical price of $1,075,000 and 21 days on market.";
  check(findUngroundedNumbers(good, PRICED).length === 0, `grounded prose fired: ${JSON.stringify(findUngroundedNumbers(good, PRICED))}`);

  const rounded = "The typical price was about $1.08M.";
  check(findUngroundedNumbers(rounded, PRICED).length === 0, "a figure quoted within the 5k rounding grain passes");

  const drifted = "The typical price was about $1.2M.";
  check(findUngroundedNumbers(drifted, PRICED).length === 1, "a dollar figure outside tolerance fires");

  const invented = "There were 63 sales.";
  check(findUngroundedNumbers(invented, PRICED).length === 1, "an invented count fires");

  const fromLabel = "Figures cover the week of 2026-08-31.";
  check(findUngroundedNumbers(fromLabel, PRICED).length === 0, "numbers carried by a figure LABEL are quotable");

  const pct = "Homes sold at 98.4% of asking.";
  check(findUngroundedNumbers(pct, PRICED).length === 0, "a grounded percentage passes");
  const pctBad = "Homes sold at 101.2% of asking.";
  check(findUngroundedNumbers(pctBad, PRICED).length === 1, "an invented percentage fires");
  // Caught on the first real edition: the model wrote the sold-to-ask figure
  // without its % sign and a grounded number was reported as invented.
  const pctNoUnit = "Homes sold at 97.5 per cent of asking.";
  check(findUngroundedNumbers(pctNoUnit, PRICED).length === 1, "98.4 is the figure; 97.5 is not, unit or no unit");
  const pctNoUnitGood = "Homes sold at 98.4 per cent of asking.";
  check(findUngroundedNumbers(pctNoUnitGood, PRICED).length === 0, "a grounded percentage quoted WITHOUT its unit passes");
}

// ── RULE 2 superlative ────────────────────────────────────────────────────
{
  check(findSuperlatives("This is the best week of the year.", PRICED).length === 1, "superlative fires");
  check(findSuperlatives("Activity was steady through the week.", PRICED).length === 0, "neutral prose passes");
  // A grounded proper noun is a fact, not a claim. The street tier paid for
  // this lesson on "Brian Best Park" (QUEUE item 1) — 20 of 20 attempts
  // rejected for naming a real park.
  const masked: GroundedFigures = { ...PRICED, entities: [...PRICED.entities, "Brian Best Park"] };
  check(
    findSuperlatives("Sales clustered near Brian Best Park.", masked).length === 0,
    "a superlative inside a GROUNDED proper noun does not fire",
  );
  check(
    findSuperlatives("Sales clustered near Brian Best Park.", PRICED).length === 1,
    "the same words fire when the name is NOT grounded",
  );
}

// ── RULE 3 invented_entity ────────────────────────────────────────────────
{
  check(findInventedEntities("Activity was concentrated in Old Milton.", PRICED).length === 0, "a named entity passes");
  check(findInventedEntities("Activity was concentrated in Kelso Heights.", PRICED).length === 1, "an invented place fires");
  check(findInventedEntities("The week was quiet. Sales held steady.", PRICED).length === 0, "sentence-initial ordinary words pass");
  check(findInventedEntities("Sales in Beaty rose.", PRICED).length === 1, "a mid-sentence single-word invented place fires");
  // Documented blind spot, asserted so it cannot change silently.
  check(findInventedEntities("Beaty led the week.", PRICED).length === 0, "a sentence-INITIAL single-word invented place is a known miss");
  check(findInventedEntities("Detached homes led the week.", PRICED).length === 0, "a housing form is not an entity");
  check(findInventedEntities("Milton saw steady activity in Ontario.", PRICED).length === 0, "Milton and Ontario are always allowed");
}

// ── RULE 4 price_without_input ────────────────────────────────────────────
{
  check(findPriceWithoutInput("Three homes sold.", PRICELESS).length === 0, "no price, no prose price, no violation");
  check(findPriceWithoutInput("Three homes sold, typically near $900,000.", PRICELESS).length === 1, "a price fires when the input carries none");
  check(findPriceWithoutInput("Prices sat just over a million.", PRICELESS).length === 1, "a price stated in WORDS fires too");
  check(findPriceWithoutInput("The typical price was $1,075,000.", PRICED).length === 0, "the rule is silent when a price exists");
  check(findPriceWithoutInput("Prices sat just over a million.", PRICED).length === 0, "the word form is also silent when a price exists");
}

// ── RULE 5 punctuation ────────────────────────────────────────────────────
{
  check(findPunctuation("Sales rose — then fell.").length === 1, "em-dash fires");
  check(findPunctuation("Sales rose, then fell.").length === 0, "clean punctuation passes");
  check(findPunctuation("The range was 26–67 sales.").length === 0, "en-dash BETWEEN NUMERALS passes");
  check(findPunctuation("Sales rose – then fell.").length === 1, "en-dash outside a numeral pair fires");
  check(findPunctuation("Sales rose -- then fell.").length === 1, "double-hyphen surrogate fires");
}

// ── the whole gate ────────────────────────────────────────────────────────
{
  const clean = "Forty sales closed in the week of 2026-08-31, with a typical price of $1,075,000. Homes took 21 days to sell and closed at 98.4% of asking. Activity was spread across Old Milton and Hawthorne Village.";
  const r = validateContentProse(clean, PRICED);
  check(r.ok, `clean paragraph rejected: ${JSON.stringify(r.violations)}`);
  check(r.violations.length === 0, "clean paragraph has zero violations");

  const dirty = "Milton had its best week yet — 63 sales in Kelso Heights, typically $1.4M.";
  const d = validateContentProse(dirty, PRICED);
  check(!d.ok, "a paragraph failing four rules is rejected");
  const rules = new Set(d.violations.map((v) => v.rule));
  check(rules.has("superlative"), "superlative caught in the combined run");
  check(rules.has("invented_entity"), "invented_entity caught in the combined run");
  check(rules.has("ungrounded_number"), "ungrounded_number caught in the combined run");
  check(rules.has("punctuation"), "punctuation caught in the combined run");

  // The suppressed-figure case, end to end: the input's condo price is null,
  // so citing one is a fabrication even though OTHER dollar figures exist.
  const suppressed = "Condos typically sold for $640,000.";
  const s = validateContentProse(suppressed, PRICED);
  check(!s.ok, "a figure the input suppressed cannot be cited");
  check(
    s.violations.some((v) => v.rule === "ungrounded_number"),
    "the suppressed figure is reported as ungrounded",
  );
}

if (failures.length > 0) {
  console.error(`test-content-validator: ${failures.length} failure(s) of ${assertions} assertions`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`test-content-validator: PASS (${assertions} assertions)`);
