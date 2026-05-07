// src/lib/ai/trimFaqAnswers.ts
//
// Sentence-level FAQ answer trimming for Phase 4.1 generation. Used by
// generatePhase41StreetContent to deterministically clamp FAQ answers to
// the validator's 2-to-4 sentence cap, removing the recurring
// faq_answer_length retry-feedback loop where the model can't reliably
// count its own sentences.
//
// Sentence boundary detection uses a hardcoded inspectable abbreviation
// list plus a decimal-number rule. Both this module's countSentences and
// the validator's faq-length check rely on the same logic, so the trim
// will not produce output the validator subsequently flags.

import type { StreetFAQItem } from "@/types/street-generator";

// Abbreviations whose trailing period is not a sentence terminator.
// Matched case-insensitively at a word boundary, immediately followed by `.`.
const ABBREVS = [
  "St", "Mr", "Mrs", "Ms", "Dr", "Mt",
  "Ave", "Blvd", "Pkwy", "Rd", "Ln", "Cres", "Crt",
  "N", "S", "E", "W", "NE", "NW", "SE", "SW",
  "etc", "Jr", "Sr", "vs", "Inc", "Co", "Ltd",
];

// Sentinel character used to temporarily replace abbreviation/decimal
// periods so they don't get treated as sentence terminators during the
// split. A Private-Use Area codepoint that should never appear in
// real-world Milton prose.
const SENTINEL = String.fromCharCode(0xE000);

// Multi-period abbreviations need their own patterns since each internal
// period must be masked, not just the trailing one.
const MULTI_PERIOD_ABBREVS: Array<[RegExp, string]> = [
  [/\be\.g\./gi, `e${SENTINEL}g${SENTINEL}`],
  [/\bi\.e\./gi, `i${SENTINEL}e${SENTINEL}`],
  [/\bU\.S\./g, `U${SENTINEL}S${SENTINEL}`],
];

function maskAbbreviations(text: string): string {
  let masked = text;
  for (const [re, repl] of MULTI_PERIOD_ABBREVS) {
    masked = masked.replace(re, repl);
  }
  for (const ab of ABBREVS) {
    const re = new RegExp(`\\b${ab}\\.`, "gi");
    masked = masked.replace(re, (match) => match.slice(0, -1) + SENTINEL);
  }
  // Decimal numbers like 1.2, $1.2, 3.14 — masks the period between digits.
  masked = masked.replace(/(\d)\.(\d)/g, `$1${SENTINEL}$2`);
  return masked;
}

function unmask(text: string): string {
  return text.split(SENTINEL).join(".");
}

/**
 * Count sentences in a piece of text. Uses the same masking logic as the
 * trim function, so the count this returns is the same count the trim is
 * targeting. Imported by the validator for FAQ-length checks.
 *
 * A sentence ends in . ! or ?. Whitespace-only and empty parts are dropped.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const masked = maskAbbreviations(trimmed);
  const parts = masked.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  return parts.length;
}

/**
 * Trim each FAQ answer that exceeds maxSentences down to maxSentences,
 * preserving abbreviations and decimal numbers verbatim. Returns a new
 * array; the input is not mutated.
 *
 * Logs each trim event to console so smoke runs surface what was clipped.
 */
export function trimFaqAnswersToSentenceCap(
  faq: StreetFAQItem[],
  maxSentences = 4,
): StreetFAQItem[] {
  return faq.map((item) => {
    const masked = maskAbbreviations(item.answer);
    // Each match captures a sentence body + its terminator + optional trailing
    // whitespace. The number of matches equals the sentence count from
    // countSentences for any well-formed input.
    const matches = masked.match(/[^.!?]+[.!?]+(?:\s+|$)?/g) || [];
    if (matches.length <= maxSentences) return item;

    const kept = matches.slice(0, maxSentences).join("");
    const trimmed = unmask(kept).trimEnd();

    console.log(
      `[trimFaq] Trimmed answer for question "${item.question.slice(0, 40)}..." ` +
      `from ${matches.length} to ${maxSentences} sentences`,
    );

    return { question: item.question, answer: trimmed };
  });
}
