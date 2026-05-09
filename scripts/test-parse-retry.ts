// scripts/test-parse-retry.ts
//
// Unit tests for tryParseGenerationResponse helper (Path A Part 1).
// Verifies parse-retry behavior — Sonnet's 33% failure mode (prose-only
// responses, no JSON) is now converted to recoverable invalid_json_shape
// violations that trigger retry-with-feedback.
//
// Run: npx tsx scripts/test-parse-retry.ts
// Exits 0 if all tests pass, 1 if any fail.

import { tryParseGenerationResponse } from "@/lib/ai/compliance";

interface TestCase {
  name: string;
  input: string;
  expectsFaq: boolean;
  expectCandidate: boolean; // true if non-null candidate expected
  expectViolation: boolean;
  expectViolationExcerptContains?: string;
}

const TESTS: TestCase[] = [
  {
    name: "1. Valid JSON with sections + faq parses on first attempt",
    input: JSON.stringify({
      sections: [{ id: "market", heading: "The market right now", paragraphs: ["Sample prose."] }],
      faq: [{ question: "Q", answer: "A" }],
    }),
    expectsFaq: true,
    expectCandidate: true,
    expectViolation: false,
  },
  {
    name: "2. Prose-only response (Sonnet's 33% failure mode) triggers parse-retry",
    input: "I need to analyze this street's data carefully before producing structured output. The input shows 15 sales over the past year...",
    expectsFaq: false,
    expectCandidate: false,
    expectViolation: true,
    expectViolationExcerptContains: "I need to analyze",
  },
  {
    name: "3. Mixed prose preamble + JSON parses correctly via helper strip",
    input: 'Here is the JSON you requested:\n\n{"sections": [{"id": "market", "heading": "The market right now", "paragraphs": ["Sample."]}]}\n\nLet me know if you need adjustments.',
    expectsFaq: false,
    expectCandidate: true,
    expectViolation: false,
  },
  {
    name: "4. Empty response triggers parse-retry with empty marker",
    input: "",
    expectsFaq: false,
    expectCandidate: false,
    expectViolation: true,
    expectViolationExcerptContains: "(empty response)",
  },
  {
    name: "5. Valid JSON missing sections array → invalid_json_shape (sections check)",
    input: JSON.stringify({ faq: [{ question: "Q", answer: "A" }] }),
    expectsFaq: true,
    expectCandidate: false,
    expectViolation: true,
    expectViolationExcerptContains: "missing sections array",
  },
  {
    name: "6. Valid JSON missing faq when expectsFaq=true → invalid_json_shape (faq check)",
    input: JSON.stringify({
      sections: [{ id: "market", heading: "The market right now", paragraphs: ["Sample."] }],
    }),
    expectsFaq: true,
    expectCandidate: false,
    expectViolation: true,
    expectViolationExcerptContains: "missing faq array",
  },
  {
    name: "7. Valid JSON missing faq when expectsFaq=false → passes (faq optional)",
    input: JSON.stringify({
      sections: [{ id: "market", heading: "The market right now", paragraphs: ["Sample."] }],
    }),
    expectsFaq: false,
    expectCandidate: true,
    expectViolation: false,
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const t of TESTS) {
  const result = tryParseGenerationResponse(t.input, t.expectsFaq);
  const candidatePresent = result.candidate !== null;
  const violationPresent = result.violation !== null;

  let ok = candidatePresent === t.expectCandidate && violationPresent === t.expectViolation;
  let detail = `candidate=${candidatePresent} violation=${violationPresent}, expected candidate=${t.expectCandidate} violation=${t.expectViolation}`;

  if (ok && t.expectViolationExcerptContains && result.violation) {
    if (!result.violation.excerpt.toLowerCase().includes(t.expectViolationExcerptContains.toLowerCase())) {
      ok = false;
      detail = `excerpt "${result.violation.excerpt}" does not contain "${t.expectViolationExcerptContains}"`;
    }
  }

  if (ok) {
    passed++;
    console.log(`  ✓ ${t.name}`);
  } else {
    failed++;
    failures.push(`${t.name} — ${detail}`);
    console.log(`  ✗ ${t.name} — ${detail}`);
    if (result.violation) {
      console.log(`      violation: rule=${result.violation.rule}, excerpt="${result.violation.excerpt}"`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed (${TESTS.length} total)`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
