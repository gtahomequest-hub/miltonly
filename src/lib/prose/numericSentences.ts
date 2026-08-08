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

// LITERAL regexes only. An earlier revision built these with new RegExp(`...${CARDINAL}...`) and
// the constructed rules did not fire in the compiled Next build even though they passed under tsx —
// only the plain /\d/ literal took effect, so "two-car garage" and "nineteen-minute drive" shipped.
// Literals are what the build actually honours; keep them literal.
const RULES: RegExp[] = [
  /\d/,                                   // any digit — prices, counts, years, distances
  /[$£€]/,                                // currency symbol without a digit
  /%|per cent|percent/i,                  // percentages

  // spelled-out cardinal bound to a unit, allowing up to two filler words between them:
  // "nineteen-minute", "four bedrooms", "the single active listing", "a two-car garage"
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|single|double|triple|dozen)\b(?:[-\s]+\w+){0,2}[-\s]+(?:minutes?|mins?|hours?|days?|weeks?|months?|years?|decades?|bedrooms?|bathrooms?|beds?|baths?|cars?|garages?|storeys?|stories|story|squares?|sq|acres?|hectares?|km|kilometres?|kilometers?|miles?|blocks?|homes?|houses?|units?|listings?|sales?|leases?|properties|property|detached|semis?|townhouses?|townhomes?|condos?|apartments?|lots?|floors?|rooms?|spaces?|spots?|vehicles?|residences?|dwellings?)\b/i,

  // the same cardinal used as a bare quantity: "a single detached home", "the single home"
  /\b(?:a|the|only)\s+single\s+\w+/i,
  /\bzero[-\s]?minute\b/i,

  // an explicit count of NONE is still a count claim: "no active listings", "no recorded sales"
  /\bno\s+(?:current(?:ly)?\s+)?(?:active\s+)?(?:listings?|sales?|resales?|transactions?|homes?|records?)\b/i,
];

/** Per-property claims. Only suppressed where the record cannot possibly source them. */
const PROPERTY_DETAIL =
  /\b(?:square feet|sq\.? ?ft|bedrooms?|bathrooms?|garages?|driveways?|siding|brick|stucco|storeys?|stories|frontage|lot size|basements?|kitchens?|roofs?|porch|backyard|floor plans?)\b/i;

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

/** Options: `noRecord` = the street has no sale on record AND no active listing, so a per-property
 *  claim ("four bedrooms", "brick and vinyl siding") has no source anywhere and is dropped even
 *  when it carries no number. Narrow by design — it applies only where fabrication is provable. */
export interface StripOpts { noRecord?: boolean }

function drop(sentence: string, opts?: StripOpts): boolean {
  if (sentenceHasNumber(sentence)) return true;
  if (opts?.noRecord && PROPERTY_DETAIL.test(sentence)) return true;
  return false;
}

/** Drop every sentence carrying a number. Returns '' when nothing qualitative survives. */
export function stripNumericSentences(text: string | null | undefined, opts?: StripOpts): string {
  if (!text) return '';
  const kept = splitSentences(text).filter((s) => !drop(s, opts));
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

/** Paragraph list in, suppressed paragraph list out. Empty paragraphs are removed entirely. */
export function stripNumericParagraphs(paragraphs: string[], opts?: StripOpts): string[] {
  return paragraphs.map((p) => stripNumericSentences(p, opts)).filter((p) => p.length > 0);
}

/** Reporting helper: how much of a body was removed. */
export function suppressionStats(paragraphs: string[]): { before: number; after: number } {
  const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const before = paragraphs.reduce((a, p) => a + words(p), 0);
  const after = stripNumericParagraphs(paragraphs).reduce((a, p) => a + words(p), 0);
  return { before, after };
}
