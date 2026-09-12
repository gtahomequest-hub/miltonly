// src/lib/ai/evalPromptShape.ts
//
// THE EVALUATIVE PROMPT, SHAPED TO THE INPUT. MC-005 (2026-09-11).
//
// WHAT WENT WRONG. On a thin-data street, dropsDifferentPriorities(input) is true, the validator
// expects two evaluative sections, and the generator told the model so with one paragraph
// prepended to the prompt: "DO NOT WRITE A differentPriorities SECTION". Underneath that
// paragraph the prompt itself went on saying the opposite eleven times: "the THREE EVALUATIVE
// SECTIONS", "exactly THREE sections in this order", a 40-line specification of the section, a
// word target that included it, the JSON schema's id union, the FAQ bank's comparison question,
// and the self-check's "exactly three entries ... differentPriorities". A model following the
// schema and the checklist wrote three sections, the validator counted two, and every attempt
// was spent the same way. On the first batch of the creation programme (2026-09-10, 23 streets,
// every one of them this shape) 11 of the 18 failures were exactly "sections length = 3,
// expected 2", through all five attempts, with the retry feedback restating the preamble.
//
// THE FIX. The instruction and the prompt now agree, because the prompt is rewritten before it
// is sent: every statement, count, schema line, specification and checklist item that names the
// section is removed or renumbered when the input cannot support it. Nothing is added that a
// full-data street would see: for an input that keeps the section, the prompt is returned
// byte-identical. scripts/test-eval-prompt-shape.ts asserts both halves on fixtures.
//
// It is a pure function of the loaded prompt text and the input so it can be tested without a
// database and so the doc stays the single authored source; this module owns no prose of its
// own beyond the one notice below.
import type { StreetGeneratorInput } from "@/types/street-generator";
import { dropsDifferentPriorities, inputHasNoPriceAtAnyGrain, OWN_PRICE_FAQ_TEMPLATES } from "./validateStreetGeneration";

const DP_NOTICE =
  "**`differentPriorities` is NOT written for this street.** Fewer than two of its comparison " +
  "streets carry a price, so there is nothing to compare by price. Do not write it, do not fold " +
  "its content into another section, and return one section fewer.\n\n";

/** Word ranges the specification states for the dropped section; subtracted from the totals. */
const DP_WORDS_MIN = 95;
const DP_WORDS_MAX = 135;

function must(text: string, from: string | RegExp, to: string | ((...m: string[]) => string), label: string): string {
  const next = typeof to === "string" ? text.replace(from, to) : text.replace(from, to);
  if (next === text) throw new Error(`evalPromptShape: the prompt no longer contains ${label}; shape it again against the doc`);
  return next;
}

export function shapeEvaluativePrompt(prompt: string, input: StreetGeneratorInput): string {
  const dropSection = dropsDifferentPriorities(input);
  const dropPriceFaq = inputHasNoPriceAtAnyGrain(input);
  if (!dropSection && !dropPriceFaq) return prompt;
  // The doc is checked out with CRLF on Windows and LF on Vercel; the patterns below are written
  // for LF, so the shaped prompt is LF either way. The unshaped path above returns the bytes as read.
  let p = prompt.replace(/\r\n/g, "\n");

  // THE FAQ BANK, ON A STREET WITH NO PRICE AT ANY GRAIN. The zero-price preamble already lists
  // the withdrawn questions; the bank underneath still offered them, and its selection rule still
  // said "PRICE cluster: always include one or two". 7 of the 18 first-batch failures carried
  // zero_price_faq_question beside the shape fault. The withdrawn lines leave the bank, and the
  // three clusters that only ask for a figure (or a lease count no such street has) are marked withdrawn where the rule stood.
  if (dropPriceFaq) {
    for (const t of OWN_PRICE_FAQ_TEMPLATES) {
      const line = `- "${t}"\n`;
      if (p.includes(line)) p = p.split(line).join("");
    }
    p = must(p, "- PRICE cluster: always include one or two.", "- PRICE cluster: WITHDRAWN for this street. No price is published, so include none.", "the price-cluster rule");
    p = must(p, /^- RENTAL cluster: [^\n]*$/m, "- RENTAL cluster: WITHDRAWN for this street. Include none.", "the rental-cluster rule");
    p = must(p, /^- LEASE COUNT cluster: [^\n]*$/m, "- LEASE COUNT cluster: WITHDRAWN for this street. Include none.", "the lease-count-cluster rule");
  }
  if (!dropSection) return p;

  // 1. the opening statement of the job
  p = must(p,
    "the THREE EVALUATIVE SECTIONS plus the FAQ block for one Milton street: `gettingAround`, `schools`, `differentPriorities`, and the FAQ.",
    "the TWO EVALUATIVE SECTIONS plus the FAQ block for one Milton street: `gettingAround`, `schools`, and the FAQ.",
    "the opening statement");

  // 2. the leak list and the list rule
  p = must(p, /^- `differentPriorities`: [^\n]*\n/m, "", "the leak-list entry");
  p = must(p, " `differentPriorities` is a prose paragraph, not a bulleted list.", "", "the list rule");

  // 3. the count and the dual-direction rule
  p = must(p, "You will produce exactly THREE sections in this order", "You will produce exactly TWO sections in this order", "the section count");
  p = must(p, "`gettingAround`, `schools`, and `differentPriorities` sections", "`gettingAround` and `schools` sections", "the dual-direction rule");

  // 4. the specification block, replaced by the notice
  p = must(p, /\*\*`differentPriorities`\*\* \(1 paragraph prose[\s\S]*?(?=## Word target)/, DP_NOTICE, "the specification block");

  // 5. the word targets
  p = must(p, "## Word target for these three sections + FAQ", "## Word target for these two sections + FAQ", "the word-target heading");
  p = must(p, /The three sections together MUST sum to between (\d+) and (\d+) words/, (_m, lo, hi) =>
    `The two sections together MUST sum to between ${Number(lo) - DP_WORDS_MIN} and ${Number(hi) - DP_WORDS_MAX} words`, "the section word target");
  p = must(p, /Combined evaluative output \(sections \+ FAQ\): (\d+) to (\d+) words/, (_m, lo, hi) =>
    `Combined evaluative output (sections + FAQ): ${Number(lo) - DP_WORDS_MIN} to ${Number(hi) - DP_WORDS_MAX} words`, "the combined word target");
  p = must(p, / In `differentPriorities`, more characteristic detail when the qualitative form applies\./, "", "the running-short advice");

  p = must(p, "After the three sections, produce six to eight FAQ pairs", "After the two sections, produce six to eight FAQ pairs", "the FAQ lead-in");

  // 6. the FAQ bank's comparison question, and the rule that made it the closer
  p = must(p, /^- "If \{Street\} isn't the right fit, what similar streets should I look at\?"\n/m, "", "the comparison FAQ question");
  p = must(p, "- ROUTING cluster: always include one as the closer.", "- ROUTING cluster: WITHDRAWN for this street (its section is not written). Include none.", "the routing-cluster rule");

  // 7. the schema and its sentence
  p = must(p, 'id: "gettingAround" | "schools" | "differentPriorities";', 'id: "gettingAround" | "schools";', "the schema id union");
  p = must(p,
    "The `sections` array must contain exactly these three `id` values, in the order listed: `gettingAround`, `schools`, `differentPriorities`.",
    "The `sections` array must contain exactly these two `id` values, in the order listed: `gettingAround`, `schools`.",
    "the schema sentence");

  // 8. the self-check
  p = must(p, / Every street name in `differentPriorities` exists in [^\n]*? If `input\.crossStreets` is empty, NO street names appear in `differentPriorities` at all\./, "", "self-check item 5");
  p = must(p, "Total word count across these three sections plus FAQ falls between", "Total word count across these two sections plus FAQ falls between", "self-check item 7");
  p = must(p,
    "The `sections` array contains exactly three entries with the IDs `gettingAround`, `schools`, `differentPriorities` in that order.",
    "The `sections` array contains exactly two entries with the IDs `gettingAround`, `schools` in that order.",
    "self-check item 9");
  p = p.replace(/Total word count across these two sections plus FAQ falls between (\d+) and (\d+)/, (_m, lo, hi) =>
    `Total word count across these two sections plus FAQ falls between ${Number(lo) - DP_WORDS_MIN} and ${Number(hi) - DP_WORDS_MAX}`);

  // Nothing may still ask for the section. The notice is the one permitted mention.
  const mentions = p.split("differentPriorities").length - 1;
  if (mentions !== 1) throw new Error(`evalPromptShape: ${mentions} mentions of differentPriorities survive the shaping; expected the notice alone`);
  if (/\bTHREE\b|\bthree sections\b|three entries/.test(p)) throw new Error("evalPromptShape: a three-section statement survives the shaping");
  return p;
}
