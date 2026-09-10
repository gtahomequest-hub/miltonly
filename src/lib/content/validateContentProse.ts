// src/lib/content/validateContentProse.ts
//
// The Content tier's own validator for the ONE optional generated paragraph a
// guide or a Market Watch edition may carry. Five rules, all hard: a violation
// drops the paragraph and the page publishes without it. Nothing here can
// block a page.
//
// Scope discipline (ruling 3, 2026-09-10): this file does not import from
// src/lib/ai/validateStreetGeneration.ts and that file is not edited. The four
// required rules could not be extracted unchanged — each takes
// `input: StreetGeneratorInput` and reads `.aggregates` / `.nearby` — so they
// are reimplemented against GroundedFigures, which carries key/value/label/
// source plus named entities and nothing else.
//
// The fifth rule is the house punctuation ban (no em-dash; en-dash only
// between numerals). It is not optional anywhere in this codebase, so it rides
// with the other four rather than being left to a prompt to remember.

import type { GroundedFigures, GroundedFigure } from "./groundedFigures";
import { hasNoDollarFigure } from "./groundedFigures";

export type ContentRule =
  | "ungrounded_number"
  | "superlative"
  | "invented_entity"
  | "price_without_input"
  | "punctuation";

export interface ContentViolation {
  rule: ContentRule;
  excerpt: string;
  detail: string;
}

// ── rule 2 vocabulary ─────────────────────────────────────────────────────
// Deliberately a local list. The street tier's SUPERLATIVE_PHRASES is
// module-private and exporting it would mean editing a Core file. Kept in step
// with it by hand; a divergence is a note for Core, not a silent drift.
const SUPERLATIVES = [
  "best", "unbeatable", "nothing comes close", "premier", "second to none",
  "finest", "most desirable", "top-tier", "world-class", "unparalleled",
  "unmatched", "prestigious", "luxurious", "highly sought", "sought-after",
  "sought after", "hidden gem", "must-see", "must see", "stunning",
  "breathtaking", "boasts", "dream home", "one of a kind",
];

// Words that open a capitalised token legitimately without naming a place.
const SENTENCE_SAFE = new Set([
  "The", "A", "An", "This", "That", "These", "Those", "It", "There", "In",
  "On", "At", "For", "From", "By", "With", "When", "Where", "While", "If",
  "But", "And", "Or", "So", "As", "Over", "Under", "Between", "After",
  "Before", "Most", "Some", "Both", "Each", "Every", "No", "Not", "One",
  "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  "Sunday", "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
  "Detached", "Semi", "Townhouse", "Condo", "Freehold",
]);

function excerptAround(text: string, index: number, width = 70): string {
  const lo = Math.max(0, index - width);
  const hi = Math.min(text.length, index + width);
  return (lo > 0 ? "..." : "") + text.slice(lo, hi).trim() + (hi < text.length ? "..." : "");
}

// ── numeric extraction ────────────────────────────────────────────────────

export interface ProseNumeric {
  raw: string;
  index: number;
  kind: "dollar" | "percent" | "plain";
  value: number | null;
}

// A magnitude may be a suffix letter or a spelled word. The street tier learned
// this the expensive way: "$1.1 million" parsed as one dollar five cents, so a
// true sentence looked like a fabrication. Both forms are one token here.
const DOLLAR_RE = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:[MmKk]\b|million|thousand))?/g;
const PERCENT_RE = /\d+(?:\.\d+)?\s?%/g;
const PLAIN_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;

export function parseDollar(raw: string): number | null {
  const m = raw
    .trim()
    .match(/^\$?\s?([\d,]*\.?\d+)\s?([MmKk]|million|thousand)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const mag = (m[2] ?? "").toLowerCase();
  if (mag === "m" || mag === "million") return n * 1_000_000;
  if (mag === "k" || mag === "thousand") return n * 1_000;
  return n;
}

export function extractProseNumerics(text: string): ProseNumeric[] {
  const out: ProseNumeric[] = [];
  const claimed: Array<[number, number]> = [];

  const take = (re: RegExp, kind: ProseNumeric["kind"]) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // A "$1.2M" already claimed its digits; the plain pass must not re-report
      // them as a bare number. Same for the digits inside "4.3%".
      if (claimed.some(([s, e]) => start >= s && end <= e)) continue;
      claimed.push([start, end]);
      const value =
        kind === "dollar"
          ? parseDollar(m[0])
          : parseFloat(m[0].replace(/[%,\s]/g, ""));
      out.push({ raw: m[0].trim(), index: start, kind, value: Number.isFinite(value as number) ? (value as number) : null });
    }
  };

  take(DOLLAR_RE, "dollar");
  take(PERCENT_RE, "percent");
  take(PLAIN_RE, "plain");
  return out.sort((a, b) => a.index - b.index);
}

// ── grounding ─────────────────────────────────────────────────────────────

/** A dollar figure is grounded within the site's own rounding grain (5k) or
 *  half a percent, whichever is looser. "$1.05M" for 1,050,000 passes;
 *  "$1.1M" for 1,050,000 does not. */
function dollarMatches(prose: number, figure: number): boolean {
  const tol = Math.max(5000, figure * 0.005);
  return Math.abs(prose - figure) <= tol;
}

function figureNumbers(g: GroundedFigures, kinds: GroundedFigure["kind"][]): number[] {
  return g.figures
    .filter((f) => kinds.includes(f.kind) && typeof f.value === "number")
    .map((f) => f.value as number);
}

/** Every number that appears anywhere in a figure LABEL is quotable — a label
 *  carrying "week of 2026-09-07" or "trailing 28 days" licenses 2026, 09, 07
 *  and 28 without the model having invented anything. */
function labelNumbers(g: GroundedFigures): Set<string> {
  const s = new Set<string>();
  // exec loop rather than matchAll: the app tsconfig targets below es2015 for
  // iteration and matchAll's iterator is a TS2802 there (the same error that
  // failed a Vercel build in 19883b7).
  const collect = (text: string) => {
    const re = /\d+(?:\.\d+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) s.add(m[0]);
  };
  for (const f of g.figures) {
    collect(f.label);
    if (typeof f.value === "string") collect(f.value);
  }
  for (const e of g.entities) collect(e);
  return s;
}

// ── the five rules ────────────────────────────────────────────────────────

/** RULE 1 — ungrounded_number. Any numeric the bundle cannot account for. */
export function findUngroundedNumbers(text: string, g: GroundedFigures): ContentViolation[] {
  const out: ContentViolation[] = [];
  const dollars = figureNumbers(g, ["dollar"]);
  const percents = figureNumbers(g, ["percent"]);
  const counts = figureNumbers(g, ["count", "days"]);
  const labels = labelNumbers(g);

  for (const n of extractProseNumerics(text)) {
    if (n.value === null) continue;
    let ok = false;
    if (n.kind === "dollar") {
      ok = dollars.some((d) => dollarMatches(n.value as number, d));
    } else if (n.kind === "percent") {
      ok = percents.some((p) => Math.abs(p - (n.value as number)) < 0.05);
    } else {
      // A plain numeral may be ANY figure quoted without its unit. The first
      // real edition failed on exactly this: the bundle carried a sold-to-ask
      // of 97.5 and the model wrote "97.5 per cent of asking", so a grounded
      // percentage was checked as a bare count and reported as invented.
      // Grounding is about tracing to a figure, not about matching how the
      // page happens to render it.
      ok =
        counts.some((c) => c === n.value) ||
        dollars.some((d) => d === n.value) ||
        percents.some((pc) => Math.abs(pc - (n.value as number)) < 0.05) ||
        labels.has(n.raw.replace(/,/g, ""));
    }
    if (!ok) {
      out.push({
        rule: "ungrounded_number",
        excerpt: excerptAround(text, n.index),
        detail: `"${n.raw}" traces to no figure in the input bundle`,
      });
    }
  }
  return out;
}

/** RULE 2 — superlative. Entity names are masked first: a building actually
 *  called "Premier Place" is a fact, not a sales claim. */
export function findSuperlatives(text: string, g: GroundedFigures): ContentViolation[] {
  let masked = text;
  for (const e of g.entities) {
    if (!e) continue;
    masked = masked.split(e).join(" ".repeat(e.length));
  }
  const out: ContentViolation[] = [];
  for (const phrase of SUPERLATIVES) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const m = re.exec(masked);
    if (m) {
      out.push({
        rule: "superlative",
        excerpt: excerptAround(text, m.index),
        detail: `banned superlative "${phrase}"`,
      });
    }
  }
  return out;
}

/** RULE 3 — invented_entity. A capitalised proper noun that is not in
 *  `entities`, is not sentence-initial, and is not an ordinary capitalised
 *  word. Milton itself is always allowed; it is the subject of every page. */
export function findInventedEntities(text: string, g: GroundedFigures): ContentViolation[] {
  const allowed = new Set<string>(["Milton", "Ontario", "Halton", "Miltonly", "GO", "MLS"]);
  for (const e of g.entities) {
    allowed.add(e);
    for (const w of e.split(/\s+/)) allowed.add(w);
  }

  const out: ContentViolation[] = [];
  const seen = new Set<string>();
  // Capitalised runs of one or more words.
  const re = /\b[A-Z][a-zA-Z'']+(?:\s+(?:of|the|de)?\s*[A-Z][a-zA-Z'']+)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[0].trim();
    if (allowed.has(token) || seen.has(token)) continue;
    const before = text.slice(0, m.index).trimEnd();
    const sentenceInitial = before === "" || /[.!?]$/.test(before);
    const words = token.split(/\s+/);
    if (words.every((w) => allowed.has(w))) continue;
    // A SINGLE capitalised word opening a sentence carries no signal — every
    // sentence starts that way — so it is skipped rather than guessed at.
    // KNOWN BLIND SPOT: a one-word invented place opening a sentence ("Beaty
    // led the week") is not caught. Closing it needs an English dictionary,
    // and firing on every sentence opener instead would drop every paragraph
    // and still look like a working gate. Mid-sentence single words and
    // multi-word runs in any position ARE caught, which is where an invented
    // place actually appears.
    if (sentenceInitial && words.length === 1) continue;
    if (words.length === 1 && SENTENCE_SAFE.has(token)) continue;
    seen.add(token);
    out.push({
      rule: "invented_entity",
      excerpt: excerptAround(text, m.index),
      detail: `"${token}" is not in the input's named entities`,
    });
  }
  return out;
}

/** RULE 4 — price_without_input. When the bundle carries no dollar figure at
 *  all, no dollar amount may appear in any form. Stated as an absence rather
 *  than a list of forbidden shapes, because a list of shapes is a list a model
 *  routes around: "$1.1M" becomes "the low $1Ms" becomes "just over a million". */
export function findPriceWithoutInput(text: string, g: GroundedFigures): ContentViolation[] {
  if (!hasNoDollarFigure(g)) return [];
  const out: ContentViolation[] = [];
  for (const n of extractProseNumerics(text)) {
    if (n.kind === "dollar") {
      out.push({
        rule: "price_without_input",
        excerpt: excerptAround(text, n.index),
        detail: `"${n.raw}" — the input carries no price at any grain`,
      });
    }
  }
  const words = /\b(?:just over|just under|around|about|roughly|north of|shy of)\s+(?:a|one|half a)?\s*(?:million|thousand)\b/i;
  const wm = words.exec(text);
  if (wm) {
    out.push({
      rule: "price_without_input",
      excerpt: excerptAround(text, wm.index),
      detail: `a price stated in words while the input carries none`,
    });
  }
  return out;
}

/** RULE 5 — punctuation. House rule: no em-dash anywhere; an en-dash only
 *  between numerals. */
export function findPunctuation(text: string): ContentViolation[] {
  const out: ContentViolation[] = [];
  const em = text.indexOf("—");
  if (em >= 0) {
    out.push({ rule: "punctuation", excerpt: excerptAround(text, em), detail: "em-dash" });
  }
  const enRe = /–/g;
  let m: RegExpExecArray | null;
  while ((m = enRe.exec(text)) !== null) {
    const prev = text[m.index - 1];
    const next = text[m.index + 1];
    if (!/\d/.test(prev ?? "") || !/\d/.test(next ?? "")) {
      out.push({
        rule: "punctuation",
        excerpt: excerptAround(text, m.index),
        detail: "en-dash outside a numeral pair",
      });
    }
  }
  const dbl = text.indexOf("--");
  if (dbl >= 0) {
    out.push({ rule: "punctuation", excerpt: excerptAround(text, dbl), detail: "double-hyphen em-dash surrogate" });
  }
  return out;
}

export interface ContentValidationResult {
  ok: boolean;
  violations: ContentViolation[];
}

/** The whole gate. Fail-closed: any violation drops the paragraph. */
export function validateContentProse(text: string, g: GroundedFigures): ContentValidationResult {
  const violations = [
    ...findUngroundedNumbers(text, g),
    ...findSuperlatives(text, g),
    ...findInventedEntities(text, g),
    ...findPriceWithoutInput(text, g),
    ...findPunctuation(text),
  ];
  return { ok: violations.length === 0, violations };
}
