// src/lib/ai/streetContentRenderFilter.ts
//
// Render-time compliance filter for generated street content (batch-001
// triage remediation, 2026-07-19). Applied inside loadStreetGeneration — the
// single choke point feeding the page renderer, the v2 mapper, and the
// JSON-LD schema — so every previously generated row is cleaned the moment it
// renders, at zero LLM cost, until the regen wave replaces it.
//
// Three removals:
//
// 1. FAIR HOUSING (triage B5): the "Who this street suits" (bestFitFor)
//    section and its FAQ twin characterize buyers/residents by household
//    shape; no compliant version exists. Section dropped whole; FAQ item
//    dropped whole.
//
// 2. CATCHMENT VOCABULARY (WS4 amendment, 2026-07-19): schools/catchments are
//    grounded-external only. School names + computed distances may render;
//    catchment/boundary/zoning/assignment claims may not, on any tier, until
//    HDSB/HCDSB boundary data is wired in. Sentences carrying the banned
//    vocabulary are scrubbed; FAQ items carrying it are dropped whole
//    (a catchment question's answer is definitionally a catchment claim);
//    the legacy "Schools and catchment" heading renders as "Schools nearby".
//
// 3. Empty shells: a paragraph that loses every sentence is dropped; a
//    section that loses every paragraph is dropped.
//
// Pure functions — unit-tested by scripts/test-render-filter.ts.

import type { StreetSection, StreetFAQItem } from "@/types/street-generator";
import { hasCatchmentVocabulary } from "@/lib/ai/catchmentVocabulary";
import { splitSentences } from "@/lib/ai/trimFaqAnswers";

// The bank question "Who is {Street} a good fit for?" — match on shape so
// every street's substitution is caught.
const WHO_SUITS_FAQ = /^who is .+ a good fit for\?$/i;

// Legacy heading-bank variant that carries the banned word. Renamed at
// render; the heading bank itself is updated for new generations.
const CATCHMENT_HEADING_REPLACEMENT = "Schools nearby";

function scrubParagraph(paragraph: string): string | null {
  if (!hasCatchmentVocabulary(paragraph)) return paragraph;
  const kept = splitSentences(paragraph).filter(
    (sentence) => !hasCatchmentVocabulary(sentence)
  );
  const joined = kept.join(" ").replace(/\s+/g, " ").trim();
  return joined.length > 0 ? joined : null;
}

/** Sections: drop bestFitFor; scrub catchment sentences everywhere; rename
 *  catchment headings; drop paragraphs/sections emptied by the scrub. */
export function filterStreetSectionsForRender(
  sections: StreetSection[]
): StreetSection[] {
  const out: StreetSection[] = [];
  for (const section of sections) {
    if (section.id === "bestFitFor") continue;

    const heading = hasCatchmentVocabulary(section.heading)
      ? CATCHMENT_HEADING_REPLACEMENT
      : section.heading;

    const paragraphs = section.paragraphs
      .map(scrubParagraph)
      .filter((p): p is string => p !== null);
    if (paragraphs.length === 0) continue;

    out.push({ id: section.id, heading, paragraphs });
  }
  return out;
}

/** FAQ: drop the who-suits item; drop any item whose question OR answer
 *  carries catchment vocabulary (partial scrubbing of an answer built on a
 *  catchment premise would leave a non-answer). */
export function filterStreetFaqForRender(
  faq: StreetFAQItem[]
): StreetFAQItem[] {
  return faq.filter((item) => {
    if (WHO_SUITS_FAQ.test(item.question.trim())) return false;
    if (hasCatchmentVocabulary(item.question)) return false;
    if (hasCatchmentVocabulary(item.answer)) return false;
    return true;
  });
}
