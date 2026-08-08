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
  /\b(?:a|an)\s+(?:short|quick|brief|easy|long|straight)\s+(?:drive|walk|ride|commute|trip)\b/i,
  /\b(?:minutes|moments|seconds)\s+(?:from|away|by)\b/i,
  /\bwithin\s+(?:a\s+)?(?:short|easy|quick)\s+(?:drive|walk|ride|stroll)\b/i,
];

/** Per-property claims. Only suppressed where the record cannot possibly source them. */
const PROPERTY_DETAIL =
  /\b(?:square feet|sq\.? ?ft|bedrooms?|bathrooms?|garages?|driveways?|siding|brick|stucco|storeys?|stories|frontage|lot size|basements?|kitchens?|roofs?|porch|backyard|floor plans?)\b/i;

/** AMBIGUOUS proximity language — reported, NOT suppressed. "Within walking distance of downtown"
 *  may be defensible for a street that genuinely is; that is a judgement call, not a rule. */
export const AMBIGUOUS_PROXIMITY =
  /\b(?:within walking distance|walkable|steps from|a stone's throw|close to downtown|near the (?:core|centre|center)|on the doorstep)\b/i;

/** Does this sentence assert a number, or an unverifiable travel duration? */
export function sentenceHasNumber(sentence: string): boolean {
  return RULES.some((re) => re.test(sentence));
}

// ── sentence splitting ───────────────────────────────────────────────────────────────────────
// A naive ". followed by a capital" split breaks on "St. Scholastica" and ships the fragment
// "Catholic elementary students attend St." while dropping the rest of the sentence. "St." appears
// 572 times across 250 of the 431 pages; middle initials ("Anne J. MacArthur", "W. F. Reding")
// are the same shape. Neither is a sentence boundary.
const ABBREV = new Set([
  'st', 'ste', 'mt', 'dr', 'ave', 'av', 'rd', 'blvd', 'cres', 'ct', 'cir', 'ln', 'pl', 'ter', 'hwy',
  'mr', 'mrs', 'ms', 'jr', 'sr', 'prof', 'rev', 'hon',
  'inc', 'ltd', 'co', 'corp', 'no', 'approx', 'est', 'dept', 'vs', 'etc', 'ca', 'cf',
  'ps', 'ss', 'es', 'jk', 'sk', 'ont', 'on',
]);

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /([.!?])(\s+)(?=["'“‘(]?[A-Z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] === '.') {
      const before = text.slice(start, m.index);
      const lastTok = (/([A-Za-z][A-Za-z.'’]*)$/.exec(before) ?? [])[1] ?? '';
      const bare = lastTok.replace(/\.+$/, '').toLowerCase();
      // A known abbreviation, or an initial => not a sentence boundary.
      // Initials come as a single letter ("Anne J. MacArthur") or as a chain with internal periods
      // and no spaces ("Bishop P.F. Reding", "E.W. Foster PS") — the chain form is what left 65
      // pages still truncated after the first fix.
      if (ABBREV.has(bare) || /^[a-z](?:\.[a-z])*$/.test(bare)) continue;
    }
    const s = text.slice(start, m.index + 1).trim();
    if (s) out.push(s);
    start = m.index + m[0].length;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

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
