// src/lib/prose/sentences.ts
// THE sentence splitter. One implementation, every caller on it.
//
// There were FIVE before this file: trimFaqAnswers.ts (abbreviation-masking, canary-hardened),
// numericSentences.ts (scan-backwards, single-initial aware), street-data.ts characterSummaryFrom
// (naive), compliance.ts calculateSentenceLengthStdDev (naive), compliance.ts sentence classifier
// (naive), generateStreet.ts sentence-length check (naive). The naive ones split "Louis St. Laurent
// Avenue" mid-name; that shipped three truncated hero subtitles to production.
//
// This merges the two real implementations rather than picking one, because each caught what the
// other missed:
//   from trimFaqAnswers — SENTINEL masking, decimal periods, multi-initial chains (E.W., P.F.,
//                         U.S.A.), the e.g./i.e. forms. Hardened by a 2026-05-09 canary.
//   from numericSentences — single initials in name position ("Anne J. MacArthur"), and the
//                         street/school abbreviations the corpus actually contains.
// Corpus evidence for the additions: "St." appears 572 times across 250 of the 431 published
// street pages. "TTC." is deliberately NOT an abbreviation here — it looks like one and is a
// genuine sentence end.

/** Abbreviations whose trailing period never terminates a sentence. Case-insensitive. */
const ABBREVS = [
  // people
  'Mr', 'Mrs', 'Ms', 'Dr', 'Jr', 'Sr', 'Prof', 'Rev', 'Hon',
  // thoroughfares + places
  'St', 'Ste', 'Mt', 'Ave', 'Av', 'Blvd', 'Pkwy', 'Rd', 'Ln', 'Cres', 'Crt', 'Ct', 'Cir', 'Pl',
  'Ter', 'Hwy',
  // compass (a Milton address quirk: "Bronte St. S.")
  'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW',
  // organisations + editorial
  'etc', 'vs', 'cf', 'Inc', 'Co', 'Corp', 'Ltd', 'approx', 'est', 'dept', 'no',
];

/** Private-use sentinel: stands in for a period that is not a sentence boundary. */
const SENTINEL = String.fromCharCode(0xe000);

const MULTI_PERIOD: Array<[RegExp, string]> = [
  [/\be\.g\./gi, `e${SENTINEL}g${SENTINEL}`],
  [/\bi\.e\./gi, `i${SENTINEL}e${SENTINEL}`],
  [/\bU\.S\./g, `U${SENTINEL}S${SENTINEL}`],
];

function maskAbbreviations(text: string): string {
  let masked = text;

  // Multi-initial chains FIRST — "E.W.", "P.F.", "U.S.A." — so a longer chain is captured whole.
  // If U.S. were masked first the trailing "A." would dangle and read as a boundary.
  masked = masked.replace(/\b([A-Z])\.([A-Z])\.((?:[A-Z]\.)*)/g, (m) => m.replace(/\./g, SENTINEL));

  for (const [re, repl] of MULTI_PERIOD) masked = masked.replace(re, repl);

  // A SINGLE initial in name position: "Anne J. MacArthur", "Bishop P. Reding". Requires a
  // lowercase letter before it and a capitalised word after, which a real sentence end
  // ("...in grade A. The next") almost never satisfies. trimFaqAnswers deliberately skipped this
  // case; the street corpus needs it — "Anne J. MacArthur Public School" is a school name.
  masked = masked.replace(/(?<=[a-z]\s)([A-Z])\.(?=\s+[A-Z])/g, (_m, l) => `${l}${SENTINEL}`);

  for (const ab of ABBREVS) {
    masked = masked.replace(new RegExp(`\\b${ab}\\.`, 'gi'), (m) => m.slice(0, -1) + SENTINEL);
  }

  // decimals: 1.2, $1.2, 3.14
  masked = masked.replace(/(\d)\.(\d)/g, `$1${SENTINEL}$2`);
  return masked;
}

function unmask(text: string): string {
  return text.split(SENTINEL).join('.');
}

/**
 * Split text into sentences, each keeping its terminator. Joining the result with '' reproduces
 * the input (modulo trailing whitespace), so callers can scrub-and-rejoin without losing content.
 */
/** THE boundary regex. It exists here and nowhere else. */
const BOUNDARY = /[^.!?]+[.!?]+(?:\s+|$)?/g;

/** Segments of the MASKED text, each keeping its terminator and trailing whitespace.
 *  The FAQ trimmer slices and rejoins these, so it needs the masked form, not finished sentences. */
export function maskedSegments(text: string): string[] {
  return maskAbbreviations(text).match(BOUNDARY) ?? [];
}

export function splitSentences(text: string | null | undefined): string[] {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  const masked = maskAbbreviations(trimmed);
  const matches = masked.match(BOUNDARY);
  if (!matches) return [trimmed];
  const consumed = matches.reduce((n, m) => n + m.length, 0);
  const out = matches.map(unmask);
  if (consumed < masked.length) {
    const tail = unmask(masked.slice(consumed));
    if (tail.trim()) out.push(tail);
  }
  return out;
}

/** Sentence count, from the same boundaries the splitter uses. */
export function countSentences(text: string | null | undefined): number {
  return splitSentences(text).filter((s) => s.trim().length > 0).length;
}

/** The first sentence, terminator included. '' when there isn't one. */
export function firstSentence(text: string | null | undefined): string {
  return (splitSentences(text)[0] ?? '').trim();
}

/** Exposed for the FAQ trimmer, which needs the masked form to slice and rejoin. */
export const _internal = { maskAbbreviations, unmask, SENTINEL };
