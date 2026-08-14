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
  /\b(?:steps from|on the doorstep|a stone's throw|moments away|just around the corner)\b/i,
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

/** The narrower rule, for text that stands alone (a FAQ answer, not running prose).
 *
 *  DANGLING_START includes `^the \w+`, which is right mid-paragraph — "The property is set back"
 *  after a cut has nothing to attach to — but wrong at the top of a standalone block, where
 *  "The nearby options include…" is a perfectly good opener. What is NEVER resolvable at the top
 *  of a standalone block is a pronoun or a counting demonstrative: "Both", "These", "They",
 *  "The former". Those are the only ones this fires on. */
const UNRESOLVED_STANDALONE_OPENER =
  /^(?:both|either|neither|these|those|they|them|their|it|its|this|that|such|the former|the latter|the two|the three|all three)\b/i;

function opensOnUnresolvedReference(sentence: string): boolean {
  if (SELF_EVIDENT_SUBJECT.test(sentence)) return false;
  return UNRESOLVED_STANDALONE_OPENER.test(sentence);
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

/* A sentence that says a figure CANNOT be published, on a page that publishes it.
 *
 * The mirror image of the suppression work: we took the numbers out of the prose, and the
 * qualitative claims left behind now contradict the numbers that stayed. 141 of 426 pages
 * carried "A reliable street-level price isn't available given the thin recent activity on X"
 * directly beneath a hero publishing a price — because the prose was generated when the
 * graduated window did not exist and those streets published nothing.
 *
 * SAME SHAPE AS THE noRecord GUARD ABOVE, not a second implementation: a structural flag on
 * StripOpts, a pattern, and one line in drop(). And gated the same way — the claim is only
 * false when the page actually publishes the figure the sentence denies.
 *
 * THE SUBJECT MATTERS, which is why there are two flags rather than one. A band is suppressed
 * at k>=10 while a typical publishes at k>=5, so "the sale band is too thin to publish" can be
 * perfectly TRUE on a page showing a price. Measured across the corpus: 475 of these sentences
 * are about a price, 2 about a band alone, 37 about both — and exactly one page (cousens-terrace)
 * would have been wrongly cut by a single flag. */
const DENIES =
  /\b(?:no|not|isn'?t|is not|cannot|can'?t|could not|couldn'?t|too few|too thin|too sparse|too shallow|too small|falls? below|sits? below|below the threshold|insufficient|unable|lacks?)\b/i;
const PUBLISHING =
  /\b(?:publish(?:ed|ing|able)?|available|stated?|state|support|report(?:ed)?|quote[ds]?)\b/i;
const PRICE_NOUN = /\b(?:price|pricing|prices|typical|number|figure|benchmark|valuation)\b/i;
const RANGE_NOUN = /\b(?:range|band)\b/i;

/** True when the sentence denies a figure this page is, in fact, publishing. */
function deniesAPublishedFigure(sentence: string, opts?: StripOpts): boolean {
  if (!DENIES.test(sentence) || !PUBLISHING.test(sentence)) return false;
  // A sentence naming both is gated on the price: that is the part that is false.
  if (PRICE_NOUN.test(sentence)) return !!opts?.pricePublished;
  if (RANGE_NOUN.test(sentence)) return !!opts?.bandPublished;
  return false;
}

/* CLASS (c): a metric characterised in the opposite DIRECTION to its own tile.
 *
 * Distinct from the denial gate above — nothing is being denied. The page publishes a
 * sold-to-ask tile reading over 100% (homes closed ABOVE ask) while a stored sentence frames
 * the same metric as at-or-below ask: "Sold-to-ask sits close to full ask… buyers and sellers
 * have been meeting near the listed number, and outright concessions are the exception."
 * (miltonbrook-crescent, tile 105%.)
 *
 * GATED ON DIRECTION, not on a tolerance. 100% is exactly full ask; strictly above it, an
 * at-or-below-ask frame is contradicted by the number beside it, and there is no defensible
 * cut-off between "a bit over" and "over". A sentence that ACKNOWLEDGES over-ask anywhere in
 * it is describing the same market the tile describes and is left alone.
 *
 * Same shape as the two gates above: one flag on StripOpts, one pattern, one line in drop(). */
const AT_ASK =
  /\b(?:close to (?:full )?ask|at or (?:just )?below ask|near(?:ly)? full ask|meeting near the listed number|concessions? (?:are|remain) the exception|rarely (?:go|sell) over ask|seldom over ask|below asking)\b/i;
const OVER_ASK = /\b(?:over ask|above ask|over asking|above asking|bidding war|competing offers)\b/i;

/** True when the sentence frames sold-to-ask the opposite way to the tile the page publishes. */
function contradictsTheSoldToAskTile(sentence: string, opts?: StripOpts): boolean {
  if (!opts?.soldOverAskPublished) return false;
  return AT_ASK.test(sentence) && !OVER_ASK.test(sentence);
}

export interface StripOpts {
  noRecord?: boolean;
  /** the page publishes a typical price */
  pricePublished?: boolean;
  /** the page publishes a price band/range */
  bandPublished?: boolean;
  /** the page publishes a sold-to-ask tile reading strictly above 100% */
  soldOverAskPublished?: boolean;
}

function drop(sentence: string, opts?: StripOpts): boolean {
  if (sentenceHasNumber(sentence)) return true;
  if (opts?.noRecord && PROPERTY_DETAIL.test(sentence)) return true;
  if (deniesAPublishedFigure(sentence, opts)) return true;
  if (contradictsTheSoldToAskTile(sentence, opts)) return true;
  return false;
}

/** Drop every sentence carrying a number. Returns '' when nothing qualitative survives.
 *
 *  `standalone` marks text that is NOT read in sequence with anything else — a FAQ answer, a
 *  hero subtitle. In running prose the dangling check only fires after a cut, because an opener
 *  can legitimately refer back to the previous paragraph. A standalone block has no previous
 *  paragraph, so an opening "Both provide alternatives…" is dangling whether or not this
 *  particular block is where the antecedent was cut. That distinction is why 132 FAQ answers
 *  survived the coherence pass: the sentence naming the two streets was numeric and lived in a
 *  DIFFERENT item, so no cut had been recorded here when the opener was tested. */
export function stripNumericSentences(
  text: string | null | undefined,
  opts?: StripOpts & { standalone?: boolean },
): string {
  if (!text) return '';
  const sents = splitSentences(text);
  const kept: string[] = [];
  let prevDropped = false;
  for (const s of sents) {
    let dropIt = drop(s, opts);
    // Standalone: the FIRST surviving sentence must resolve on its own, cut or no cut.
    if (!dropIt && opts?.standalone && kept.length === 0 && opensOnUnresolvedReference(s)) dropIt = true;
    if (!dropIt && prevDropped && opensOnDanglingReference(s)) dropIt = true;
    if (dropIt) { prevDropped = true; continue; }
    kept.push(s);
    prevDropped = false;
  }
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
/** A caveat is not content. "Schools nearby" was rendering as a heading over one line —
 *  "Families should confirm current school assignment directly with the boards." — on 51 pages,
 *  because suppression took every substantive sentence and left the compliance close standing.
 *  A section whose surviving paragraphs are ALL disclaimer collapses, same rule as empty
 *  scaffolding: a heading is a promise that something follows it. */
const DISCLAIMER_ONLY =
  /^(?:families|buyers|readers|users|visitors)?\s*(?:should|must|are advised to)\s*(?:confirm|verify|check|consult)\b|^(?:confirm|verify|check)\b[^.]*\b(?:directly with|with the (?:board|boards|city|town|school))\b|^information\s+(?:is\s+)?(?:deemed\s+)?reliable but|^(?:all\s+)?figures?\s+(?:are|is)\s+(?:approximate|indicative|subject to change)/i;

export function isDisclaimer(paragraph: string): boolean {
  return DISCLAIMER_ONLY.test(paragraph.trim());
}

/** True when nothing but caveats survived. */
export function isDisclaimerOnly(paragraphs: string[]): boolean {
  return paragraphs.length > 0 && paragraphs.every(isDisclaimer);
}

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