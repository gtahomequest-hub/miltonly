// src/lib/ai/trimFaqAnswers.ts
//
// Sentence-level FAQ answer trimming for Phase 4.1 generation. Used by
// generatePhase41StreetContent to deterministically clamp FAQ answers to
// the validator's 2-to-4 sentence cap, removing the recurring
// faq_answer_length retry-feedback loop where the model can't reliably
// count its own sentences.
//
// SENTENCE BOUNDARIES NOW COME FROM @/lib/prose/sentences — the single shared splitter. The
// abbreviation-masking logic that used to live here (and its 2026-05-09 multi-initial canary fix)
// moved there intact and was merged with the street-side splitter. countSentences and
// splitSentences are re-exported so existing importers keep working unchanged.

import type { StreetFAQItem } from "@/types/street-generator";
import { splitSentences, countSentences, maskedSegments, _internal } from "@/lib/prose/sentences";

export { splitSentences, countSentences };

const { unmask } = _internal;

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
    // Each match captures a sentence body + its terminator + optional trailing
    // whitespace. The number of matches equals the sentence count from
    // countSentences for any well-formed input.
    const matches = maskedSegments(item.answer);
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