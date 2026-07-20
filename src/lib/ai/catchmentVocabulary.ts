// src/lib/ai/catchmentVocabulary.ts
//
// WS4 locked decision (amended 2026-07-19, batch-001 remediation): schools and
// catchments are GROUNDED-EXTERNAL ONLY. School names and computed haversine
// distances may render (they are grounded input); catchment/boundary/assignment
// claims may not appear anywhere, on any tier (street, hub, condo), until
// Halton DSB / HCDSB boundary data is sourced and wired into the pipeline.
//
// This module is the single shared vocabulary ban used by:
//   - the render-time filter (streetContentRenderFilter.ts) that scrubs
//     already-published rows until the regen wave replaces them, and
//   - the hard validator rule ("catchment_vocabulary") in the street, hub,
//     and condo validators, which blocks new generations.
//
// The banned list is exactly the amendment's vocabulary plus school-scoped
// morphological twins observed verbatim in batch-001 output ("draw to
// Anne J. MacArthur", "school zone", "feeder"). "draws to" alone is common
// benign English, so it only fires with school context nearby.

const SCHOOL_CONTEXT =
  /\b(school|schools|elementary|secondary|catholic|public board|students?|kindergarten)\b/i;

interface BanPattern {
  re: RegExp;
  /** When true, only fires if SCHOOL_CONTEXT matches within the excerpt window. */
  schoolContextOnly?: boolean;
}

const BAN_PATTERNS: BanPattern[] = [
  { re: /\bcatchments?\b/gi },
  { re: /\bboundar(?:y|ies)\b/gi },
  { re: /\bzoned?\s+(?:for|to)\b/gi },
  { re: /\bdraws?\s+from\b/gi },
  { re: /\bdrawing\s+from\b/gi },
  { re: /\bfeeds?\s+into\b/gi },
  { re: /\bfeeding\s+into\b/gi },
  { re: /\bassigned\s+to\b/gi },
  { re: /\bschool\s+zones?\b/gi },
  { re: /\bfeeder\s+schools?\b/gi },
  { re: /\bdraws?\s+to\b/gi, schoolContextOnly: true },
  { re: /\bdrawing\s+to\b/gi, schoolContextOnly: true },
  // Batch-002 N5: "schools serve the area" is an assignment claim in school
  // context ("several public schools serve the area, including X" implies X's
  // service area covers the street). Non-school usage ("places of worship
  // serve the area") stays legal via the context gate.
  { re: /\bserv(?:es?|ing)\s+the\s+(?:area|street|neighbourhood)\b/gi, schoolContextOnly: true },
];

export interface CatchmentFinding {
  matched: string;
  excerpt: string;
}

/** Scan text for banned catchment/boundary/assignment vocabulary.
 *  Returns the first finding, or null when clean. */
export function findCatchmentVocabulary(text: string): CatchmentFinding | null {
  for (const { re, schoolContextOnly } of BAN_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(text.length, m.index + m[0].length + 60);
      const excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
      if (schoolContextOnly && !SCHOOL_CONTEXT.test(excerpt)) continue;
      return { matched: m[0], excerpt: "..." + excerpt + "..." };
    }
  }
  return null;
}

/** True when the text contains any banned catchment vocabulary. */
export function hasCatchmentVocabulary(text: string): boolean {
  return findCatchmentVocabulary(text) !== null;
}
