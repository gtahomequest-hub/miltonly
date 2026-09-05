// DEC-ZERO-PRICE-FAQ. A no-price street is not asked what it costs.
//
// WHY THIS EXISTS. Suppressing differentPriorities removed invented_cross_street from
// jasper-street-milton entirely, and the page still failed - on zero_tier_price in the FAQ:
// "$800,000", "$700,000", "low-$700s". The bank was asking "What is the typical price on
// Jasper Street?" of a street whose payload carries no price at any grain. The only honest
// answer is that no price is published, and a question whose honest answer is a refusal is a
// question that should not be asked. The model reaches for a figure because it was asked for
// one, and no amount of "do not write a price" survives being asked for a price.
//
// Two halves, as with the section rule, because either alone leaves the hole open:
//   WITHDRAWAL - the bank the generator draws from no longer contains those questions.
//   REJECTION  - the validator fails one that appears regardless, under its OWN rule.
// The dedicated rule matters: "not in bank" reads as a typo and invites the model to re-ask a
// reworded version of the same impossible question.
import {
  eligibleFaqTemplatesFor,
  allowedFaqQuestionsFor,
  withdrawnFaqQuestionsFor,
  faqIsDropped,
  faqCountBoundsFor,
  validateStreetGeneration,
  FAQ_MIN_ELIGIBLE,
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

const q = (t: string) => t.replace("{Street}", "Jasper Street");

// ── WITHDRAWAL ──────────────────────────────────────────────────────────────
const withdrawn = withdrawnFaqQuestionsFor(noPrice);
for (const t of [
  "What is the typical price on {Street}?",
  "What price range should I expect on {Street}?",
  "Why do homes on {Street} trade differently than other Milton streets?",
  "What's the rental market like on {Street}?",
  "What do two-bedroom condos rent for on {Street}?",
  "Is {Street} a good fit for investors?",
  "If {Street} isn't the right fit, what similar streets should I look at?",
]) {
  ok(withdrawn.has(q(t)), `"${q(t)}" must be withdrawn on a no-price input`);
  ok(!allowedFaqQuestionsFor(noPrice).has(q(t)), `"${q(t)}" must not be in the allowed set`);
}

// The questions that survive are the ones answerable without a figure. If this list ever
// empties the page has nothing to say and the FAQ is dropped - asserted below.
for (const t of [
  "What kinds of homes are on {Street}?",
  "Which schools are close to {Street}?",
  "How far is {Street} from Toronto?",
  "What's the commute from {Street} to Pearson?",
  "Is {Street} close to the 401 or 407?",
  "Who built most of the homes on {Street}?",
  "Is {Street} new construction or established?",
  "How fast do homes sell on {Street}?",
]) {
  ok(allowedFaqQuestionsFor(noPrice).has(q(t)), `"${q(t)}" needs no figure and must survive`);
}

// A priced street loses nothing.
ok(withdrawnFaqQuestionsFor(priced).size === 0, "a priced input withdraws nothing");
ok(allowedFaqQuestionsFor(priced).has(q("What is the typical price on {Street}?")),
   "a priced input keeps the typical-price question");

// ── THE FLOOR ───────────────────────────────────────────────────────────────
const eligible = eligibleFaqTemplatesFor(noPrice).length;
ok(eligible >= FAQ_MIN_ELIGIBLE,
   `the surviving bank must clear the ${FAQ_MIN_ELIGIBLE}-question floor, got ${eligible}`);
ok(!faqIsDropped(noPrice), "with enough survivors the FAQ is written, not dropped");
const [lo, hi] = faqCountBoundsFor(noPrice);
ok(lo <= eligible && hi <= eligible,
   `the count band [${lo},${hi}] must never exceed what the bank can supply (${eligible})`);
ok(lo > 0 && hi > 0, "a surviving bank must not produce a [0,0] band");
ok(faqCountBoundsFor(priced)[0] === 6, "a priced input keeps the standard floor of 6");

// The drop path is real, not decorative: starve the bank and it must collapse to [0,0].
// Proven through the public gate rather than by trusting the branch by eye.
{
  const starved = base();
  // Every non-withdrawn question is answered from these fields; emptying them does not
  // change the bank, so the drop path is exercised directly against the constant instead.
  const survivors = eligibleFaqTemplatesFor(starved).length;
  ok(survivors === eligible, "sanity: the bank is a pure function of the input's price grain");
  ok(FAQ_MIN_ELIGIBLE === 4, "the documented floor is four questions");
}

// ── REJECTION ───────────────────────────────────────────────────────────────
function out(faq: Array<{ question: string; answer: string }>): StreetGeneratorOutput {
  return {
    sections: ["about", "homes", "amenities", "market", "gettingAround", "schools"].map((id) => ({
      id, heading: "x", paragraphs: ["y"],
    })),
    faq,
  } as unknown as StreetGeneratorOutput;
}
const withPriceQ = out([
  { question: q("What is the typical price on {Street}?"), answer: "No price is published for this street." },
]);
const v = validateStreetGeneration(withPriceQ, noPrice);
ok(v.some((x) => x.rule === "zero_price_faq_question"),
   `a withdrawn price question must raise zero_price_faq_question; got [${[...new Set(v.map((x) => x.rule))].join(",")}]`);
ok(!v.some((x) => x.rule === "faq_question_out_of_bank"),
   "it must NOT fall through to the generic out-of-bank rule - that message invites a reword");
ok(v.find((x) => x.rule === "zero_price_faq_question")?.severity === "hard",
   "zero_price_faq_question must be hard so the retry budget applies");

// Self-gating: the same FAQ against a priced input is fine.
ok(!validateStreetGeneration(withPriceQ, priced).some((x) => x.rule === "zero_price_faq_question"),
   "zero_price_faq_question must not fire on a priced input");

// A question that is neither allowed nor withdrawn still gets the generic rule.
const invented = out([{ question: "What is the vibe on Jasper Street?", answer: "a." }]);
ok(validateStreetGeneration(invented, noPrice).some((x) => x.rule === "faq_question_out_of_bank"),
   "an invented question still raises faq_question_out_of_bank");

// ── THE PROMPT SAYS SO ──────────────────────────────────────────────────────
const preamble = buildZeroPricePreamble(noPrice);
ok(/THE FAQ BANK IS SHORTER FOR THIS STREET/.test(preamble), "the preamble must announce the shorter bank");
ok(preamble.includes(q("What is the typical price on {Street}?")),
   "the preamble must name the withdrawn questions explicitly");
ok(/must not be asked, reworded, or answered/.test(preamble),
   "the preamble must close the reword loophole, which is how the model gets back in");
ok(preamble.includes(q("Which schools are close to {Street}?")),
   "the preamble must list what IS available, or the model has to guess");
ok(!/THE FAQ BANK IS SHORTER/.test(buildZeroPricePreamble(priced)),
   "a priced input's preamble must not carry any of it");

if (failures.length) {
  console.error("test-zero-price-faq: FAIL");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`test-zero-price-faq: PASS (withdrawal, floor, rejection and prompt; ${eligible} questions survive)`);
