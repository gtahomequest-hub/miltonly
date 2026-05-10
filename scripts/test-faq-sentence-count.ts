// Regression test for countSentences in src/lib/ai/trimFaqAnswers.ts.
//
// countSentences powers two production gates:
//   1. trimFaqAnswersToSentenceCap (compliance.ts) — deterministic clamp
//      of FAQ answers to the 2-4 sentence cap before validation.
//   2. validator faq_answer_length rule (validateStreetGeneration.ts:1384,
//      1653) — final hard-rule check.
//
// Both use the same `countSentences` import, so this test guards both at
// once. If the abbreviation handling under-masks, the validator wrongly
// counts initials as sentence boundaries (canary symptom: 2026-05-09
// Whitlock schools FAQ — "P.F. Reding" reported as 5 sentences when 2).
// If it over-masks, legitimate sentences get joined.
//
// Wired into prebuild via package.json so every Vercel/local build
// fails fast on regression.

import { countSentences } from "@/lib/ai/trimFaqAnswers";

interface Case { name: string; input: string; expected: number; }

const CASES: Case[] = [
  // ── Multi-initial proper nouns (the gap closed by this fix) ──────────
  { name: "two-letter initials preserved",       input: "E.W. Foster Park is great.",       expected: 1 },
  { name: "three-letter initials preserved",     input: "P.F.C. Building stands tall.",     expected: 1 },
  { name: "U.S. abbreviation still works",       input: "We visited the U.S. yesterday.",   expected: 1 },

  // ── Existing single-initial titles must NOT be over-swept ────────────
  { name: "Mr. title — single initial, no sweep", input: "Mr. Smith is here.",              expected: 1 },
  { name: "St. street prefix — no sweep",         input: "St. Paul's Avenue is busy.",      expected: 1 },

  // ── Original canary failure case (2026-05-09 Whitlock schools FAQ) ──
  {
    name: "schools FAQ canary — was 5, should be 2",
    input:
      "Public elementary catchment pulls toward E.W. Foster PS and W.I. Dick Middle School, " +
      "both about a five-minute drive, with Sam Sherratt and Robert Baldwin further out. " +
      "Catholic families draw to Guardian Angels and Our Lady of Fatima at the elementary level, " +
      "with St. Francis Xavier and Bishop P.F. Reding at secondary.",
    expected: 2,
  },

  // ── Sanity: simple multi-sentence text counts correctly ──────────────
  { name: "two simple sentences",                input: "Hello. Goodbye.",                  expected: 2 },
  { name: "three simple sentences",              input: "First. Second. Third.",            expected: 3 },

  // ── Mixed: abbreviations + real sentence boundaries ──────────────────
  {
    name: "U.S.A. mid-text + real boundary",
    input: "She lives in the U.S.A. now. Her job is great.",
    expected: 2,
  },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const c of CASES) {
  const actual = countSentences(c.input);
  if (actual === c.expected) {
    pass++;
  } else {
    fail++;
    failures.push(`  FAIL  ${c.name}\n          expected ${c.expected}, got ${actual}\n          input: ${JSON.stringify(c.input)}`);
  }
}

if (fail > 0) {
  console.error(`[faq-sentence-count] FAIL — ${fail}/${CASES.length} cases failed:`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`[faq-sentence-count] PASS — ${pass}/${CASES.length} cases`);
