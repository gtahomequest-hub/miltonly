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
// rather than targeted at the audit's hit list — those detectors were floors, not ceilings.
//
// v2 adds the COHERENCE pass. Cutting at sentence level leaves wreckage: a splitter that breaks on
// "St. Scholastica" ships a truncated fragment; a surviving paragraph can open on a pronoun whose
// antecedent was the sentence just removed; a paragraph can be left saying nothing at all. Cutting
// stays at sentence level — paragraph-level suppression would take the best content on the page
// with it — but a paragraph that no longer reads is dropped after the fact.

// ── numbers ──────────────────────────────────────────────────────────────────────────────────
// LITERAL regexes only. An earlier revision built these with new RegExp(`...${CARDINAL}...`) and
// the constructed rules did not fire in the compiled Next build even though they passed under tsx —
// only the plain /\d/ literal took effect, so "two-car garage" and "nineteen-minute drive" shipped.
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

  // v2 — a TRAVEL DURATION with no digit in it. We suppressed every travel-time TILE as
  // unverifiable; a spelled one in prose is the same unverifiable claim.
  // "takes roughly an hour", "a short drive", "minutes from", "moments from"
  /\b(?:roughly|about|approximately|just|barely|under|over|around)?\s*(?:an?|half an|a quarter)\s+(?:hour|hours)\b/i,
  // "a short drive" and its whole family. A corpus sweep — rather than patching the reported
  // phrase — turned up stroll/hop/jaunt alongside the drive/walk/ride forms.
  /\b(?:a|an)\s+(?:short|quick|brief|easy|long|straight|gentle|leisurely)\s+(?:drive|walk|ride|commute|trip|stroll|hop|jaunt)\b/i,
  /\b(?:minutes|moments|seconds)\s+(?:from|away|by)\b/i,
  // POSSESSIVE durations — "under a minute's walk", "within a minute's walk", "an hour's drive".
  // 35 pages. The old rule matched only the plural noun, so every possessive slipped through.
  /\b(?:under|within|barely|just|about|roughly|around)?\s*(?:a|an|one)\s+(?:minute|hour)'s\s+(?:walk|drive|ride|stroll|commute)\b/i,
  // "within a few minutes", "within minutes", "within a short walk" — 21 pages.
  /\bwithin\s+(?:a\s+)?(?:short|easy|quick|gentle|few\s+)?(?:drive|walk|ride|stroll|minutes?)\b/i,

  // Realtor puffery dressed as proximity. This is the register we already refused when ruling on
  // listing-description mining — we declined to launder it out of broker remarks, so we do not
  // publish our own version of it. Distinct from qualitative orientation ("within walking
  // distance"), which is kept: that describes, this sells.
  /\b(?:steps from|on the doorstep|a stone's throw|moments away)\b/i,
];

/** Per-property claims. Only suppressed where the record cannot possibly source them. */
const PROPERTY_DETAIL =
  /\b(?:square feet|sq\.? ?ft|bedrooms?|bathrooms?|garages?|driveways?|siding|brick|stucco|storeys?|stories|frontage|lot size|basements?|kitchens?|roofs?|porch|backyard|floor plans?)\b/i;

/** KEPT proximity language — qualitative orientation, not an asserted measurement. Thomas Street
 *  genuinely does sit a block north of Main Street East. Reported for visibility, not suppressed;
 *  all of it becomes provable when Address Points lands, so this is an interim position. */
export const AMBIGUOUS_PROXIMITY =
  /\b(?:within walking distance|walkable|close to downtown|near the (?:core|centre|center))\b/i;

/** Does this sentence assert a number, or an unverifiable travel duration? */
export function sentenceHasNumber(sentence: string): boolean {
  return RULES.some((re) => re.test(sentence));
}

// ── sentence splitting ───────────────────────────────────────────────────────────────────────
// Was a local implementation. It now lives in ./sentences as THE shared splitter: five separate
// splitters existed across src/, and the naive ones cut three hero subtitles mid-name at
// "Louis St. Laurent Avenue". One operation, one implementation, every caller on it.
export { splitSentences } from './sentences';
import { splitSentences } from './sentences';

// ── coherence ────────────────────────────────────────────────────────────────────────────────
// Subjects that are always available on a street page — the page IS the street, so "The street
// itself is a loop" needs no antecedent. Anything else behind a definite article does.
const SELF_EVIDENT_SUBJECT =
  /^(?:the)\s+(?:street|court|crescent|road|drive|avenue|lane|way|place|terrace|boulevard|trail|close|circle|area|neighbourhood|neighborhood|town|city|market|setting)\b/i;

/** A first sentence that leans on something no longer present. */
const DANGLING_START =
  /^(?:this|that|these|those|it|they|them|their|its|such|both|either|neither|he|she|here)\b|^the\s+\w+/i;

function opensOnDanglingReference(sentence: string): boolean {
  if (SELF_EVIDENT_SUBJECT.test(sentence)) return false;
  return DANGLING_START.test(sentence);
}

/** Reduced to a content-free assertion: a lone sentence that says nothing once its figure is gone.
 *  "Across Campbellville, comparable detached homes have sold at broadly comparable levels." */
const VACUOUS =
  /\b(?:comparable|similar|broadly|roughly|in line with|consistent with|varies|vary|depends|depending)\b[^.]*\b(?:levels?|prices?|values?|ranges?|rates?|terms?|lines?)\b|\b(?:broadly|generally|largely)\s+(?:comparable|similar|consistent)\b/i;

function isHollow(paragraph: string): boolean {
  const sents = splitSentences(paragraph);
  if (sents.length > 1) return false;                 // more than one surviving thought is content
  const wordCount = paragraph.trim().split(/\s+/).length;
  if (wordCount < 10) return true;                    // a stub
  return VACUOUS.test(paragraph);
}

/** A single sentence made circular by the removal of its own figure:
 *  "Across Campbellville, comparable detached homes have sold at broadly comparable levels." */
function isVacuousSentence(sentence: string): boolean {
  return VACUOUS.test(sentence);
}

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

/** Paragraph list in, coherent paragraph list out.
 *  A paragraph is removed when it is emptied, when cutting its opening left the survivor leaning on
 *  a missing antecedent, or when what remains asserts nothing. */
export function stripNumericParagraphs(paragraphs: string[], opts?: StripOpts): string[] {
  const out: string[] = [];
  for (const para of paragraphs) {
    const kept: string[] = [];
    let prevDropped = false;
    for (const s of splitSentences(para)) {
      // A dangling reference can appear anywhere a cut landed, not only at the paragraph opener:
      // "Mae Court is a very low-density street. THE PROPERTY is set back from the road…" — the
      // opener survived and the danger is in the sentence after the hole. So the check follows the
      // hole: whenever a sentence goes, the next survivor is tested against it, and cascades.
      let dropIt = drop(s, opts) || isVacuousSentence(s);
      if (!dropIt && prevDropped && opensOnDanglingReference(s)) dropIt = true;
      if (dropIt) { prevDropped = true; continue; }
      kept.push(s);
      prevDropped = false;
    }
    if (kept.length === 0) continue;
    const joined = kept.join(' ').replace(/\s+/g, ' ').trim();
    if (isHollow(joined)) continue;
    out.push(joined);
  }
  return out;
}

// ── FAQ ──────────────────────────────────────────────────────────────────────────────────────
// An answer stripped of its figure can end up addressing a different subject than its question:
// "What kinds of homes are on Mae Court?" -> "Lots tend to be generous given the semi-rural
// setting." Non-responsive is worse than absent, so the item goes with it.
const TOPICS: Array<{ q: RegExp; a: RegExp }> = [
  { q: /price|cost|worth|afford|expensive/i, a: /price|cost|worth|afford|value|trade|sold|sell|market|budget|entry/i },
  // NB: "semi" must not match "semi-rural", and "town" must not match "downtown" — a housing-type
  // question needs a housing-type answer, not a word that merely contains one.
  { q: /kinds? of home|what type|types? of home|what.*homes are/i,
    a: /\b(?:homes?|houses?|detached|semi-?detached|townhomes?|townhouses?|condos?|bungalows?|housing stock|storeys?|dwellings?|residences?|architectur\w*)\b/i },
  { q: /how long|take to sell|time on market|days on market/i, a: /sell|sold|market|pace|quick|slow|time|turnover|list/i },
  { q: /school/i, a: /school|student|board|catholic|public|elementary|secondary/i },
  { q: /commut|transit|GO |highway|drive to/i, a: /commut|transit|GO\b|highway|drive|road|route|travel|access/i },
  { q: /rent|lease|tenant/i, a: /rent|lease|tenant|landlord/i },
  { q: /good (?:place|street|investment)|worth (?:buying|it)|should i/i, a: /\w{4,}/i },
];

const STOP = new Set(['what', 'kinds', 'kind', 'the', 'are', 'is', 'on', 'in', 'of', 'a', 'an', 'do',
  'does', 'how', 'much', 'many', 'there', 'and', 'for', 'to', 'it', 'this', 'that', 'like', 'you',
  'homes', 'home', 'street', 'court', 'place', 'road', 'drive', 'crescent', 'way', 'terrace', 'lane']);

/** Does the surviving answer still address its question? */
export function answersQuestion(question: string, answer: string): boolean {
  if (!answer.trim()) return false;
  for (const t of TOPICS) if (t.q.test(question)) return t.a.test(answer);
  // no topic rule matched: require a shared content word beyond the street name / stopwords
  const qWords = question.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return qWords.some((w) => !STOP.has(w) && new RegExp(`\\b${w}`, 'i').test(answer));
}

/** Reporting helper: how much of a body was removed. */
export function suppressionStats(paragraphs: string[]): { before: number; after: number } {
  const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const before = paragraphs.reduce((a, p) => a + words(p), 0);
  const after = stripNumericParagraphs(paragraphs).reduce((a, p) => a + words(p), 0);
  return { before, after };
}