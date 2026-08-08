// src/lib/prose/numericSentences.ts
// THE SUPPRESSION RULE, in one place.
//
// Stored StreetContent prose is generated text that no longer tracks the record it was written
// from. The audit found 108 of 431 published pages publishing at least one figure their own
// k-anon gate suppresses, plus area typicals, listing counts and travel times that contradict the
// tiles beside them. This applies the prototype's two-layer rule retroactively: NUMBERS LIVE IN
// THE DETERMINISTIC LAYER, generated prose carries none.
//
// It is a SUPPRESSION, not a repair. Any stored-prose SENTENCE containing a number is dropped
// whole; qualitative sentences survive untouched. Deliberately pattern-based over every page
// rather than targeted at the audit's hit list — those detectors were floors, not ceilings, so
// they cannot be the basis of a compliance decision.
//
// Applies to the generated body sections, the generated FAQ, the hero character summary and the
// market-summary blocks — every surface that renders stored generation output.

/** Cardinal words that carry a count. "single" is included: "a single detached home" is a claim. */
const CARDINAL =
  '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|' +
  'fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|' +
  'ninety|hundred|thousand|million|single|double|triple|dozen)';

/** Units that turn a cardinal word into a measurement. */
const UNIT =
  '(?:minute|min|hour|day|week|month|year|decade|bedroom|bathroom|bed|bath|car|garage|storey|' +
  'story|square|sq|acre|hectare|km|kilometre|kilometer|mile|block|home|house|unit|listing|sale|' +
  'lease|property|detached|semi|townhouse|condo|apartment|lot|floor|room|space|spot)';

const RULES: RegExp[] = [
  /\d/,                                   // any digit — prices, counts, years, distances
  /[$£€]/,                                // currency symbol without a digit (rare, still a claim)
  /%|per cent|percent/i,                  // percentages
  new RegExp(`\\b${CARDINAL}[-\\s]+${UNIT}s?\\b`, 'i'),   // "nineteen-minute", "four bedrooms"
  new RegExp(`\\ba\\s+single\\s+\\w+`, 'i'),              // "a single detached home"
  /\bzero[-\s]?minute\b/i,
];

/** Does this sentence assert a number in any form? */
export function sentenceHasNumber(sentence: string): boolean {
  return RULES.some((re) => re.test(sentence));
}

/** Split prose into sentences without breaking on decimals ("$1.5M. The") or abbreviations. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=["'“‘(]?[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Drop every sentence carrying a number. Returns '' when nothing qualitative survives. */
export function stripNumericSentences(text: string | null | undefined): string {
  if (!text) return '';
  const kept = splitSentences(text).filter((s) => !sentenceHasNumber(s));
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

/** Paragraph list in, suppressed paragraph list out. Empty paragraphs are removed entirely. */
export function stripNumericParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map(stripNumericSentences).filter((p) => p.length > 0);
}

/** Reporting helper: how much of a body was removed. */
export function suppressionStats(paragraphs: string[]): { before: number; after: number } {
  const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const before = paragraphs.reduce((a, p) => a + words(p), 0);
  const after = stripNumericParagraphs(paragraphs).reduce((a, p) => a + words(p), 0);
  return { before, after };
}
