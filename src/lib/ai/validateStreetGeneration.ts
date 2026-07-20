// src/lib/ai/validateStreetGeneration.ts
// Validator for Phase 4.1 street description output.
// Runs against StreetGeneratorOutput post-parse. Returns violations list.
// Hard violations trigger retry. 3 attempts max, then hard fail + needsReview.
//
// v3 changes from v2:
//   - Added hedging_builder, faq_answer_length, faq_question_out_of_bank rules
//     (no more rule-name reuse for unrelated violations)
//   - Added total_word_floor rule at 1,200 (matches system prompt self-check #9)
//     with tiered floors for thin (1,050) and zero (1,000) data streets
//   - Widened rent regex to catch 5-digit rents ($10,500 style)
//   - Expanded KNOWN_MILTON_ANCHORS to cover common schools, parks, transit
//
// Known limitations (documented intentionally):
//   - "average" in METHODOLOGY_LEAK_PHRASES will false-positive on valid usages
//     like "on average" or "average household size". Keep strict for now.
//     Monitor retry rate during backfill; loosen if it causes churn.
//   - K/M shorthand prices like "$1.4M" and "$748K" cannot be rounding-validated
//     because the regex requires comma-separated numeric form. These are
//     structurally hard to emit un-rounded, so the gap is low-risk.
//   - extractCandidateStreetNames is a heuristic. Expand KNOWN_MILTON_ANCHORS
//     as new false positives surface during backfill.

import type {
  StreetGeneratorOutput,
  StreetGeneratorInput,
  StreetSection,
  StreetSectionId,
  StreetFAQItem,
  ValidatorViolation,
  ValidatorRule,
} from "@/types/street-generator";
import { config } from "@/lib/config";
import { countSentences } from "./trimFaqAnswers";
import { findCatchmentVocabulary } from "./catchmentVocabulary";
import { cleanNeighbourhoodName } from "@/lib/format";
import { NEIGHBOURHOOD_CENTROIDS } from "@/lib/geo";

// --- Denylists ---

const EM_DASH_CHARS = /[\u2014\u2013]/;  // em-dash, en-dash. Hyphen-minus is allowed.

const SUPERLATIVE_PHRASES = [
  "best", "unbeatable", "nothing comes close", "premier",
  "second to none", "finest", "most desirable", "top-tier",
  "world-class", "unparalleled", "unmatched",
];

const CLICHE_OPENERS_AND_PHRASES = [
  "welcome to", "nestled in", "tucked away", "hidden gem",
  "sought-after", "sought after",
  "stunning", "must-see", "must see", "breathtaking", "boasts",
  "offers the perfect blend", "lifestyle you deserve",
  "dream home", "truly unique", "one of a kind", "gem of a",
  // Batch-001 B11: retired prompt-example fragments that were copied verbatim
  // across 4+ published pages. The prompts' examples are now placeholder-ized;
  // these bans catch any model that still echoes the old phrasing.
  "quiet enough that the road network",
  "without the through-traffic noise",
];

// Two-pass methodology-leak detection. Substring-match for unambiguous phrases
// like "TREB" or "MLS feed" — these never occur in normal English. Word-boundary
// regex with context window for polysemous words like "mean," "average,"
// "median" — these are methodology leaks only when surrounded by statistical
// context indicators (price, sale, value, day, transaction, number, percent, $).
// Prior single-pass substring approach false-positived on verb usage like
// "marketing times mean buyers" — fixed 2026-05-05 in Phase 4.1 Piece D / 2.8.

// Phrases that are unambiguous methodology leaks regardless of surrounding context.
// Substring match is safe — these phrases don't occur in normal advisor prose.
const METHODOLOGY_LEAK_PHRASES_SUBSTRING = [
  "last 12 months", "past 12 months", "last twelve months",
  "past twelve months", "last 24 months", "past 24 months",
  "last quarter", "past quarter",
  "data source", "our dataset", "our algorithm", "MLS feed",
  "TREB", "VOW", "standard deviation", "sample size",
  "k-anonymity", "per our data",
];

// Common English words that are methodology leaks ONLY in statistical context.
// Word-boundary regex match + context-window check required to avoid false positives
// like "longer marketing times mean buyers..." (verb usage of "mean") or
// "average household size" (descriptor usage of "average").
const METHODOLOGY_LEAK_WORDS_CONTEXTUAL = [
  "median", "average", "mean", "statistical",
];

// Context indicators that, when present near a contextual word, confirm methodology
// leak. If a contextual word appears WITHOUT any of these in a 50-character window
// before or after, treat it as benign English usage.
//
// Note: /\btime/i was considered as an indicator (for "median time") but dropped
// because /\b/ at the leading boundary alone matches "times" (plural noun), which
// false-positives on advisor prose like "longer marketing times mean buyers...".
// "Days on market" stat patterns are still caught via /\bday/i below.
const METHODOLOGY_CONTEXT_INDICATORS = [
  /\$\s*\d/,           // $ followed by digits ("median price of $1.2M")
  /\d+\s*%/,           // percent signs near the word
  /\bprice/i,          // "median price"
  /\bsale/i,           // "average sale"
  /\bvalue/i,          // "median value"
  /\bday/i,            // "average days on market"
  /\btransaction/i,    // "average transaction"
  /\bnumber/i,         // "median number"
  /\bsales/i,          // "average sales"
];

// Pass 1 only — substring matches for unambiguous methodology phrases
// (TREB, MLS feed, our dataset, etc.). Always banned in every section
// including market. These never have legitimate uses in editorial prose.
function findMethodologyLeakSubstring(text: string): { excerpt: string; pattern: RegExp } | null {
  for (const phrase of METHODOLOGY_LEAK_PHRASES_SUBSTRING) {
    const re = wordBoundaryRegex(phrase);
    if (re.test(text)) return { excerpt: excerptAround(text, re), pattern: re };
  }
  return null;
}

// Pass 2 only — contextual word matches gated by statistical context window.
// Catches "median price" / "average days on market" / "mean DOM" patterns
// that legitimately leak methodology in editorial contexts. Suppressed in
// the market section, where "Days on market average around 96" is real
// market analysis idiom and not a methodology leak. Source-citing language
// (TREB, MLS, our dataset) is still caught by Pass 1 in market.
function findMethodologyLeakContextual(text: string): { excerpt: string; pattern: RegExp } | null {
  for (const word of METHODOLOGY_LEAK_WORDS_CONTEXTUAL) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const idx = match.index;
      const windowStart = Math.max(0, idx - 50);
      const windowEnd = Math.min(text.length, idx + match[0].length + 50);
      const window = text.slice(windowStart, windowEnd);
      if (METHODOLOGY_CONTEXT_INDICATORS.some((ind) => ind.test(window))) {
        return { excerpt: "..." + window + "...", pattern: re };
      }
    }
  }
  return null;
}

// Backwards-compatible composite for FAQ checks and any caller that wants
// both passes. Per-section callers should use the two split functions
// directly so they can suppress Pass 2 in the market section.
function findMethodologyLeak(text: string): { excerpt: string; pattern: RegExp } | null {
  return findMethodologyLeakSubstring(text) ?? findMethodologyLeakContextual(text);
}

const HEDGING_PHRASES = [
  "likely built by", "probably built by", "appears to have been built",
  "may have been built", "seems to have been", "likely Mattamy",
  "probably Mattamy", "may be Mattamy", "likely a product of",
  "possibly built", "believed to be built",
];

// --- Sales-register leak detection ---
// Editorial prose speaks ABOUT the street, not FOR the writer. The model
// occasionally pivots to advisory/sales register on closing lines — "Our
// team monitors the street closely and can provide detailed guidance on
// current listings and off-market opportunities" was the canonical example
// from the prior B1 sample. This catches both the first-person-plural
// pivot AND the reader-contact / service-language patterns.

// First-person plural pronouns used as subject/object/possessive. Excludes
// the editorial-we constructions ("we'd note", "we observe") that are
// occasionally allowed in FAQ answers.
const SALES_PRONOUNS_REGEX = /\b(?:our team|our view|our (?:advisory|practice|service|brokerage|firm)|we (?:follow|track|monitor|note|observe|advise|provide|offer|help|recommend|suggest|encourage|invite)|we'(?:ll|ve|re)|we can|we have|we work|we serve|we cover)\b/gi;

// Reader-contact invitations. Match phrasal forms.
const SALES_INVITATION_PHRASES = [
  "contact us", "reach out", "let us know", "feel free to",
  "get in touch", "drop us a line", "drop us a note",
  "available to help", "happy to discuss", "happy to walk",
  "private conversation", "off-market opportunit",
  "call our team", "give us a call", "schedule a consultation",
  "book a consultation", "request a consultation",
];

// Service-language nouns in promotional context. Matched as standalone
// terms; require a sales_pronoun match in the same section to fire (handled
// by the detection function below) — alone they're often legitimate
// advisor-prose constructions.
const SALES_SERVICE_NOUNS = [
  "consultation", "advisory service", "brokerage service",
];

export function findSalesRegisterLeak(text: string): { excerpt: string; matchedPhrase: string } | null {
  // Pass 1: pronoun pivot.
  const pronounMatch = SALES_PRONOUNS_REGEX.exec(text);
  SALES_PRONOUNS_REGEX.lastIndex = 0;
  if (pronounMatch) {
    return {
      excerpt: excerptAroundIndex(text, pronounMatch.index, pronounMatch[0].length),
      matchedPhrase: pronounMatch[0],
    };
  }
  // Pass 2: invitation phrases.
  for (const phrase of SALES_INVITATION_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const m = re.exec(text);
    if (m) {
      return {
        excerpt: excerptAroundIndex(text, m.index, m[0].length),
        matchedPhrase: m[0],
      };
    }
  }
  // Pass 3: service nouns in promotional context (only fire if both a
  // service noun AND a pronoun pivot appear within 200 chars).
  for (const noun of SALES_SERVICE_NOUNS) {
    const re = new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const m = re.exec(text);
    if (m) {
      const windowStart = Math.max(0, m.index - 200);
      const windowEnd = Math.min(text.length, m.index + m[0].length + 200);
      const window = text.slice(windowStart, windowEnd);
      if (/\b(?:our|we|us)\b/i.test(window)) {
        return {
          excerpt: excerptAroundIndex(text, m.index, m[0].length),
          matchedPhrase: m[0],
        };
      }
    }
  }
  return null;
}

function excerptAroundIndex(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + len + 40);
  return "..." + text.slice(start, end) + "...";
}

// --- Market section template-parrot detection ---
// During the B3 5-sample series the market section's worked example was
// being parroted near-verbatim across multiple samples. At the 230-street
// production scale that would create template-shaped content across many
// pages and trigger Google helpful-content penalties. The prompt has been
// revised with three rotating examples and a FORBIDDEN PATTERN block, but
// the validator catches the specific phrases as a backstop.
//
// Match is case-insensitive substring. Phrases retired from the worked
// example, plus any close paraphrase the model continues to lean on.
const MARKET_TEMPLATE_PARROT_PHRASES = [
  "end units and units with finished basements",
  "interior units without basement finish trade",
  "investor demand is anchored",
];

export function findMarketTemplateParrot(text: string): { excerpt: string; matchedPhrase: string } | null {
  const lower = text.toLowerCase();
  for (const phrase of MARKET_TEMPLATE_PARROT_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx >= 0) {
      return {
        excerpt: excerptAroundIndex(text, idx, phrase.length),
        matchedPhrase: text.slice(idx, idx + phrase.length),
      };
    }
  }
  return null;
}

// --- Numeric grounding (Phase 4.1 / Task 2) ---
//
// Detects market-section numerics (dollar amounts, percentages, counts,
// ratios, days-on-market, quarter labels) that do NOT trace back to
// `StreetGeneratorInput` fields or recognized single-step derivations.
//
// Two failure modes seen in production audit:
//   1. Price band extrapolation — model extends a range beyond actual comps
//      ("$1.2M to $1.5M" when input maxes at $1.415M).
//   2. Invented condition/position differentials — "$30K end-unit premium"
//      when input has no condition/position split.
//
// Allowed shapes:
//   - Direct match: number rounds to within tolerance of an input value
//     (typicalPrice / priceRange / byType / quarterlyTrend / leaseActivity)
//   - Yield derivation: y = (lease × 12 / sale) × 100, ±1% tolerance
//   - Lease-to-sale ratio: leasesCount / salesCount, ±0.15 tolerance
//   - "X of Y" counts: both X and Y must be in the input counts pool
//
// Banned shape: any "$X premium" / "$X differential" / "X% premium" — input
// schema has no condition/position price split, so these are always fabricated.
//
// Tolerance:
//   - Prices: max(±$15K, ±4%)
//   - Percentages: ±1.0 absolute (for yield derivations)
//   - DOM: ±5 days
//   - Counts: exact match required (or in input counts pool)

interface NumericExtraction {
  raw: string;
  index: number;
  context: string;
  type: "dollar" | "percent" | "count" | "ratio" | "days" | "quarter" | "year";
}

// Pattern ORDER matters — earlier patterns claim spans first (overlapping
// later matches are dropped). Put more-specific shapes first so they win:
//   "X of Y" before bare "X leases" (so "11 of 22" wins over "22 leases")
//   "only X active" before bare "X active"
//   "(high|mid|low)-$N(s)" before bare "$N" so tier-shorthand keeps its
//     tier qualifier — otherwise `$770` claims the span for `high-$770s`
//     and parseDollarTokenForGrounding can't scale 770 → 770_000.
//     (Workstream 2 / Class A hardening 2026-05-28.)
const NUMERIC_PATTERNS: Array<{ re: RegExp; type: NumericExtraction["type"] }> = [
  { re: /(?:high|mid|low)-\$\d+(?:\.\d+)?[KkMm]?s?/g, type: "dollar" },
  { re: /\$[\d,]+(?:\.\d+)?[KkMm]?/g, type: "dollar" },
  { re: /\b\d+(?:\.\d+)?%/g, type: "percent" },
  { re: /\b\d+\s+of\s+\d+\b/gi, type: "count" },
  { re: /\b(?:only|just)\s+\d+\s+active\b/gi, type: "count" },
  { re: /\b\d+\s+(?:sales|leases|listings|active|townhouse|townhome|townhouses|townhomes|detached)\b/gi, type: "count" },
  { re: /\bratio\s+of\s+(?:nearly\s+)?\d+(?:\.\d+)?\b/gi, type: "ratio" },
  { re: /\b\d+(?:\.\d+)?\s*(?:to|:)\s*1\b/g, type: "ratio" },
  { re: /\b\d+\s+day(?:s)?\b/g, type: "days" },
  { re: /\bQ[1-4]\s+\d{4}\b/g, type: "quarter" },
  { re: /\b(?:post|pre|after|before)[- ]?\d{4}\b/gi, type: "year" },
];

function extractNumerics(prose: string): NumericExtraction[] {
  const out: NumericExtraction[] = [];
  const seen = new Set<string>();
  // Track [start, end) spans per type so overlapping matches in the same
  // category (e.g., "5 active" inside "Only 5 active") emit a single finding.
  const claimedSpans: Record<string, Array<[number, number]>> = {};
  for (const { re, type } of NUMERIC_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prose))) {
      const raw = m[0];
      const start = m.index;
      const end = m.index + raw.length;
      const spans = claimedSpans[type] ||= [];
      const overlaps = spans.some(([s, e]) => start < e && end > s);
      if (overlaps) continue;
      spans.push([start, end]);
      const ctxStart = Math.max(0, start - 35);
      const ctxEnd = Math.min(prose.length, end + 35);
      const ctx = prose.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim();
      const key = `${type}:${raw}:${start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ raw, index: start, context: ctx, type });
    }
  }
  return out;
}

function parseDollarTokenForGrounding(tok: string): number | null {
  let s = tok.replace(/[$,\s]/g, "").toLowerCase();
  const tier = s.match(/^(high|mid|low)-(.+)$/);
  if (tier) s = tier[2];
  if (s.endsWith("s")) s = s.slice(0, -1);
  let mul = 1;
  let body = s;
  if (s.endsWith("m")) { mul = 1_000_000; body = s.slice(0, -1); }
  else if (s.endsWith("k")) { mul = 1_000; body = s.slice(0, -1); }
  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  if (mul === 1 && tier && n >= 100 && n < 1000) mul = 1_000;
  return Math.round(n * mul);
}

export function isPriceWithinInputTolerance(prose: number, inputs: number[]): boolean {
  for (const i of inputs) {
    if (i === 0) continue;
    const tol = Math.max(15_000, i * 0.04);
    if (Math.abs(prose - i) <= tol) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// WS5 — sub-k price-RANGE reassembly gate (rule "subk_range_reassembly").
//
// The k-anon range gate suppresses input.aggregates.priceRange to null when the
// pool is sub-K_ANON_RANGE (<10 sales). But prose can REASSEMBLE an equivalent
// low–high band from grounded quarterly typicals (each quarter count>=2 is
// individually citeable), defeating the suppression — findUngroundedNumerics
// checks each endpoint independently and never sees the band-ness. This detector
// fires a hard violation when priceRange===null AND the prose presents an
// EXPLICIT low–high price band (range/spread vocabulary, or a dash band).
//
// Deliberately NARROW to avoid over-firing on legitimate quarterly TREND prose:
//   - it requires explicit range/band vocabulary ("between X and Y", "range of
//     X to Y", "ranges from X to Y", "spanning X to Y", "$X–$Y range") or a bare
//     dash band ("$X–$Y") — it does NOT match a bare "from X to Y" (that is trend
//     phrasing: "rose from … to …"), and
//   - it EXEMPTS a band whose context carries a quarter label (Q3 2024, Q1'25) —
//     naming grounded quarter points in a trend is allowed.
// Sale-scale only (min endpoint >= $100K) and non-rent context, so rent bands and
// the legit full-k range (priceRange non-null) never fire.
// Shared (lives in the W2 detector module); CHECKPOINT-1 wires it into the HUB
// validator only — the street validator is NOT yet calling it (deferred pending
// the street-tier blast-radius audit). Exported so the audit can detect with it.
// ---------------------------------------------------------------------------

// Token includes the optional `high|mid|low-` tier prefix and trailing `s` so a
// hundreds-shorthand band ("high-$700s to low-$800s") is captured whole and
// scaled by parseDollarTokenForGrounding (tier + 100–999 → ×1000 → $700,000),
// mirroring extractNumerics' first dollar pattern. Bare "$700s" (no tier) still
// parses to 700 and falls below the sale-scale floor, exactly as findUngrounded-
// Numerics treats it — only the tier-prefixed form scales.
const SUBK_PRICE_DOLLAR = `(?:(?:high|mid|low)-)?\\$\\d[\\d,]*(?:\\.\\d+)?[KkMm]?s?`;
// Each pattern carries a `bare` flag. NON-bare patterns are explicit band
// vocabulary ("range of", "ranges from", "spanning", "$X–$Y range", dash band) —
// they are bands by construction and fire regardless of trend verbs. The `bare`
// pattern is the unqualified "$X to $Y": band-SHAPED but indistinguishable from
// trend phrasing ("rose from $X to $Y"), so it fires ONLY when the context has
// no trend anchor (and no quarter label) — see SUBK_TREND_ANCHOR below.
const SUBK_RANGE_BAND_PATTERNS: Array<{ re: RegExp; bare: boolean }> = [
  { re: new RegExp(`\\bbetween\\s+(${SUBK_PRICE_DOLLAR})\\s+and\\s+(${SUBK_PRICE_DOLLAR})`, "ig"), bare: false },
  { re: new RegExp(`\\b(?:in\\s+the\\s+)?range\\s+of\\s+(${SUBK_PRICE_DOLLAR})\\s+(?:to|and|through|[–—-])\\s+(${SUBK_PRICE_DOLLAR})`, "ig"), bare: false },
  { re: new RegExp(`\\brang(?:es|ing|ed)\\s+from\\s+(${SUBK_PRICE_DOLLAR})\\s+(?:to|and|through|[–—-])\\s+(${SUBK_PRICE_DOLLAR})`, "ig"), bare: false },
  { re: new RegExp(`\\bspan(?:s|ning)?\\s+(?:from\\s+)?(${SUBK_PRICE_DOLLAR})\\s+(?:to|through|[–—-])\\s+(${SUBK_PRICE_DOLLAR})`, "ig"), bare: false },
  { re: new RegExp(`(${SUBK_PRICE_DOLLAR})\\s*[–—]\\s*(${SUBK_PRICE_DOLLAR})\\s+range`, "ig"), bare: false },
  { re: new RegExp(`(${SUBK_PRICE_DOLLAR})\\s*[–—]\\s*(${SUBK_PRICE_DOLLAR})`, "ig"), bare: false }, // dash band
  { re: new RegExp(`(${SUBK_PRICE_DOLLAR})\\s+(?:to|through)\\s+(${SUBK_PRICE_DOLLAR})`, "ig"), bare: true }, // bare "$X to $Y"
];
const SUBK_QUARTER_ANCHOR = /Q[1-4]\s*['']?\s*\d{2,4}/i;
const SUBK_RENT_CTX = /\b(rent|rental|lease|leased|tenant|month|monthly|\/mo)\b/i;
// Trend anchor — turns a bare "$X to $Y" from a (banned) BAND into an (allowed)
// TREND. Includes the directional preposition "from" ("rose from $X to $Y") per
// the CHECKPOINT-1 decision, plus the movement verbs. Applied ONLY to the bare
// pattern, so explicit band vocab ("ranged from …") is never exempted by it.
const SUBK_TREND_ANCHOR =
  /\b(?:from|ros(?:e)|rise|rising|risen|climb(?:ed|ing)?|eas(?:e|ed|ing)|fell|fall(?:ing|en)?|dip(?:ped|ping)?|firm(?:ed|ing)?|grew|grow(?:ing|n)?|gain(?:ed|ing)?|slip(?:ped|ping)?|slid|soften(?:ed|ing)?|cool(?:ed|ing)?|advanc(?:ed|ing)?|increas(?:ed|ing)?|decreas(?:ed|ing)?|declin(?:ed|ing)?|jump(?:ed|ing)?|edg(?:ed|ing)?|tick(?:ed|ing)?|mov(?:ed|ing)?|trend(?:ed|ing)?)\b/i;

export interface SubkRangeFinding {
  raw: string;
  context: string;
  reason: string;
}

export function findSubkRangeReassembly(
  prose: string,
  input: StreetGeneratorInput,
): SubkRangeFinding[] {
  // Gate: only when the aggregate sale price RANGE is k-anon suppressed.
  if (input.aggregates.priceRange != null) return [];

  const out: SubkRangeFinding[] = [];
  const seen = new Set<string>();
  for (const { re, bare } of SUBK_RANGE_BAND_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prose)) !== null) {
      const loRaw = m[1];
      const hiRaw = m[2];
      const lo = parseDollarTokenForGrounding(loRaw);
      const hi = parseDollarTokenForGrounding(hiRaw);
      if (lo === null || hi === null) continue;
      if (Math.min(lo, hi) < 100_000) continue; // rent / non-price scale
      if (Math.abs(hi - lo) < 1) continue;       // single value, not a spread

      const ctxStart = Math.max(0, m.index - 35);
      const ctxEnd = Math.min(prose.length, m.index + m[0].length + 35);
      const ctx = prose.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim();
      if (SUBK_RENT_CTX.test(ctx)) continue;        // rent band — not a sale priceRange
      if (SUBK_QUARTER_ANCHOR.test(ctx)) continue;  // quarter-anchored trend — allowed
      // Bare "$X to $Y" is band-shaped but ambiguous with trend prose; a trend
      // anchor (from / rose / eased / …) in context marks it a TREND → exempt.
      // Explicit band vocab (bare === false) is never exempted by trend verbs.
      if (bare && SUBK_TREND_ANCHOR.test(ctx)) continue;

      const key = `${loRaw}|${hiRaw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        raw: m[0],
        context: ctx,
        reason:
          `low–high price band "${loRaw} – ${hiRaw}" presented while the aggregate priceRange ` +
          `is k-anon suppressed (sub-K_ANON_RANGE). Reassembling a sub-k range/band — even from ` +
          `grounded quarterly typicals — is not permitted; name individual quarter-anchored points ` +
          `or omit the band.`,
      });
    }
  }
  return out;
}

export function collectInputPrices(input: StreetGeneratorInput): number[] {
  const out: number[] = [];
  if (input.aggregates.typicalPrice) out.push(input.aggregates.typicalPrice);
  if (input.aggregates.priceRange) out.push(input.aggregates.priceRange.low, input.aggregates.priceRange.high);
  for (const t of Object.values(input.byType)) {
    if (t.typicalPrice) out.push(t.typicalPrice);
    if (t.priceRange) out.push(t.priceRange.low, t.priceRange.high);
  }
  for (const q of input.quarterlyTrend ?? []) if (q.typical) out.push(q.typical);
  for (const c of input.crossStreets ?? []) if (c.typicalPrice) out.push(c.typicalPrice);
  // Workstream 2 / Step 4 hardening: neighbourhoodComparable.typicalSoldPrice
  // is a legitimate input-anchored value the model cites in the
  // neighbourhoodComparable section. Prior omission caused $600K-class
  // false rejections when the model wrote rounded neighbourhood prices
  // that matched input.neighbourhoodComparable but no other input field.
  if (input.neighbourhoodComparable?.typicalSoldPrice) {
    out.push(input.neighbourhoodComparable.typicalSoldPrice);
  }
  if (input.neighbourhoodComparable?.priceRange) {
    out.push(
      input.neighbourhoodComparable.priceRange.low,
      input.neighbourhoodComparable.priceRange.high,
    );
  }
  return out;
}

export function collectInputRents(input: StreetGeneratorInput): number[] {
  const out: number[] = [];
  for (const b of Object.values(input.leaseActivity?.byBed ?? {})) if (b.typicalRent) out.push(b.typicalRent);
  // Part 4 (2026-05-09): per-row records expose individual rents that ARE
  // grounded in input data. Without this, prose like "$3,200/mo for a
  // 4-bed" would fire numeric_ungrounded even though it cites a record
  // the prompt was given.
  for (const r of input.leaseActivity?.recentRecords ?? []) {
    if (r.soldPrice) out.push(r.soldPrice);
    if (r.listPrice) out.push(r.listPrice);
  }
  if (input.leaseActivity?.rangeStats) {
    out.push(input.leaseActivity.rangeStats.min, input.leaseActivity.rangeStats.max);
  }
  return out;
}

function collectInputCounts(input: StreetGeneratorInput): number[] {
  const out: number[] = [];
  // txCount removed from the payload 2026-07-19 (batch-001): whitelisting the
  // blended sales+leases sum legitimized "N total transactions" mixed-pool
  // prose. Only per-pool counts ground numeric claims now.
  out.push(input.aggregates.salesCount, input.aggregates.leasesCount, input.activeListingsCount);
  for (const t of Object.values(input.byType)) out.push(t.count);
  for (const b of Object.values(input.leaseActivity?.byBed ?? {})) out.push(b.count);
  for (const q of input.quarterlyTrend ?? []) out.push(q.count);
  return out;
}

function normalizeQuarterLabel(q: string): string {
  const m = q.match(/Q([1-4])\s*['']?(\d{2,4})/);
  if (!m) return q.trim();
  let yr = m[2];
  if (yr.length === 2) yr = `20${yr}`;
  return `Q${m[1]} ${yr}`;
}

interface UngroundedFinding {
  raw: string;
  type: NumericExtraction["type"];
  context: string;
  reason: string;
}

/**
 * Scan market-section prose for numerics that do not match input data or
 * recognized derivations. Returns a list of findings; empty when grounded.
 *
 * Exported for reuse by audit scripts and unit tests.
 */
export function findUngroundedNumerics(
  prose: string,
  input: StreetGeneratorInput,
): UngroundedFinding[] {
  const numerics = extractNumerics(prose);
  const out: UngroundedFinding[] = [];

  const prices = collectInputPrices(input);
  const rents = collectInputRents(input);
  const counts = collectInputCounts(input);
  const quarters = (input.quarterlyTrend ?? []).map(q => normalizeQuarterLabel(q.quarter));
  const dom = input.aggregates.daysOnMarket ?? 0;
  const ratio = input.aggregates.salesCount > 0
    ? input.aggregates.leasesCount / input.aggregates.salesCount
    : 0;

  for (const n of numerics) {
    if (n.type === "dollar") {
      const value = parseDollarTokenForGrounding(n.raw);
      if (value === null) continue;  // unparseable — don't fire
      const isRent = /\b(lease|rent|month|tenant|gross)/i.test(n.context);

      // Premium/differential constructs are always fabricated — input has no
      // by-condition or by-position price split in the schema.
      if (/\b(premium|differential)\b/i.test(n.context) ||
          /\bover\s+(interior|older|standard)/i.test(n.context)) {
        out.push({
          raw: n.raw, type: n.type, context: n.context,
          reason: "premium/differential dollar — input has no end-vs-interior or condition split",
        });
        continue;
      }

      const candidates = isRent ? rents : prices;
      if (isPriceWithinInputTolerance(value, candidates)) continue;
      // Cross-check the other category (e.g., FAQ-area ambiguity)
      const altCandidates = isRent ? prices : rents;
      if (isPriceWithinInputTolerance(value, altCandidates)) continue;

      out.push({
        raw: n.raw, type: n.type, context: n.context,
        reason: `${value} not in input ${isRent ? "rents" : "prices"} (tolerance ±max($15K, 4%))`,
      });
      continue;
    }

    if (n.type === "percent") {
      const v = parseFloat(n.raw);
      if (/\bpremium\b/i.test(n.context)) {
        out.push({
          raw: n.raw, type: n.type, context: n.context,
          reason: "premium percentage — input has no by-condition split",
        });
        continue;
      }
      if (/\b(yield|gross)\b/i.test(n.context)) {
        let derivable = false;
        for (const r of rents) {
          for (const p of prices) {
            if (!p) continue;
            const y = (r * 12 / p) * 100;
            if (Math.abs(y - v) < 1.0) { derivable = true; break; }
          }
          if (derivable) break;
        }
        if (!derivable) {
          out.push({
            raw: n.raw, type: n.type, context: n.context,
            reason: `yield ${v}% does not match any rent/price single-step derivation`,
          });
        }
        continue;
      }
      // Other percentages (without yield/premium context) — treat as
      // ungrounded unless the value matches a plausible input-derived number.
      // Conservative: don't fire on bare percentages with no recognized context.
      continue;
    }

    if (n.type === "count") {
      const im = n.raw.match(/\d+/);
      if (!im) continue;
      const v = parseInt(im[0], 10);
      // "X of Y" — both halves must be input counts (any input count)
      const pair = n.raw.match(/(\d+)\s+of\s+(\d+)/i);
      if (pair) {
        const a = parseInt(pair[1], 10);
        const b = parseInt(pair[2], 10);
        if (counts.includes(a) && counts.includes(b)) continue;
        out.push({
          raw: n.raw, type: n.type, context: n.context,
          reason: `${a} of ${b} — at least one not in input counts: [${counts.slice(0,8).join(",")}]`,
        });
        continue;
      }
      // Context-sensitive single-count matching: scoping the validation pool
      // by the count's semantic category (active/sales/leases/listings) prevents
      // false-negatives where an "active" count happens to match an unrelated
      // input field like quarterlyTrend.count.
      const lowerRaw = n.raw.toLowerCase();
      let scopedCounts: number[];
      if (/\bactive\b|\blistings?\b/.test(lowerRaw)) {
        scopedCounts = [input.activeListingsCount];
      } else if (/\bleases?\b/.test(lowerRaw)) {
        scopedCounts = [input.aggregates.leasesCount,
          ...Object.values(input.leaseActivity?.byBed ?? {}).map(b => b.count)];
      } else if (/\bsales?\b/.test(lowerRaw)) {
        scopedCounts = [input.aggregates.salesCount,
          ...Object.values(input.byType).map(t => t.count)];
      } else if (/\btownhouse|townhome|detached\b/.test(lowerRaw)) {
        scopedCounts = Object.values(input.byType).map(t => t.count);
      } else {
        scopedCounts = counts;
      }
      if (scopedCounts.includes(v)) continue;
      out.push({
        raw: n.raw, type: n.type, context: n.context,
        reason: `count ${v} not in input counts for category: [${scopedCounts.slice(0,8).join(",")}]`,
      });
      continue;
    }

    if (n.type === "ratio") {
      const numbers = n.raw.match(/\d+(?:\.\d+)?/g);
      if (!numbers) continue;
      const v = parseFloat(numbers[0]);
      if (Math.abs(v - ratio) < 0.15 || Math.abs(v - Math.round(ratio * 10) / 10) < 0.1) continue;
      out.push({
        raw: n.raw, type: n.type, context: n.context,
        reason: `ratio ${v} ≠ leases/sales (${ratio.toFixed(2)})`,
      });
      continue;
    }

    if (n.type === "days") {
      const im = n.raw.match(/\d+/);
      if (!im) continue;
      const v = parseInt(im[0], 10);
      if (dom && Math.abs(v - dom) <= 5) continue;
      // "X year"/"past X" parsed as days — skip
      if (/\b(year|past|recent)\b/i.test(n.context)) continue;
      out.push({
        raw: n.raw, type: n.type, context: n.context,
        reason: `DOM ${v} ≠ input ${dom} (tolerance ±5)`,
      });
      continue;
    }

    if (n.type === "quarter") {
      const norm = normalizeQuarterLabel(n.raw);
      if (quarters.includes(norm)) continue;
      out.push({
        raw: n.raw, type: n.type, context: n.context,
        reason: `quarter ${norm} not in input: [${quarters.join(",")}]`,
      });
      continue;
    }

    // type === "year": "post-2015", "pre-2010" — input has no construction-year
    // field, so any era qualifier is ungrounded.
    if (n.type === "year") {
      out.push({
        raw: n.raw, type: n.type, context: n.context,
        reason: "construction-era qualifier — input has no construction-year field",
      });
      continue;
    }
  }

  return out;
}

interface TemporalFinding {
  quarter: string;
  context: string;
  reason: string;
  type: "price_mismatch" | "direction_mismatch" | "count_mismatch";
}

/**
 * Detect temporal pairing fabrications in market section prose.
 *
 * Surfaced by Phase 4.1 Task 3.5 qualitative audit on Sonnet 3a output:
 * model wrote "before a single detached-influenced trade in Q3 2025 pushed
 * the all-type composite higher" but the actual outlier in input data was
 * Q3 2026, not Q3 2025. Q3 2025 was actually flat/slightly-down vs Q2 2025.
 *
 * The numeric_ungrounded rule already catches references to quarters not
 * in input data. This rule catches the additional class:
 *
 * 1. **price_mismatch**: a quarter mention paired (within ~50 chars) with a
 *    sale price that does NOT match input.quarterlyTrend[quarter].typical
 *    within tolerance (max $25K or 5%). Rent prices near a quarter are
 *    skipped — the rule only checks sale prices.
 *
 * 2. **direction_mismatch**: a quarter mention paired (within ~80 chars) with
 *    a directional verb ("rose", "softened", "pushed higher", "declined")
 *    where the stated direction contradicts the actual q-over-q change vs
 *    the prior quarter in input. Only fires when stated and actual point
 *    in OPPOSITE directions (up vs down) — flat vs slight-up tolerated.
 *
 * Skipped when input.quarterlyTrend is empty or the quarter doesn't exist
 * in input (numeric_ungrounded handles the latter).
 */
export function findTemporalPairings(
  prose: string,
  input: StreetGeneratorInput,
): TemporalFinding[] {
  const trend = (input.quarterlyTrend ?? []).map(q => ({
    canonical: normalizeQuarterLabel(q.quarter),
    typical: q.typical,
    count: q.count,
  }));
  if (trend.length === 0) return [];

  // Sort chronologically (year asc, then quarter number asc) for prev-quarter lookup.
  const sorted = [...trend].sort((a, b) => {
    const ay = parseInt(a.canonical.split(" ")[1], 10);
    const by = parseInt(b.canonical.split(" ")[1], 10);
    if (ay !== by) return ay - by;
    return parseInt(a.canonical.charAt(1), 10) - parseInt(b.canonical.charAt(1), 10);
  });
  const prevMap = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    prevMap.set(sorted[i].canonical, sorted[i - 1].typical);
  }
  const trendMap = new Map(trend.map(q => [q.canonical, q.typical] as const));

  const findings: TemporalFinding[] = [];
  const seenKeys = new Set<string>(); // (quarter|type) — dedupe per-quarter per-type

  // Find all quarter mentions in prose
  const quarterPattern = /\bQ([1-4])\s*['']?(\d{2,4})\b/g;
  const matches = Array.from(prose.matchAll(quarterPattern));

  // Check 1: price + quarter pairing. Pair each price with its SYNTACTICALLY
  // associated quarter, not just the nearest quarter by char distance. The
  // 3.8a audit found 3/3 false positives with the naive nearest-quarter
  // heuristic (e.g., "Q3 2024 typical near $875K down through Q3 2025"
  // mis-attributed $875K to Q3 2025).
  //
  // Pairing rules (in priority order):
  //  (a) "$X in Q[1-4] [YYYY]" within ~15 chars after price → that quarter
  //  (b) Most recent quarter mention BEFORE the price within 50 chars → that
  //      quarter (the natural "Qn YYYY ... $X" prose order)
  //  (c) Otherwise no pairing — price stands alone, no fire
  //
  // Strict price form: either comma-separated ($X,XXX[,XXX]+) OR K/M-suffix
  // ($X[.XX]K|M). Bare "$1" or "$830" without comma or suffix is rejected to
  // avoid backtrack matches inside descriptive bands like "$830s" or "$1.1Ms".
  const pricePattern = /\$(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?[KkMm])(?!\w)/g;
  const priceMatches = Array.from(prose.matchAll(pricePattern));
  for (const pm of priceMatches) {
    const priceStr = pm[0];
    const value = parseDollarTokenForGrounding(priceStr);
    if (value === null) continue;
    const pmIdx = pm.index ?? 0;
    const pmEnd = pmIdx + priceStr.length;

    // Skip rent prices — only check sale prices against quarterly typical.
    const localCtx = prose.slice(Math.max(0, pmIdx - 30), pmEnd + 30);
    if (/\b(lease|rent|month|tenant|monthly)\b/i.test(localCtx)) continue;

    // (a) Lookforward: "$X in Qn YYYY" within 15 chars after price end.
    const forwardCtx = prose.slice(pmEnd, Math.min(prose.length, pmEnd + 25));
    const forwardMatch = forwardCtx.match(/^\s*(?:in\s+)?(Q[1-4]\s*['']?\d{2,4})/i);
    let nearest: { canonical: string; idx: number } | null = null;
    if (forwardMatch) {
      const qLocal = forwardMatch.index ?? 0;
      const qIdx = pmEnd + qLocal + (forwardMatch[0].length - forwardMatch[1].length);
      nearest = { canonical: normalizeQuarterLabel(forwardMatch[1]), idx: qIdx };
    } else {
      // (b) Lookbehind: most recent quarter mention before price within 50 chars.
      let mostRecent: { canonical: string; idx: number; distance: number } | null = null;
      for (const qm of matches) {
        const qIdx = qm.index ?? 0;
        if (qIdx >= pmIdx) continue; // must be before price
        const distance = pmIdx - qIdx;
        if (distance > 50) continue;
        if (!mostRecent || distance < mostRecent.distance) {
          mostRecent = { canonical: normalizeQuarterLabel(qm[0]), idx: qIdx, distance };
        }
      }
      if (mostRecent) nearest = { canonical: mostRecent.canonical, idx: mostRecent.idx };
    }
    if (!nearest) continue;

    const inputTypical = trendMap.get(nearest.canonical);
    if (inputTypical === undefined) continue; // numeric_ungrounded handles

    const tolerance = Math.max(25_000, inputTypical * 0.05);
    if (Math.abs(value - inputTypical) > tolerance) {
      const key = `${nearest.canonical}|price`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const ctxStart = Math.max(0, Math.min(nearest.idx, pmIdx) - 30);
      const ctxEnd = Math.min(prose.length, Math.max(nearest.idx, pmIdx) + 60);
      findings.push({
        quarter: nearest.canonical,
        context: prose.slice(ctxStart, ctxEnd),
        reason:
          `${nearest.canonical} paired with ${priceStr} (${value.toLocaleString("en-US")}) ` +
          `but input typical is $${Math.round(inputTypical).toLocaleString("en-US")} ` +
          `(tolerance ±$${Math.round(tolerance).toLocaleString("en-US")})`,
        type: "price_mismatch",
      });
    }
  }

  // Check 2: direction word + quarter pairing.
  // Restructured per 3.8a fix: scan for direction words first, then pair each
  // with its NEAREST quarter mention. This avoids the per-quarter mis-
  // attribution bug where a direction word near one quarter would falsely
  // fire on a different quarter that happened to be in its ±80 char context
  // (e.g., "softened by Q3 2025, though a single sale in Q3 2026 reached..."
  // where "softened" applies to Q3 2025 but old logic also fired on Q3 2026).
  // NOTE (Workstream 2 / Class C hardening 2026-05-28): "compressed" removed
  // from downPattern. It is a range-narrowing verb ("the range compressed"),
  // not a price-direction verb. Including it caused false-positives when the
  // model legitimately described the SPREAD narrowing while the average held
  // or moved in either direction (centennial-forest-drive raw output 2026-05-27).
  const upPattern = /\b(rose|climbed|firmed|surged|jumped|spiked|rebounded|increased|pushed[^.]{0,15}?higher|composite[^.]{0,15}?higher|all-type[^.]{0,15}?higher)\b/gi;
  const downPattern = /\b(softened|dropped|declined|fell|slipped|pushed[^.]{0,15}?lower|sank|cooled)\b/gi;
  type DirectionFinding = { idx: number; word: string; dir: "up" | "down" };
  const directionMatches: DirectionFinding[] = [];
  for (const dm of Array.from(prose.matchAll(upPattern))) {
    directionMatches.push({ idx: dm.index ?? 0, word: dm[0], dir: "up" });
  }
  for (const dm of Array.from(prose.matchAll(downPattern))) {
    directionMatches.push({ idx: dm.index ?? 0, word: dm[0], dir: "down" });
  }
  for (const dirFind of directionMatches) {
    // Workstream 2 / Class C hardening: accept the verb if ANY quarter in
    // its ±50-char window has a transition supporting the stated direction.
    // The prior nearest-only logic mis-fired on chained prose like
    // "softened to $776K in Q4 2024, then firmed to $928K in Q2 2025" —
    // "firmed" was bound to Q4 2024 (nearest) and flagged as wrong, even
    // though the verb actually describes the Q4'24 → Q2'25 transition,
    // which is up. The wider candidate sweep catches the intended quarter.
    const candidates: Array<{ canonical: string; idx: number; distance: number; actualDirection: "up" | "down" | "flat" | "none" }> = [];
    for (const qm of matches) {
      const qIdx = qm.index ?? 0;
      const distance = Math.abs(qIdx - dirFind.idx);
      if (distance > 50) continue;
      const canonical = normalizeQuarterLabel(qm[0]);
      const inputTypical = trendMap.get(canonical);
      if (inputTypical === undefined) {
        candidates.push({ canonical, idx: qIdx, distance, actualDirection: "none" });
        continue;
      }
      const prev = prevMap.get(canonical);
      if (prev === undefined) {
        candidates.push({ canonical, idx: qIdx, distance, actualDirection: "none" });
        continue;
      }
      const change = (inputTypical - prev) / prev;
      const actualDirection: "up" | "down" | "flat" =
        change > 0.05 ? "up" :
        change < -0.05 ? "down" :
        "flat";
      candidates.push({ canonical, idx: qIdx, distance, actualDirection });
    }

    if (candidates.length === 0) continue;

    // Accept if any candidate's direction matches OR is flat (model can
    // describe a flat as either soft "firmed" or soft "eased" by an editorial
    // margin — only fire on opposite-direction mismatches, the existing
    // tolerance).
    const supports = candidates.some(
      (c) => c.actualDirection === dirFind.dir || c.actualDirection === "flat"
    );
    if (supports) continue;

    // None of the candidates support the direction — fire on the nearest
    // candidate that has a real transition (not "none"), preferring
    // transitions over no-prior-quarter cases for the most informative
    // error message.
    const failingCandidate =
      candidates.find((c) => c.actualDirection !== "none") ?? candidates[0];

    const inputTypical = trendMap.get(failingCandidate.canonical);
    const prev = prevMap.get(failingCandidate.canonical);
    if (inputTypical === undefined || prev === undefined) continue;

    const key = `${failingCandidate.canonical}|direction`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const ctxStart = Math.max(0, Math.min(dirFind.idx, failingCandidate.idx) - 30);
    const ctxEnd = Math.min(prose.length, Math.max(dirFind.idx + dirFind.word.length, failingCandidate.idx + 7) + 30);
    findings.push({
      quarter: failingCandidate.canonical,
      context: prose.slice(ctxStart, ctxEnd),
      reason:
        `${failingCandidate.canonical} described as ${dirFind.dir} (via "${dirFind.word}") but no quarter in the ±50-char window has a matching transition ` +
        `(actual q-over-q change vs prior: ${failingCandidate.actualDirection} from $${Math.round(prev).toLocaleString("en-US")} → $${Math.round(inputTypical).toLocaleString("en-US")})`,
      type: "direction_mismatch",
    });
  }

  // Check 3: count-quarter pairing.
  // "single trade in Q3 2025" / "lone sale in Q4 2024" / "one outlier trade
  // in Q2 2026" — the prose claims the quarter had a SINGLE trade. If input
  // shows count > 1, this is a fabrication (often the model conflated two
  // outlier quarters — Sonnet 3a: claimed "single ... trade in Q3 2025"
  // when input has Q3 '25 count=6 and Q3 '26 count=1).
  //
  // Co-location requirement (3.8a fix): the count phrase and the quarter
  // MUST appear in the same prepositional phrase. Specifically, the rule
  // only fires when "in Q[1-4] [YYYY]" appears within 25 chars after the
  // count phrase end. Without this constraint, prose like "...by Q3 2025,
  // though a single outlier sale in Q3 2026..." mis-attributed the count
  // claim to Q3 2025 because Q3 2025 was nearer in absolute char distance.
  const countPattern = /\b(single|lone|one|sole|isolated|individual|outlier|standalone)[^.]{0,30}?\b(trade|sale|transaction)\b/gi;
  const countMatches = Array.from(prose.matchAll(countPattern));
  for (const cm of countMatches) {
    const cmIdx = cm.index ?? 0;
    const cmEnd = cmIdx + cm[0].length;

    // Require "in Q[1-4] [YYYY]" within 25 chars AFTER the count phrase.
    // The 25-char window covers natural prose like "single outlier sale in
    // Q3 2026" without picking up a quarter mentioned later in the sentence.
    const forwardCtx = prose.slice(cmEnd, Math.min(prose.length, cmEnd + 25));
    const colocated = forwardCtx.match(/^\s*(?:in|during|over|across)?\s*(Q[1-4]\s*['']?\d{2,4})/i);
    if (!colocated) continue; // no co-located quarter — don't fire (avoids 3.8a false positives)

    const canonical = normalizeQuarterLabel(colocated[1]);
    const inputQ = trend.find(q => q.canonical === canonical);
    if (!inputQ) continue; // numeric_ungrounded handles
    if (inputQ.count <= 1) continue; // count claim matches input

    const key = `${canonical}|count`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const ctxStart = Math.max(0, cmIdx - 60);
    const ctxEnd = Math.min(prose.length, cmEnd + 60);
    findings.push({
      quarter: canonical,
      context: prose.slice(ctxStart, ctxEnd),
      reason:
        `${canonical} described as having a "${cm[0]}" but input shows ` +
        `count=${inputQ.count} trades that quarter (likely conflated with a different ` +
        `single-trade outlier quarter)`,
      type: "count_mismatch",
    });
  }

  return findings;
}

interface QualitativeFinding {
  subsegmentTerm: string;
  comparativeTerm: string;
  context: string;
  reason: string;
}

/**
 * Detect Category-A qualitative subsegment-comparative fabrications in market
 * section prose.
 *
 * Surfaced by Phase 4.1 Task 3.8b scope audit. Pass 2 of the twopass-causal
 * architecture introduces qualitative claims like "end-units command a
 * premium over interiors due to additional windows" or "older construction
 * units trade at a discount compared to newer builds". The input schema has
 * no by-condition / by-position / by-era / by-basement-finish / by-lot-size
 * fields — every such comparative claim is fabricated, regardless of whether
 * specific dollar amounts are stated.
 *
 * The numeric_ungrounded rule already catches the NUMERIC versions of these
 * claims ($30K premium, etc.). This rule catches the QUALITATIVE versions
 * that slip through when no specific number is invented.
 *
 * Detection: a subsegment vocabulary term appearing within 50 chars of a
 * comparative vocabulary term fires the rule. Allow-list: future schema
 * additions could permit grounded claims by exposing byCondition / byPosition
 * etc. on input — until then the rule is effectively a hard ban.
 */
const SUBSEGMENT_TERMS = [
  "end-unit", "end-units", "end units", "interior-unit", "interior-units",
  "interior unit", "interior units",
  "older build", "older builds", "newer build", "newer builds",
  "older construction", "newer construction",
  "basement-finish", "finished basement", "finished basements",
  "unfinished basement", "unfinished basements",
  "larger lot", "larger lots", "smaller lot", "smaller lots",
  "corner unit", "corner units", "corner lot", "corner lots",
  "end of street", "end of the street", "end-of-row", "end of row",
  "south end", "north end", "east end", "west end",
];
const COMPARATIVE_TERMS = [
  "premium", "discount", "command", "trade higher", "trade lower",
  "value higher", "value lower", "trade at a", "trade above", "trade below",
  "land at the upper end", "land at the lower end",
  "commanding the upper end", "commanding the lower end",
  "command higher", "command lower",
  "above the typical", "below the typical",
];

export function findQualitativeGroundingViolations(prose: string): QualitativeFinding[] {
  const findings: QualitativeFinding[] = [];
  const seenPairs = new Set<string>(); // dedupe per (subsegment, comparative)

  // Build regex for each subsegment term as a global match. Word boundaries
  // are slightly relaxed for hyphenated forms like "end-unit" / "end-of-row"
  // since \b doesn't break on '-'.
  for (const subTerm of SUBSEGMENT_TERMS) {
    const escaped = subTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const subRe = new RegExp(`\\b${escaped}\\b`, "gi");
    const subMatches = Array.from(prose.matchAll(subRe));
    if (subMatches.length === 0) continue;

    for (const sm of subMatches) {
      const smIdx = sm.index ?? 0;
      const smEnd = smIdx + sm[0].length;
      const ctxStart = Math.max(0, smIdx - 50);
      const ctxEnd = Math.min(prose.length, smEnd + 50);
      const window = prose.slice(ctxStart, ctxEnd);

      for (const compTerm of COMPARATIVE_TERMS) {
        const compEsc = compTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const compRe = new RegExp(`\\b${compEsc}\\b`, "i");
        if (!compRe.test(window)) continue;

        const key = `${subTerm.toLowerCase()}|${compTerm.toLowerCase()}|${smIdx}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        findings.push({
          subsegmentTerm: sm[0],
          comparativeTerm: compTerm,
          context: window,
          reason:
            `subsegment term "${sm[0]}" paired with comparative "${compTerm}" within 50 chars — ` +
            `input schema has no by-condition / by-position / by-era field, so this comparative ` +
            `is fabricated regardless of whether a specific number is stated`,
        });
        break; // one fire per subsegment match (don't double-fire on multiple comparatives)
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Class B grounding gate — singular-per-trade fabrication detector.
//
// Surfaced by the centennial-forest-drive-milton diagnostic (2026-05-28):
// the model emitted "A three-bedroom condo unit changed hands around $775,000
// in Q4 2024" but input.aggregates exposes only quarterly + by-type means.
// There are zero per-record sale rows in StreetGeneratorInput, so any
// singular-trade assertion about a sale is fabrication by construction.
//
// Numeric-proximity grounding (findUngroundedNumerics) missed it because
// $775K is within ±4% of the Q4'24 quarterly typical of $776,667 — the
// price ANCHORS to a real aggregate but the CLAIM-TYPE (single trade,
// specific date, specific bed count) is unsupported by the data shape.
//
// Architectural principle (DEC-GROUNDING-GATE 2026-05-28):
//   Validation gates on CLAIM-TYPE vs DATA-EXISTENCE, not number proximity.
//   If the prose makes a per-trade claim and the input has no per-trade
//   record set, the rule fires regardless of how close the number is to an
//   aggregate.
//
// Coverage:
//   - Sale-side claims: input never exposes per-trade sales → always fire.
//   - Lease-side claims: fire if input.leaseActivity.recentRecords is empty
//     or absent (Part 4 exposes per-lease records when k≥5).
//
// Determiners that mark a singular-trade claim: a, an, one (and "a single",
// "one single"). Aggregate signal words within the matched span (typical,
// average, median, comparable, generally, usually, representative) suppress
// the fire — "a typical condo" is aggregate language even though it has "a".
// ---------------------------------------------------------------------------

const PER_TRADE_PROPERTY_NOUNS = [
  "condo", "townhouse", "townhome", "detached", "semi-detached", "semi",
  "home", "unit", "property", "house", "bungalow",
];
const PER_TRADE_TRANSACTION_NOUNS = ["trade", "sale", "transaction"];
const PER_TRADE_TRANSACTION_VERBS = [
  "changed\\s+hands",
  "sold\\s+(?:for|at|around|near)",
  "traded\\s+(?:at|for|around|near)",
  "went\\s+for",
  "closed\\s+(?:at|near|around)",
  "fetched",
  "achieved",
];
const PER_TRADE_AGGREGATE_SIGNALS = [
  "typical", "typically", "average", "median", "comparable", "generally",
  "usually", "representative", "on\\s+average", "in\\s+general",
];

export interface PerTradeFabricationFinding {
  matchedPhrase: string;
  context: string;
  side: "sale" | "lease";
  reason: string;
}

/**
 * Scan prose for singular-per-trade claims that the input data cannot support.
 *
 * Implements the claim-type-vs-data-existence principle: fires regardless of
 * whether the cited dollar value is close to an aggregate, because the
 * fabrication is structural (no per-trade record exists in input).
 */
export function findPerTradeFabrications(
  prose: string,
  input: StreetGeneratorInput,
): PerTradeFabricationFinding[] {
  const findings: PerTradeFabricationFinding[] = [];

  const propertyNounAlt = PER_TRADE_PROPERTY_NOUNS.join("|");
  const transactionNounAlt = PER_TRADE_TRANSACTION_NOUNS.join("|");
  const aggregateAlt = PER_TRADE_AGGREGATE_SIGNALS.join("|");
  const verbRe = new RegExp(`\\b(?:${PER_TRADE_TRANSACTION_VERBS.join("|")})\\b`, "i");
  // Price pattern: comma-grouped ($725,000), K/M-suffix ($1.15M), or bare 3-7
  // digit (rejected). Bare 1-2 digit prefaced by $ is allowed for tier
  // shorthand ($770s) since the per-trade rule fires on shorthand too —
  // emitting "$770" in a per-trade context is still fabrication, irrespective
  // of whether the surrounding tier word would otherwise rescue the literal
  // for findUngroundedNumerics.
  const priceRe = /\$\d[\d.,]*[KkMm]?/;

  // Determiner + optional adjectives (excluding aggregate signals via negative
  // lookahead) + property or transaction noun. Up to 3 adjective slots covers
  // "three-bedroom condo unit" / "single recent transaction" / etc.
  const claimRe = new RegExp(
    `\\b(a|an|one)\\s+` +
    `(?:(?:(?!(?:${aggregateAlt})\\b)[a-z][a-z-]+)\\s+){0,3}` +
    `(${propertyNounAlt}|${transactionNounAlt})\\b`,
    "gi",
  );

  for (const m of Array.from(prose.matchAll(claimRe))) {
    const mIdx = m.index ?? 0;
    const mEnd = mIdx + m[0].length;
    const noun = (m[2] || "").toLowerCase();
    const isTransactionNoun = PER_TRADE_TRANSACTION_NOUNS.includes(noun);

    // Look-after window for the transaction verb (property nouns) and for the
    // price (both). Verb-attached property nouns need both; transaction nouns
    // are themselves the event so only require a price.
    const after = prose.slice(mEnd, Math.min(prose.length, mEnd + 120));
    const verbMatch = isTransactionNoun ? { index: 0, length: 0 } : (() => {
      const vm = after.match(verbRe);
      return vm ? { index: vm.index ?? 0, length: vm[0].length } : null;
    })();
    if (!verbMatch) continue;

    const claimEnd = mEnd + verbMatch.index + verbMatch.length;
    const priceWindow = prose.slice(mEnd, Math.min(prose.length, claimEnd + 60));
    if (!priceRe.test(priceWindow)) continue;

    // Aggregate-signal override is enforced INSIDE the determiner→noun span
    // via the regex's negative lookahead, which already blocks "a typical X",
    // "a representative X", etc. from forming a match. A wider window check
    // was tried and caused false suppression (e.g., a prior sentence's
    // "typical price" suppressing a later legitimate fire). Span-internal
    // lookahead is the right scope.
    const ctxStart = Math.max(0, mIdx - 30);
    const ctxEnd = Math.min(prose.length, claimEnd + 40);
    const claimSpan = prose.slice(ctxStart, ctxEnd);

    // Lease vs sale side: lease/rent vocabulary in the surrounding ~50 chars
    // wins. Default is sale (the more common emission for centennial-class
    // fabrications).
    const sideCtx = prose.slice(Math.max(0, mIdx - 50), Math.min(prose.length, claimEnd + 60));
    const isLease = /\b(lease|leased|rent|rental|tenant|monthly|month|\/mo)\b/i.test(sideCtx);

    // Data-existence gate.
    const hasLeaseRecords = (input.leaseActivity?.recentRecords?.length ?? 0) > 0;
    if (isLease && hasLeaseRecords) continue;
    // Sale-side has no per-trade record set in any current input shape, so
    // the gate fires unconditionally for sale claims. If a per-trade sale
    // record field is added to StreetGeneratorInput later, add the existence
    // check here.

    findings.push({
      matchedPhrase: m[0],
      context: claimSpan.replace(/\s+/g, " ").trim(),
      side: isLease ? "lease" : "sale",
      reason: isLease
        ? `singular per-trade lease claim but input.leaseActivity.recentRecords is empty/absent — claim-type vs data-existence mismatch`
        : `singular per-trade sale claim but input exposes no per-trade sale records (only aggregates: typicalPrice, byType, quarterlyTrend) — claim-type vs data-existence mismatch`,
    });
  }

  return findings;
}

// --- Price detection ---

const DOLLAR_FIGURE = /\$(\d{1,3}(?:,\d{3})+)(?!\d)/g;
// K/M-suffix shorthand used in prose: "$425K", "$1.15M", "$2.5M". Matched
// alongside the comma-separated form so non-boundary shorthand can't slip
// past the rounding check.
const DOLLAR_SUFFIX = /\$(\d+(?:\.\d+)?)(K|M)\b/g;
// v3: widened to accept 5-digit rents ($10,500) in addition to 4-digit ($2,100)
// batch-002 (2026-07-20): reject a ",ddd" continuation so the leading "$1,120"
// of a sale figure like "$1,120,000" no longer parses as an un-rounded rent
// (the M-boundary mis-parse that repeatedly failed nakerville's homes section).
const RENT_FIGURE = /\$(\d{1,2},?\d{3})(?!\d)(?!,\d{3})/g;

function isPriceProperlyRounded(value: number): boolean {
  if (isNaN(value)) return true;
  if (value < 500_000) return value % 10_000 === 0;
  if (value < 1_000_000) return value % 25_000 === 0;
  if (value < 2_000_000) return value % 50_000 === 0;
  return value % 100_000 === 0;
}

function parseSuffixFigure(numStr: string, suffix: string): number {
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * (suffix === "M" ? 1_000_000 : 1_000));
}

function isRentProperlyRounded(figureStr: string): boolean {
  const value = parseInt(figureStr.replace(/,/g, ""), 10);
  if (isNaN(value)) return true;
  if (value < 2_500) return value % 50 === 0;
  if (value < 4_000) return value % 100 === 0;
  return value % 250 === 0;
}

function findPrecisePrice(text: string, input?: StreetGeneratorInput): string | null {
  const inputPrices = input ? collectInputPrices(input) : [];
  const inputRents = input ? collectInputRents(input) : [];
  DOLLAR_FIGURE.lastIndex = 0;
  let match;
  while ((match = DOLLAR_FIGURE.exec(text)) !== null) {
    const value = parseInt(match[1].replace(/,/g, ""), 10);
    if (value < 10_000) continue;
    if (!isPriceProperlyRounded(value)) {
      if (isPriceWithinInputTolerance(value, inputPrices) || isPriceWithinInputTolerance(value, inputRents)) continue;
      return match[0];
    }
  }
  DOLLAR_SUFFIX.lastIndex = 0;
  while ((match = DOLLAR_SUFFIX.exec(text)) !== null) {
    const value = parseSuffixFigure(match[1], match[2]);
    if (value < 10_000) continue;
    if (!isPriceProperlyRounded(value)) {
      if (isPriceWithinInputTolerance(value, inputPrices) || isPriceWithinInputTolerance(value, inputRents)) continue;
      return match[0];
    }
  }
  return null;
}

function findPreciseRent(text: string, input?: StreetGeneratorInput): string | null {
  const inputRents = input ? collectInputRents(input) : [];
  const inputPrices = input ? collectInputPrices(input) : [];
  RENT_FIGURE.lastIndex = 0;
  let match;
  while ((match = RENT_FIGURE.exec(text)) !== null) {
    const value = parseInt(match[1].replace(/,/g, ""), 10);
    if (value < 500) continue;
    if (value >= 20_000) continue;
    if (!isRentProperlyRounded(match[1])) {
      if (isPriceWithinInputTolerance(value, inputRents) || isPriceWithinInputTolerance(value, inputPrices)) continue;
      return match[0];
    }
  }
  return null;
}

// --- Batch-001 remediation rules (2026-07-19) ---

// mixed_pool_claim: the sale pool and the lease pool may never combine inside
// one claim, ratio, or derived figure (street-tier extension of the condo-tier
// transaction_type split). Patterns cover the constructions observed verbatim
// in batch-001 (gross yields, cap rates, lease-to-sale ratios, blended
// "N total transactions", "X leases against Y sales").
const MIXED_POOL_PATTERNS: RegExp[] = [
  /\bgross\s+yields?\b/i,
  /\bcap\s+rates?\b/i,
  /\byields?\s+(?:around|near|of|at|in\s+the|land(?:ing)?|sit(?:ting)?)\b/i,
  /\blease[\s-]?to[\s-]?sales?\b/i,
  /\bsale[\s-]?to[\s-]?lease\b/i,
  /\brent[\s-]?to[\s-]?price\b/i,
  /\bprice[\s-]?to[\s-]?rent\b/i,
  /\btotal\s+transactions?\b/i,
  /\b(?:split|divided)\s+between[^.!?]{0,80}\bsales?\b[^.!?]{0,80}\bleases?\b/i,
  /\b(?:split|divided)\s+between[^.!?]{0,80}\bleases?\b[^.!?]{0,80}\bsales?\b/i,
  /\bleases?\s+against\s+[^.!?]{0,40}\bsales?\b/i,
  /\bsales?\s+against\s+[^.!?]{0,40}\bleases?\b/i,
  // Batch-002 N5 gap: "24 leases versus 11 sales" slipped past the
  // "against"-shaped patterns.
  /\bleases?\s+(?:versus|vs\.?)\s+[^.!?]{0,40}\bsales?\b/i,
  /\bsales?\s+(?:versus|vs\.?)\s+[^.!?]{0,40}\bleases?\b/i,
  /\blease\s+activity\s+outpaces\s+sales?\b/i,
  /\bsales?\s+activity\s+outpaces\s+leas/i,
];

export interface MixedPoolFinding { matched: string; excerpt: string }

export function findMixedPoolClaims(text: string): MixedPoolFinding[] {
  const out: MixedPoolFinding[] = [];
  for (const re of MIXED_POOL_PATTERNS) {
    const single = new RegExp(re.source, re.flags.replace("g", ""));
    const m = single.exec(text);
    if (m) out.push({ matched: m[0], excerpt: excerptAround(text, single) });
  }
  return out;
}

// adjacency_claim: crossStreets[] entries are market-comparison streets, not
// physical neighbours. Any sentence placing one on the map relative to the
// subject street is a fabrication (batch-001 B8: "runs between Wettlaufer
// Terrace and Apple Terrace" published across mutually exclusive
// neighbourhoods).
const ADJACENCY_PHRASES =
  /\b(?:runs?\s+between|running\s+between|runs?\s+into|connects?\s+(?:to|with)|connecting\s+(?:to|with)|intersect(?:s|ing)?|at\s+the\s+corner\s+of|corner\s+of|cross[-\s]?streets?|adjoin(?:s|ing)?|abut(?:s|ting)?|branch(?:es|ing)?\s+off)\b/i;

export interface AdjacencyFinding { street: string; excerpt: string }

export function findAdjacencyClaims(
  text: string,
  crossStreets: StreetGeneratorInput["crossStreets"],
): AdjacencyFinding[] {
  if (crossStreets.length === 0) return [];
  const out: AdjacencyFinding[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!ADJACENCY_PHRASES.test(sentence)) continue;
    for (const c of crossStreets) {
      if (c.shortName && sentence.includes(c.shortName)) {
        out.push({
          street: c.shortName,
          excerpt: sentence.trim().slice(0, 160),
        });
      }
    }
  }
  return out;
}

// comparator_neighbourhood_claim (batch-002 remediation, 2026-07-20): a
// comparator's location may be stated ONLY from crossStreets[].neighbourhood.
// Batch-002 re-audit prep found Wettlaufer/Millside/Pringle asserted to be
// "in Bronte Meadows / Old Milton / Timberlea / Coates" on different pages —
// the model inferring each comparator into the HOST's neighbourhood because
// the prompts framed comparators as same-neighbourhood. This class fails
// closed: any neighbourhood name in a sentence that mentions a comparator
// must equal that comparator's supplied neighbourhood; generic
// same-neighbourhood phrasing requires the comparator's data neighbourhood to
// match the subject's. No data → no location claim of any kind.

// Suffix tokens that turn a neighbourhood word into a STREET name ("Scott
// Boulevard" must not read as a mention of the Scott neighbourhood).
const STREET_SUFFIX_LOOKAHEAD =
  "(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Crescent|Cres|Court|Crt|Ct|Lane|Ln|Way|Place|Pl|Trail|Trl|Terrace|Terr|Circle|Cir|Road|Rd|Gate|Common|Heights|Grove|Close|Walk|Hill|Ridge|Line|Parkway|Pkwy)";

// Trailing tokens stripped from a comparator shortName to get the base name
// the model may use alone in prose ("Wettlaufer Terr" -> "Wettlaufer").
const COMPARATOR_SUFFIX_TOKENS = new Set([
  "street", "st", "avenue", "ave", "boulevard", "blvd", "drive", "dr",
  "crescent", "cres", "court", "crt", "ct", "lane", "ln", "way", "place",
  "pl", "trail", "trl", "terrace", "terr", "circle", "cir", "road", "rd",
  "gate", "common", "heights", "grove", "close", "walk", "hill", "ridge",
  "line", "parkway", "pkwy",
  "n", "s", "e", "w", "north", "south", "east", "west",
]);

function comparatorBaseName(shortName: string): string {
  const tokens = shortName.trim().split(/\s+/);
  while (
    tokens.length > 1 &&
    COMPARATOR_SUFFIX_TOKENS.has(tokens[tokens.length - 1].toLowerCase().replace(/\.$/, ""))
  ) {
    tokens.pop();
  }
  return tokens.join(" ");
}

const SAME_NEIGHBOURHOOD_PHRASES =
  /\b(?:the\s+)?same\s+neighbourhood\b|\bin\s+the\s+neighbourhood\b|\belsewhere\s+in\s+the\s+neighbourhood\b/i;

function canonicalNeighbourhoodNames(
  crossStreets: StreetGeneratorInput["crossStreets"],
  inputNeighbourhoods: string[],
): string[] {
  const names = new Set<string>();
  for (const key of Object.keys(NEIGHBOURHOOD_CENTROIDS)) {
    const clean = cleanNeighbourhoodName(key).replace(/^\s*\d+\s*-\s*/, "").trim();
    if (clean) names.add(clean);
  }
  for (const n of inputNeighbourhoods) if (n) names.add(n.trim());
  for (const c of crossStreets) if (c.neighbourhood) names.add(c.neighbourhood.trim());
  // "Milton" is the town, not a neighbourhood claim.
  names.delete("Milton");
  return Array.from(names).filter((n) => n.length >= 4);
}

export interface ComparatorNeighbourhoodFinding {
  street: string;
  claimed: string;
  expected: string | null;
  excerpt: string;
}

export function findComparatorNeighbourhoodClaims(
  text: string,
  crossStreets: StreetGeneratorInput["crossStreets"],
  inputNeighbourhoods: string[],
): ComparatorNeighbourhoodFinding[] {
  if (crossStreets.length === 0) return [];
  const out: ComparatorNeighbourhoodFinding[] = [];
  const nbhdNames = canonicalNeighbourhoodNames(crossStreets, inputNeighbourhoods);
  const inputNbhdLower = new Set(inputNeighbourhoods.map((n) => n.toLowerCase()));
  const comparators = crossStreets.map((c) => ({
    ...c,
    base: comparatorBaseName(c.shortName),
  }));

  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    // Comparators referenced in this sentence — full shortName or bare base
    // name. BOTH matches are word-boundary regexes (case-sensitive, so
    // "Apple Terr"'s base doesn't fire on "apple trees"): a substring
    // includes() here made a comparator short-named "Clark" fire on every
    // mention of the subject's own "Clarke" neighbourhood (cedar-hedge,
    // regen run 2026-07-20), burning the full retry budget.
    const wordRe = (s: string) =>
      new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const mentioned = comparators.filter((c) => {
      if (c.shortName && wordRe(c.shortName).test(sentence)) return true;
      if (c.base && wordRe(c.base).test(sentence)) return true;
      return false;
    });
    if (mentioned.length === 0) continue;

    const mentionedBasesLower = new Set(mentioned.map((c) => c.base.toLowerCase()));

    // 1. Explicit neighbourhood names near a comparator mention. Each
    // neighbourhood mention is attributed to the NEAREST comparator mention
    // BEFORE it in the sentence (the natural "X in N" prose order), so a
    // two-comparator sentence where each street carries its own correct
    // neighbourhood ("Thimbleweed in Walker, or Baverstock in Clarke") is
    // judged pairwise instead of cross-firing every (street, name) combo —
    // regen run 2026-07-20 showed the cross-product version rejecting fully
    // grounded prose. A mention with NO preceding comparator in the sentence
    // is checked against ALL mentioned comparators (fail-closed).
    const comparatorPositions = mentioned.map((c) => {
      const byShort = c.shortName ? sentence.search(wordRe(c.shortName)) : -1;
      const byBase = c.base ? sentence.search(wordRe(c.base)) : -1;
      const idx = byShort >= 0 && byBase >= 0 ? Math.min(byShort, byBase) : Math.max(byShort, byBase);
      return { c, idx };
    });

    for (const name of nbhdNames) {
      // The SUBJECT's own neighbourhood legitimately appears near comparator
      // mentions as comparison context ("a lower price point than the Coates
      // area's typical") — holdsworth burned its retry budget on exactly
      // that (2026-07-20). For subject-own names, only a PLACEMENT claim
      // ("in/within/inside {N}") fires — which still catches the original
      // batch-002 defect ("both are elsewhere in Bronte Meadows"). Names
      // that are NOT the subject's own keep firing on bare mention,
      // fail-closed.
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const isSubjectOwn = inputNbhdLower.has(name.toLowerCase());
      const re = new RegExp(
        isSubjectOwn
          ? `\\b(?:in|within|inside)\\s+(?:the\\s+)?${escaped}\\b(?!\\s+${STREET_SUFFIX_LOOKAHEAD}\\b)`
          : `\\b${escaped}\\b(?!\\s+${STREET_SUFFIX_LOOKAHEAD}\\b)`,
        "gi",
      );
      // Skip when the "neighbourhood" word is actually the comparator's own
      // base name (e.g. a street named after the neighbourhood).
      if (mentionedBasesLower.has(name.toLowerCase())) continue;

      let m: RegExpExecArray | null;
      while ((m = re.exec(sentence)) !== null) {
        const nameIdx = m.index;
        // Nearest comparator mentioned BEFORE this neighbourhood name.
        let owner: (typeof comparatorPositions)[number] | null = null;
        for (const cp of comparatorPositions) {
          if (cp.idx < 0 || cp.idx >= nameIdx) continue;
          if (!owner || cp.idx > owner.idx) owner = cp;
        }
        const toCheck = owner ? [owner.c] : mentioned;
        for (const c of toCheck) {
          const ok = !!c.neighbourhood && c.neighbourhood.toLowerCase() === name.toLowerCase();
          if (!ok) {
            out.push({
              street: c.shortName,
              claimed: name,
              expected: c.neighbourhood ?? null,
              excerpt: sentence.trim().slice(0, 180),
            });
          }
        }
      }
    }

    // 2. Generic same-neighbourhood phrasing: only allowed when EVERY
    // comparator in the sentence has a data neighbourhood matching the
    // subject's own neighbourhood list.
    if (SAME_NEIGHBOURHOOD_PHRASES.test(sentence)) {
      for (const c of mentioned) {
        const ok = !!c.neighbourhood && inputNbhdLower.has(c.neighbourhood.toLowerCase());
        if (!ok) {
          out.push({
            street: c.shortName,
            claimed: "same neighbourhood (generic)",
            expected: c.neighbourhood ?? null,
            excerpt: sentence.trim().slice(0, 180),
          });
        }
      }
    }
  }

  // Dedupe on (street, claimed).
  const seen = new Set<string>();
  return out.filter((f) => {
    const key = `${f.street}|${f.claimed.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// future_period_claim (B13, docs/tickets/monthly-to-quarter-future-labels.md,
// 2026-07-20): prose must never present a period that has not completed as
// history. Batch-001/002 carried "a three-bedroom townhouse rented around
// $3,156 per month in August 2026" and "climbing to $984,500 in Q3 2026"
// written mid-July 2026. Input-side guards (sold_date <= NOW(),
// dropUnfinishedQuarters) remove the source data; this rule fails closed on
// anything that still leaks through:
//   - a quarter label (Qn YYYY / Qn 'YY) whose quarter has not ENDED, and
//   - a month-year whose month has not BEGUN (a begun-but-incomplete month
//     may carry real dated events, so it is allowed).
// `now` is injectable for deterministic tests.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const FUTURE_QUARTER_RE = /\bQ([1-4])\s*['']?\s*(\d{2,4})\b/g;
const FUTURE_MONTH_RE = new RegExp(`\\b(${MONTH_NAMES.join("|")})\\s+(\\d{4})\\b`, "g");

export interface FuturePeriodFinding { raw: string; excerpt: string; reason: string }

export function findFuturePeriodClaims(
  text: string,
  now: Date = new Date(),
): FuturePeriodFinding[] {
  const out: FuturePeriodFinding[] = [];
  const seen = new Set<string>();
  const push = (raw: string, index: number, reason: string) => {
    const key = raw.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + raw.length + 50);
    out.push({ raw, reason, excerpt: "..." + text.slice(start, end).replace(/\s+/g, " ").trim() + "..." });
  };

  FUTURE_QUARTER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FUTURE_QUARTER_RE.exec(text)) !== null) {
    const qn = parseInt(m[1], 10);
    let year = parseInt(m[2], 10);
    if (year < 100) year += 2000;
    const nextQuarterStart = qn === 4 ? Date.UTC(year + 1, 0, 1) : Date.UTC(year, qn * 3, 1);
    if (nextQuarterStart > now.getTime()) {
      push(m[0], m.index, `quarter has not ended as of ${now.toISOString().slice(0, 10)} — cannot be presented as history`);
    }
  }

  FUTURE_MONTH_RE.lastIndex = 0;
  while ((m = FUTURE_MONTH_RE.exec(text)) !== null) {
    const monthIdx = MONTH_NAMES.indexOf(m[1]);
    const year = parseInt(m[2], 10);
    const monthStart = Date.UTC(year, monthIdx, 1);
    if (monthStart > now.getTime()) {
      push(m[0], m.index, `month has not begun as of ${now.toISOString().slice(0, 10)} — cannot carry a dated event`);
    }
  }

  return out;
}

// builder_without_high_confidence, absent-builder arm: buildGeneratorInput
// deliberately omits primaryBuilder (no data pipeline exists), so ANY builder
// name in prose is a fabrication when the field is absent. Batch-001 B10:
// "Mattamy" named on 6 pages with no builder input at all.
const KNOWN_BUILDER_NAMES = [
  "Mattamy", "Great Gulf", "Fernbrook", "Heathwood", "Branthaven",
  "Primont", "Coscorp", "Arista", "Greenpark", "Sundial",
];

export function findUngroundedBuilderName(
  text: string,
  input: StreetGeneratorInput,
): string | null {
  if (input.primaryBuilder) return null; // presence case handled separately
  for (const name of KNOWN_BUILDER_NAMES) {
    if (wordBoundaryRegex(name).test(text)) return name;
  }
  return null;
}

// physical_detail_ungrounded (batch-002 P1, full comparator treatment):
// physical claims may only be stated when a supplied input field grounds them.
// The generator input carries NO era, lot, sqft, interior, or exterior fields
// today, so each pattern fires unless its (future) field is present. Scoped by
// callers to about/homes/amenities prose + era claims in FAQ answers — market
// bedroom/rent claims ground to leaseActivity and are exempt.
const PHYSICAL_ERA_PATTERNS: RegExp[] = [
  /\bbuilt\s+(?:in|around|circa|during|by)\s+(?:the\s+)?(?:early|mid|late)?[\s-]*\d{4}s?\b/i,
  /\bdate\s+from\s+the\s+(?:early|mid|late)?[\s-]*\d{4}s?\b/i,
  /\b(?:early|mid|late)[\s-]\d{4}s\s+construction\b/i,
  /\bconstruction\s+(?:wave|phase|era)\b/i,
  /\bbuilt\s+in\s+(?:one|a)\s+single\s+phase\b/i,
  /\bbuilt\s+in\s+two\s+phases\b/i,
];
const PHYSICAL_DIMENSION_PATTERNS: RegExp[] = [
  /\bfrontages?\b[^.!?]{0,60}\b(?:feet|foot|ft)\b/i,
  /\b\d{2}\s*(?:to|–|-)\s*\d{2}\s*(?:feet|foot|ft)\b/i,
  /\b\d{1,2},\d{3}\s*(?:to|–|-)\s*\d{1,2},\d{3}\s*square\s+feet\b/i,
  /\bsquare\s+(?:feet|footage)\b/i,
  /\blot\s+(?:width|depth|size)s?\b/i,
];
const PHYSICAL_FINISH_PATTERNS: RegExp[] = [
  /\b(?:hardwood|quartz|granite|ensuite|walk-in\s+closets?|open-concept|open-plan|finished\s+basements?|unfinished\s+basements?|powder\s+rooms?|crown\s+moulding|primary\s+suites?|master\s+suites?)\b/i,
  /\b(?:brick\s+and\s+(?:vinyl|stone)|stone\s+accents?|vinyl\s+siding|gabled\s+roofs?|asphalt\s+shingle|covered\s+front\s+(?:porches?|entries)|interlock(?:ing)?\s+(?:brick|walkways?))\b/i,
];

export interface PhysicalDetailFinding { matched: string; kind: string; excerpt: string }

export function findUngroundedPhysicalDetails(
  text: string,
  input: StreetGeneratorInput,
  opts?: { eraOnly?: boolean },
): PhysicalDetailFinding[] {
  const out: PhysicalDetailFinding[] = [];
  const scan = (patterns: RegExp[], kind: string) => {
    for (const re of patterns) {
      const single = new RegExp(re.source, re.flags.replace("g", ""));
      const m = single.exec(text);
      if (m) out.push({ matched: m[0], kind, excerpt: excerptAround(text, single) });
    }
  };
  scan(PHYSICAL_ERA_PATTERNS, "era"); // no input field exists for build era
  if (!opts?.eraOnly) {
    if (!input.lotSize) scan(PHYSICAL_DIMENSION_PATTERNS, "dimension");
    if (!input.dominantStyle) scan(PHYSICAL_FINISH_PATTERNS, "finish");
  }
  return out;
}

// spatial_precision_claim (batch-002 N4): distances come from NEIGHBOURHOOD
// centroids, so on-street/adjacent/doorstep/zero-minute claims about schools,
// parks, or stations are fabricated precision (the same school was published
// as "directly adjacent" to two different streets). Ban until per-street
// geocoding exists.
const SPATIAL_PRECISION =
  /\b(?:directly\s+(?:on|adjacent)|right\s+on|on\s+the\s+(?:street|lane|court|crescent|boulevard)\s+itself|zero-minute\s+walk|at\s+(?:the\s+)?(?:street'?s\s+|court'?s\s+)?doorstep|steps\s+(?:from|away)|adjacent\s+to\s+the\s+(?:street|lane|court|crescent|boulevard))\b/i;
// Case-sensitive abbreviations (PS/SS/ES) alongside case-insensitive words —
// a bare /i flag would make "es" a false-positive context everywhere.
const SPATIAL_ENTITY_CONTEXT = /\b([Ss]chool|[Pp]ark|[Cc]onservation|[Ss]tation|[Cc]entre|[Hh]ospital|[Ee]lementary|[Ss]econdary|PS|SS|ES)\b/;

export interface SpatialFinding { matched: string; excerpt: string }

export function findSpatialPrecisionClaims(text: string): SpatialFinding[] {
  const out: SpatialFinding[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!SPATIAL_ENTITY_CONTEXT.test(sentence)) continue;
    const m = SPATIAL_PRECISION.exec(sentence);
    if (m) out.push({ matched: m[0], excerpt: sentence.trim().slice(0, 160) });
  }
  return out;
}

// fair_housing_register — DETERMINISTIC FLOOR (batch-002 N1, Option C ruling
// 2026-07-20). Catches the stable constructions observed verbatim across
// batches 001-002 instantly and for free; the LLM judge in compliance.ts
// remains the actual semantic gate for paraphrases. Patterns target
// characterization of who lives, belongs, or should live on the street —
// never amenity facts ("family-sized units" / "family-oriented parks" are
// stock/amenity descriptors and stay legal; the judge adjudicates nuance).
const FAIR_HOUSING_PATTERNS: RegExp[] = [
  /\bfamily[- ]friendly\b/i,
  /\bfamily[- ]oriented\s+(?:character|atmosphere|enclave|feel|profile|street|streets|pocket|lifestyle|community|neighbourhood|market|development)\b/i,
  /\b(?:built|street)\s+for\s+family\s+life\b/i,
  /\b(?:a\s+)?street\s+built\s+for\s+famil(?:y|ies)\b/i,
  /\bneighbours?\s+(?:know|recognize)\s+(?:one\s+another|each\s+other)\b/i,
  /\bchildren\s+(?:play|still\s+ride|ride\s+bikes)\b/i,
  /\bclose[- ]knit\b/i,
  /\bdemographic/i,
  /\b(?:suits?|suited\s+(?:to|for)|appeals?\s+to|attracts?)\s+(?:young\s+)?(?:famil(?:y|ies)|first[- ]time\s+(?:buyers?|purchasers?)|downsizers?|investors?\s+alike|professionals?|retirees?|empty[- ]nesters?|long[- ]term\s+renters?)/i,
  /\bfamilies\s+and\s+(?:downsizers?|professionals?|retirees?|investors?)\s+alike\b/i,
  /\b(?:typical|the)\s+buyer\s+(?:profile|here|skews|tends|is\s+drawn)\b/i,
  /\bbuyers?\s+drawn\s+(?:here|to)\b[^.!?]{0,60}\b(?:typically|looking\s+for)\b/i,
  /\bowner[- ]occup(?:ied|ancy|iers?)\b/i,
  /\boriginal\s+owners?\s+still\b/i,
  /\b(?:anchored|transient)\s+(?:tenants?|renters?|demand)\b/i,
  /\bfamilies\s+heading\s+to\b/i,
];

export interface FairHousingFinding { matched: string; excerpt: string }

export function findFairHousingRegister(text: string): FairHousingFinding[] {
  const out: FairHousingFinding[] = [];
  for (const re of FAIR_HOUSING_PATTERNS) {
    const single = new RegExp(re.source, re.flags.replace("g", ""));
    const m = single.exec(text);
    if (m) out.push({ matched: m[0], excerpt: excerptAround(text, single) });
  }
  return out;
}

// --- Heading bank ---

const HEADING_BANK: Record<StreetSectionId, string[]> = {
  about:              ["About {name}", "{name} at a glance", "Life on {shortName}"],
  homes:              ["The homes here", "Housing stock on {shortName}", "Built form on {shortName}"],
  amenities:          ["What's nearby", "Around the corner", "Daily errands"],
  market:             ["The market right now", "Trade patterns"],
  gettingAround:      ["Getting around", "Where this street reaches", "Reaching the rest of the city"],
  // "Schools and catchment" retired 2026-07-19 (WS4 catchment ban); legacy
  // rows carrying it are renamed at render by streetContentRenderFilter.
  schools:            ["Schools nearby", "Education and schools"],
  // bestFitFor retired 2026-07-19 (fair housing). Key kept only because the
  // Record is typed over StreetSectionId, which retains the id for legacy
  // persisted rows. New outputs containing this id fail the canonical-order
  // check below.
  bestFitFor:         ["Who this street suits", "A natural fit for"],
 differentPriorities:["If different priorities matter more", "For different priorities"],
  neighbourhoodComparable: ["Comparable homes nearby", "What similar homes nearby look like"],
};

// --- Thresholds ---

const SECTION_WORD_FLOORS: Record<StreetSectionId, number> = {
  // homes floor lowered 100→55→40 on 2026-07-20 (batch-002 P1): ungrounded
  // physical detail is banned, so an honest homes section is short. The 55
  // floor caused a see-saw in the batch-003 regen (model padded back with
  // banned physical detail to clear the floor, then failed P1).
  about: 60, homes: 40, amenities: 80, market: 40,
  gettingAround: 55, schools: 45, bestFitFor: 55, differentPriorities: 55,
  // Track 2 Pass 1: DEC-PASS1-FLOOR-REVISED. Original spec set 80. Empirical
  // evidence (aird-court 2026-05-27 smoke run) showed DeepSeek converges to
  // 69-75 words on this section; 65 calibrates to that band with margin while
  // still rejecting one-liner stubs. Re-evaluate at Pass 2.
  // 65→55 on 2026-07-20: three batch-003 streets churned retries at 60-64
  // words against the 65 floor.
  neighbourhoodComparable: 55,
};
const SECTION_WORD_CEILINGS: Record<StreetSectionId, number> = {
  about: 180, homes: 350, amenities: 250, market: 350,
  gettingAround: 200, schools: 200, bestFitFor: 180, differentPriorities: 180,
  neighbourhoodComparable: 250,
};
// v4 (Phase 4.1 / Piece D): tiered total-word floors calibrated to DeepSeek
// V3 chat output distribution. Empirical smoke testing showed DeepSeek converges
// to 700-850 word output on structured 8-section + FAQ prompts regardless of
// input richness or prompt strengthening (etheridge-avenue-milton: 729w with
// salesCount=5, asleton-boulevard-milton: 825w with salesCount=24). Lowered
// floors give the model achievable targets while preserving voice-quality discipline.
// If production-ranked pages underperform at this length, raise floors and add
// retry-feedback or multi-pass generation in a future phase.
// Lowered ~130 on 2026-07-19 (bestFitFor retired) and a further ~80 on
// 2026-07-20 (batch-002 P1: homes section shrank when ungrounded physical
// detail was banned).
const TOTAL_WORD_FLOOR_FULL = 690;
const TOTAL_WORD_FLOOR_THIN = 590;
const TOTAL_WORD_FLOOR_ZERO = 540;
const TOTAL_WORD_CEILING = 2000;

/** Effective total-word floor for a given kAnonLevel. Single source of truth
 *  for callers that want to gate or recalibrate against the same threshold
 *  the validator applies. */
export function getTotalWordFloor(
  kAnonLevel: "full" | "thin" | "zero",
): number {
  return kAnonLevel === "zero"
    ? TOTAL_WORD_FLOOR_ZERO
    : kAnonLevel === "thin"
      ? TOTAL_WORD_FLOOR_THIN
      : TOTAL_WORD_FLOOR_FULL;
}

const FAQ_MIN = 6;
const FAQ_MAX = 8;
const FAQ_ANSWER_MIN_SENTENCES = 1;
const FAQ_ANSWER_MAX_SENTENCES = 5;

// bestFitFor removed from both orders 2026-07-19 (fair housing) — a new
// output containing it fails the order/section check and burns a retry.
const CANONICAL_ORDER_LEGACY: StreetSectionId[] = [
  "about","homes","amenities","market","gettingAround","schools","differentPriorities",
];
const CANONICAL_ORDER_T2: StreetSectionId[] = [
  "about","homes","amenities","market","neighbourhoodComparable","gettingAround","schools","differentPriorities",
];
// Back-compat alias for any imports outside this file
export const CANONICAL_ORDER = CANONICAL_ORDER_LEGACY;
// --- Canonical FAQ question bank ---
const FAQ_BANK_TEMPLATES: string[] = [
  "What is the typical price on {Street}?",
  "Why do homes on {Street} trade differently than other Milton streets?",
  "What price range should I expect on {Street}?",
  "How fast do homes sell on {Street}?",
  "How has the market been moving on {Street} recently?",
  "What kinds of homes are on {Street}?",
  // Lot-size + build-year questions retired 2026-07-20 (batch-002 P1):
  // answering either requires physical data the input does not carry.
  // "Which schools serve {Street}?" + catchment question retired 2026-07-19
  // (WS4 catchment ban — "serve" implies assignment; proximity phrasing only).
  "Which schools are close to {Street}?",
  "How far is {Street} from Toronto?",
  "What's the commute from {Street} to Pearson?",
  "Is {Street} close to the 401 or 407?",
  "Who built most of the homes on {Street}?",
  "Is {Street} new construction or established?",
  "What's the rental market like on {Street}?",
  "What do two-bedroom condos rent for on {Street}?",
  "Is {Street} a good fit for investors?",
  // Cap-rate question retired 2026-07-19 (answering requires mixing sale +
  // lease pools). "Who is {Street} a good fit for?" retired (fair housing).
  "If {Street} isn't the right fit, what similar streets should I look at?",
];

// --- Known anchors (for cross-street invention check) ---
// Sourced from config.ai.knownAnchors so a city fork can swap anchors via
// src/lib/config.ts. NOTE — Batch 1 regression: the original Milton-only
// hardcoded list included extra schools, parks, builders, and external anchors
// (HDSB/HCDSB, Mattamy, Pearson, Rotary Park, etc.) that are not in
// config.ai.knownAnchors today. Cross-street validator may flag references to
// those names as "invented_cross_street" until config.ai.knownAnchors is
// extended OR the per-fork extras are moved to a dedicated registry file.
// Tracked as deferred work post Batch 1.
const KNOWN_ANCHORS = config.ai.knownAnchors;

// --- Core validator ---

export function validateStreetGeneration(
  output: StreetGeneratorOutput,
  input: StreetGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];

  // Shape checks first (fail-fast)
 // Shape checks first (fail-fast)
  // Accept the 7-section layout (no neighbourhoodComparable) or the Track 2
  // 8-section layout. neighbourhoodComparable sits at index 4 (after market).
  // Counts dropped from 8/9 on 2026-07-19: bestFitFor retired (fair housing).
  if (!output.sections || (output.sections.length !== 7 && output.sections.length !== 8)) {
    violations.push({ rule: "invalid_json_shape", excerpt: `sections length = ${output.sections?.length}`, severity: "hard" });
    return violations;
  }
  const expectedOrder = output.sections.length === 8 ? CANONICAL_ORDER_T2 : CANONICAL_ORDER_LEGACY;
  for (let i = 0; i < expectedOrder.length; i++) {
    if (output.sections[i].id !== expectedOrder[i]) {
      violations.push({ rule: "missing_section_id", excerpt: `position ${i} got id "${output.sections[i].id}", expected "${expectedOrder[i]}"`, severity: "hard" });
    }
  }
  if (!output.faq || output.faq.length < FAQ_MIN || output.faq.length > FAQ_MAX) {
    violations.push({ rule: "faq_count_out_of_range", excerpt: `faq length = ${output.faq?.length}`, severity: "hard" });
  }

  // Per-section prose scan
  const allProse: string[] = [];

  for (const section of output.sections) {
    const sectionText = section.paragraphs.join("\n\n");
    allProse.push(sectionText);

    // Heading check
    const acceptable = HEADING_BANK[section.id].flatMap(tmpl => [
      tmpl.replace("{name}", input.street.name).replace("{shortName}", input.street.shortName),
    ]);
    if (!acceptable.includes(section.heading)) {
      violations.push({
        rule: "heading_out_of_bank",
        sectionId: section.id,
        excerpt: `got "${section.heading}", expected one of: ${acceptable.join(" | ")}`,
        severity: "hard",
      });
    }

    // Em-dash — enforce only on market section (other sections tolerate occasional dashes)
   if ((section.id === "market" || section.id === "neighbourhoodComparable") && EM_DASH_CHARS.test(sectionText)) {
      violations.push({
        rule: "em_dash",
        sectionId: section.id,
        excerpt: excerptAround(sectionText, EM_DASH_CHARS),
        severity: "hard",
      });
    }

    // Superlatives
    for (const phrase of SUPERLATIVE_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "superlative", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // Clichés
    for (const phrase of CLICHE_OPENERS_AND_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "cliche_opener", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // Methodology leaks. Substring pass (TREB, MLS feed, our dataset, etc.)
    // applies to every section including market. Contextual-word pass
    // (median, average, mean, statistical) applies to every section EXCEPT
    // market — in market, "days on market average around 96" is legitimate
    // analysis idiom and the validator was over-firing on it.
    const subLeak = findMethodologyLeakSubstring(sectionText);
    if (subLeak) {
      violations.push({ rule: "methodology_leak", sectionId: section.id, excerpt: subLeak.excerpt, severity: "hard" });
    }
    if (section.id !== "market" && section.id !== "neighbourhoodComparable") {
      const ctxLeak = findMethodologyLeakContextual(sectionText);
      if (ctxLeak) {
        violations.push({ rule: "methodology_leak", sectionId: section.id, excerpt: ctxLeak.excerpt, severity: "hard" });
      }
    }

    // v3: hedging emits its own rule
    for (const phrase of HEDGING_PHRASES) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (re.test(sectionText)) {
        violations.push({ rule: "hedging_builder", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // v5 (Phase 4.1 / two-call): sales-register leak. The model occasionally
    // pivots to first-person-plural advisory voice on closing lines. Caught
    // here per-section so we can route retry feedback to the right call.
    const sectionSalesLeak = findSalesRegisterLeak(sectionText);
    if (sectionSalesLeak) {
      violations.push({
        rule: "sales_register_leak",
        sectionId: section.id,
        excerpt: `${sectionSalesLeak.matchedPhrase}: ${sectionSalesLeak.excerpt}`,
        severity: "hard",
      });
    }

    // v6 (Phase 4.1 / B3 follow-up): market section template-parrot. The
    // worked example was being lifted near-verbatim across samples. Backs
    // up the prompt-side FORBIDDEN PATTERN block with a regex backstop.
    if (section.id === "market") {
      const parrotMatch = findMarketTemplateParrot(sectionText);
      if (parrotMatch) {
        violations.push({
          rule: "market_template_parrot",
          sectionId: section.id,
          excerpt: `parrot phrase "${parrotMatch.matchedPhrase}": ${parrotMatch.excerpt}`,
          severity: "hard",
        });
      }
    }

    // v7 (Phase 4.1 / Task 2): numeric grounding. Only fires on market
    // section — that's where audited fabrication patterns appear (price
    // band extrapolation, invented condition/position differentials).
    if (section.id === "market") {
      const ungrounded = findUngroundedNumerics(sectionText, input);
      for (const f of ungrounded) {
        violations.push({
          rule: "numeric_ungrounded",
          sectionId: section.id,
          excerpt: `"${f.raw}" (${f.type}) — ${f.reason}; ctx: ${f.context}`,
          severity: "hard",
        });
      }
      // v8 (Phase 4.1 / Task 3.7): temporal pairing. Catches price-quarter
      // and direction-quarter pairing fabrications that numeric_ungrounded
      // misses (the quarter exists, but the model paired it with a wrong
      // price or claimed a direction inconsistent with q-over-q data).
      const temporal = findTemporalPairings(sectionText, input);
      for (const t of temporal) {
        violations.push({
          rule: "temporal_pairing",
          sectionId: section.id,
          excerpt: `${t.type}: ${t.reason}; ctx: ${t.context}`,
          severity: "hard",
        });
      }
      // v9 (Phase 4.1 / Task 3.8 Intervention 4): qualitative grounding
      // Category A. Catches subsegment-comparative fabrications (end-unit
      // premium, older/newer construction discount, etc.) that numeric_ungrounded
      // misses when no specific dollar amount is invented.
      const qualitative = findQualitativeGroundingViolations(sectionText);
      for (const q of qualitative) {
        violations.push({
          rule: "qualitative_grounding",
          sectionId: section.id,
          excerpt: `${q.reason}; ctx: ${q.context}`,
          severity: "hard",
        });
      }
    }

    // WS5 (CHECKPOINT-2 remediation): sub-k price-band reassembly. BROADENED to
    // ALL sections (not market-only): a sub-k band is a k-anon LEAK wherever it
    // narrates (dymott leaked into "homes"). Self-gates on priceRange===null, so
    // it adds zero firing surface on full-k pages. numeric_ungrounded / per-trade
    // / temporal stay market-scoped by design — only this band block broadens.
    const subkBand = findSubkRangeReassembly(sectionText, input);
    for (const r of subkBand) {
      violations.push({
        rule: "subk_range_reassembly",
        sectionId: section.id,
        excerpt: `${r.reason}; ctx: ${r.context}`,
        severity: "hard",
      });
    }

    // Batch-001 remediation (2026-07-19) — combined-validator wiring, ALL sections:
    // catchment vocabulary (WS4 grounded-external-only), mixed sale/lease pool
    // claims, physical-adjacency claims about comparison streets, and builder
    // names with no primaryBuilder in the input. Catchment scans the heading
    // too (the retired "Schools and catchment" heading carries the word).
    const catchment = findCatchmentVocabulary(`${section.heading}\n${sectionText}`);
    if (catchment) {
      violations.push({ rule: "catchment_vocabulary", sectionId: section.id, excerpt: `"${catchment.matched}": ${catchment.excerpt}`, severity: "hard" });
    }
    for (const mp of findMixedPoolClaims(sectionText)) {
      violations.push({ rule: "mixed_pool_claim", sectionId: section.id, excerpt: `"${mp.matched}": ${mp.excerpt}`, severity: "hard" });
    }
    for (const adj of findAdjacencyClaims(sectionText, input.crossStreets)) {
      violations.push({ rule: "adjacency_claim", sectionId: section.id, excerpt: `"${adj.street}" placed physically: ${adj.excerpt}`, severity: "hard" });
    }
    for (const cn of findComparatorNeighbourhoodClaims(sectionText, input.crossStreets, input.neighbourhoods)) {
      violations.push({ rule: "comparator_neighbourhood_claim", sectionId: section.id, excerpt: `"${cn.street}" placed in "${cn.claimed}" but input.crossStreets neighbourhood is ${cn.expected ? `"${cn.expected}"` : "ABSENT (no location claim permitted)"}; ctx: ${cn.excerpt}`, severity: "hard" });
    }
    for (const fp of findFuturePeriodClaims(sectionText)) {
      violations.push({ rule: "future_period_claim", sectionId: section.id, excerpt: `"${fp.raw}": ${fp.reason}; ctx: ${fp.excerpt}`, severity: "hard" });
    }
    const ungroundedBuilder = findUngroundedBuilderName(sectionText, input);
    if (ungroundedBuilder) {
      violations.push({ rule: "builder_without_high_confidence", sectionId: section.id, excerpt: `builder "${ungroundedBuilder}" named but input has NO primaryBuilder field — fabricated attribution`, severity: "hard" });
    }
    // Batch-002 P1 + N4 (combined-validator wiring): physical detail only from
    // supplied fields (about/homes/amenities); spatial precision banned everywhere.
    if (section.id === "about" || section.id === "homes" || section.id === "amenities") {
      for (const p of findUngroundedPhysicalDetails(sectionText, input)) {
        violations.push({ rule: "physical_detail_ungrounded", sectionId: section.id, excerpt: `${p.kind}: "${p.matched}": ${p.excerpt}`, severity: "hard" });
      }
    }
    for (const fh of findFairHousingRegister(sectionText)) {
      violations.push({ rule: "fair_housing_register", sectionId: section.id, excerpt: `"${fh.matched}": ${fh.excerpt}`, severity: "hard" });
    }    for (const s of findSpatialPrecisionClaims(sectionText)) {
      violations.push({ rule: "spatial_precision_claim", sectionId: section.id, excerpt: `"${s.matched}": ${s.excerpt}`, severity: "hard" });
    }

    // v10 (Workstream 2 / Step 1): per-trade fabrication.
    // Claim-type vs data-existence check. Fires on singular-trade claims
    // (a/an/one + property-noun + transaction-verb + price) when the input
    // has no per-trade record set for that side (sale always; lease when
    // leaseActivity.recentRecords is empty). Independent of numeric-proximity
    // grounding — catches fabrications anchored to aggregate values.
    if (section.id === "market" || section.id === "neighbourhoodComparable") {
      const perTrade = findPerTradeFabrications(sectionText, input);
      for (const p of perTrade) {
        violations.push({
          rule: "per_trade_fabrication",
          sectionId: section.id,
          excerpt: `${p.side}-side: "${p.matchedPhrase}" — ${p.reason}; ctx: ${p.context}`,
          severity: "hard",
        });
      }
    }

    // Precise sale price (rounding violation)
    const preciseSalePrice = findPrecisePrice(sectionText, input);
    if (preciseSalePrice) {
      violations.push({
        rule: "precise_price",
        sectionId: section.id,
        excerpt: `sale price "${preciseSalePrice}" violates rounding rules`,
        severity: "hard",
      });
    }

    // Precise rent
    const preciseRent = findPreciseRent(sectionText, input);
    if (preciseRent) {
      violations.push({
        rule: "precise_price",
        sectionId: section.id,
        excerpt: `rent "${preciseRent}" violates rounding rules`,
        severity: "hard",
      });
    }

    // Section word floor/ceiling
    const wordCount = countWords(sectionText);
    const effectiveFloor = (section.id === "market" && input.aggregates.kAnonLevel !== "full")
      ? 30
      : SECTION_WORD_FLOORS[section.id];
    if (wordCount < effectiveFloor) {
      violations.push({ rule: "section_word_floor", sectionId: section.id, excerpt: `${wordCount} words, floor ${effectiveFloor}`, severity: "hard" });
    }
    if (wordCount > SECTION_WORD_CEILINGS[section.id]) {
      violations.push({ rule: "section_word_ceiling", sectionId: section.id, excerpt: `${wordCount} words, ceiling ${SECTION_WORD_CEILINGS[section.id]}`, severity: "hard" });
    }
  }

  // Total word count — v3: both floor and ceiling, tiered by k-anon level
  const totalWords = allProse.reduce((sum, t) => sum + countWords(t), 0);
  if (totalWords > TOTAL_WORD_CEILING) {
    violations.push({ rule: "total_word_ceiling", excerpt: `total ${totalWords}, ceiling ${TOTAL_WORD_CEILING}`, severity: "hard" });
  }
  const effectiveTotalFloor = getTotalWordFloor(input.aggregates.kAnonLevel);
  if (totalWords < effectiveTotalFloor) {
    violations.push({ rule: "total_word_floor", excerpt: `total ${totalWords}, floor ${effectiveTotalFloor} (kAnon=${input.aggregates.kAnonLevel})`, severity: "hard" });
  }

  // Cross-street invention check
  const diffPriorities = output.sections.find(s => s.id === "differentPriorities")?.paragraphs.join(" ") ?? "";
  const allowedShortNames = input.crossStreets.map(c => c.shortName);
  const candidatePhrases = extractCandidateStreetNames(diffPriorities);
  for (const phrase of candidatePhrases) {
    // Also tolerate a phrase that is a ≥2-token prefix/substring of the host
    // street's canonical name (e.g. "Main St" inside "Main Street East").
    // Requires 2+ tokens to avoid single-word false positives ("Main" alone).
    const phraseIsHostSelfReference =
      phrase.trim().split(/\s+/).length >= 2 &&
      input.street.name.toLowerCase().includes(phrase.toLowerCase());
    const isAllowed = allowedShortNames.some(s => phrase.includes(s))
      || phrase.includes(input.street.shortName)
      || phrase.includes(input.street.name)
      || phraseIsHostSelfReference
      || input.neighbourhoods.some(n => phrase.includes(n))
      || KNOWN_ANCHORS.some(a => phrase.includes(a))
      // Grounded amenity names from input.nearby are legal references — the
      // qualitative differentPriorities path explicitly directs the model to
      // describe alternatives via "proximity to specific named amenities that
      // appear in input.nearby" (pears-court pilot: "Centennial Park" burned
      // 5 retries as a false-positive invented street).
      || collectNearbyAmenityNames(input).some(a => phrase.includes(a) || a.includes(phrase));
    if (!isAllowed) {
      violations.push({
        rule: "invented_cross_street",
        sectionId: "differentPriorities",
        excerpt: phrase,
        severity: "hard",
      });
    }
  }

  // Builder at insufficient confidence
  const homesText = output.sections.find(s => s.id === "homes")?.paragraphs.join(" ") ?? "";
  if (input.primaryBuilder && input.primaryBuilder.confidence !== "high") {
    if (homesText.toLowerCase().includes(input.primaryBuilder.name.toLowerCase())) {
      violations.push({
        rule: "builder_without_high_confidence",
        sectionId: "homes",
        excerpt: `builder "${input.primaryBuilder.name}" named in prose at confidence=${input.primaryBuilder.confidence}`,
        severity: "hard",
      });
    }
  }

  // FAQ scan
  const faqText = output.faq.map(q => `${q.question} ${q.answer}`).join("\n");

  if (EM_DASH_CHARS.test(faqText)) {
    violations.push({ rule: "em_dash", excerpt: excerptAround(faqText, EM_DASH_CHARS), severity: "hard" });
  }
  const faqSale = findPrecisePrice(faqText, input);
  if (faqSale) violations.push({ rule: "precise_price", excerpt: `FAQ sale price "${faqSale}" violates rounding`, severity: "hard" });
  const faqRent = findPreciseRent(faqText, input);
  if (faqRent) violations.push({ rule: "precise_price", excerpt: `FAQ rent "${faqRent}" violates rounding`, severity: "hard" });
  const faqLeak = findMethodologyLeak(faqText);
  if (faqLeak) {
    violations.push({ rule: "methodology_leak", excerpt: faqLeak.excerpt, severity: "hard" });
  }
  // FAQ sales-register: editorial-we ("we'd note", "we observe") is
  // tolerated; promotional sales register ("our team", "reach out", etc.)
  // is caught by the same regex used for sections.
  const faqSalesLeak = findSalesRegisterLeak(faqText);
  if (faqSalesLeak) {
    violations.push({
      rule: "sales_register_leak",
      excerpt: `FAQ ${faqSalesLeak.matchedPhrase}: ${faqSalesLeak.excerpt}`,
      severity: "hard",
    });
  }

  // Batch-001 remediation (2026-07-19): FAQ answers carry the same catchment
  // and mixed-pool bans as section prose (combined-validator wiring).
  const faqCatchmentC = findCatchmentVocabulary(faqText);
  if (faqCatchmentC) {
    violations.push({ rule: "catchment_vocabulary", excerpt: `FAQ "${faqCatchmentC.matched}": ${faqCatchmentC.excerpt}`, severity: "hard" });
  }
  for (const mp of findMixedPoolClaims(faqText)) {
    violations.push({ rule: "mixed_pool_claim", excerpt: `FAQ "${mp.matched}": ${mp.excerpt}`, severity: "hard" });
  }
  // Batch-002 P1 + N4 (combined-validator FAQ wiring).
  for (const p of findUngroundedPhysicalDetails(faqText, input, { eraOnly: true })) {
    violations.push({ rule: "physical_detail_ungrounded", excerpt: `FAQ ${p.kind}: "${p.matched}": ${p.excerpt}`, severity: "hard" });
  }
  for (const fh of findFairHousingRegister(faqText)) {
    violations.push({ rule: "fair_housing_register", excerpt: `FAQ "${fh.matched}": ${fh.excerpt}`, severity: "hard" });
  }  for (const s of findSpatialPrecisionClaims(faqText)) {
    violations.push({ rule: "spatial_precision_claim", excerpt: `FAQ "${s.matched}": ${s.excerpt}`, severity: "hard" });
  }
  for (const cn of findComparatorNeighbourhoodClaims(faqText, input.crossStreets, input.neighbourhoods)) {
    violations.push({ rule: "comparator_neighbourhood_claim", excerpt: `FAQ: "${cn.street}" placed in "${cn.claimed}" but input.crossStreets neighbourhood is ${cn.expected ? `"${cn.expected}"` : "ABSENT (no location claim permitted)"}; ctx: ${cn.excerpt}`, severity: "hard" });
  }
  for (const fp of findFuturePeriodClaims(faqText)) {
    violations.push({ rule: "future_period_claim", excerpt: `FAQ "${fp.raw}": ${fp.reason}; ctx: ${fp.excerpt}`, severity: "hard" });
  }

  // v3: FAQ questions must match bank verbatim (dedicated rule)
  const allowedQuestions = new Set(
    FAQ_BANK_TEMPLATES.map(t => t.replace("{Street}", input.street.name))
  );
  for (const item of output.faq) {
    if (!allowedQuestions.has(item.question)) {
      violations.push({
        rule: "faq_question_out_of_bank",
        excerpt: `FAQ question not in bank: "${item.question}"`,
        severity: "hard",
      });
    }
  }

  // v3: FAQ answer length has its own rule
  for (const item of output.faq) {
    const sentenceCount = countSentences(item.answer);
    if (sentenceCount < FAQ_ANSWER_MIN_SENTENCES || sentenceCount > FAQ_ANSWER_MAX_SENTENCES) {
      violations.push({
        rule: "faq_answer_length",
        excerpt: `answer for "${item.question.slice(0,50)}..." has ${sentenceCount} sentences (allowed ${FAQ_ANSWER_MIN_SENTENCES}-${FAQ_ANSWER_MAX_SENTENCES})`,
        severity: "hard",
      });
    }
  }

  return violations;
}

/**
 * Run per-section validation rules on a SUBSET of sections (descriptive
 * half: about/homes/amenities/market, OR evaluative half: gettingAround/
 * schools/differentPriorities). Skips total_word_floor (combined-
 * level only), FAQ rules (separate validateFaq), and the
 * builder_without_high_confidence check (only meaningful when homes is
 * present, but harmless for descriptive call which does include homes).
 *
 * Used by the two-call architecture's per-call retry loops. The combined
 * validateStreetGeneration runs as a final sanity check on the full output.
 */
export function validateSectionsSubset(
  sections: StreetSection[],
  expectedIds: readonly StreetSectionId[],
  input: StreetGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];

  if (sections.length !== expectedIds.length) {
    violations.push({
      rule: "invalid_json_shape",
      excerpt: `sections length = ${sections.length}, expected ${expectedIds.length}`,
      severity: "hard",
    });
    return violations;
  }
  for (let i = 0; i < expectedIds.length; i++) {
    if (sections[i].id !== expectedIds[i]) {
      violations.push({
        rule: "missing_section_id",
        excerpt: `position ${i} got id "${sections[i].id}", expected "${expectedIds[i]}"`,
        severity: "hard",
      });
    }
  }

  for (const section of sections) {
    const sectionText = section.paragraphs.join("\n\n");

    const acceptable = HEADING_BANK[section.id].flatMap((tmpl) => [
      tmpl.replace("{name}", input.street.name).replace("{shortName}", input.street.shortName),
    ]);
    if (!acceptable.includes(section.heading)) {
      violations.push({
        rule: "heading_out_of_bank",
        sectionId: section.id,
        excerpt: `got "${section.heading}", expected one of: ${acceptable.join(" | ")}`,
        severity: "hard",
      });
    }

   if ((section.id === "market" || section.id === "neighbourhoodComparable") && EM_DASH_CHARS.test(sectionText)) {
      violations.push({
        rule: "em_dash",
        sectionId: section.id,
        excerpt: excerptAround(sectionText, EM_DASH_CHARS),
        severity: "hard",
      });
    }

    for (const phrase of SUPERLATIVE_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "superlative", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    for (const phrase of CLICHE_OPENERS_AND_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "cliche_opener", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // Methodology leaks. Substring pass applies to every section including
    // market. Contextual-word pass (median, average, mean, statistical)
    // applies to every section EXCEPT market — analytical-vocabulary idiom
    // like "Days on market average around 96" is legitimate market analysis.
    const subLeakSub = findMethodologyLeakSubstring(sectionText);
    if (subLeakSub) {
      violations.push({ rule: "methodology_leak", sectionId: section.id, excerpt: subLeakSub.excerpt, severity: "hard" });
    }
    if (section.id !== "market" && section.id !== "neighbourhoodComparable") {
      const ctxLeakSub = findMethodologyLeakContextual(sectionText);
      if (ctxLeakSub) {
        violations.push({ rule: "methodology_leak", sectionId: section.id, excerpt: ctxLeakSub.excerpt, severity: "hard" });
      }
    }

    for (const phrase of HEDGING_PHRASES) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (re.test(sectionText)) {
        violations.push({ rule: "hedging_builder", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    const preciseSalePrice = findPrecisePrice(sectionText, input);
    if (preciseSalePrice) {
      violations.push({ rule: "precise_price", sectionId: section.id, excerpt: `sale price "${preciseSalePrice}" violates rounding rules`, severity: "hard" });
    }

    const preciseRent = findPreciseRent(sectionText, input);
    if (preciseRent) {
      violations.push({ rule: "precise_price", sectionId: section.id, excerpt: `rent "${preciseRent}" violates rounding rules`, severity: "hard" });
    }

    // v6 (Phase 4.1 / B6 follow-up): market section template-parrot check.
    // Mirrors the wiring in the main validateStreetGeneration so the per-call
    // partial validator catches the parrot and triggers retry on the market
    // call only — instead of falling through to the combined validator as a
    // hard failure. Closes the wiring gap discovered in B6 sample 5.
    if (section.id === "market") {
      const parrotMatch = findMarketTemplateParrot(sectionText);
      if (parrotMatch) {
        violations.push({
          rule: "market_template_parrot",
          sectionId: section.id,
          excerpt: `parrot phrase "${parrotMatch.matchedPhrase}": ${parrotMatch.excerpt}`,
          severity: "hard",
        });
      }
      // v7 (Phase 4.1 / Task 2): numeric grounding. Mirrors the combined
      // validator wiring so the market call retries on its own when it
      // fabricates a number, instead of cascading to combined-level fail.
      const ungrounded = findUngroundedNumerics(sectionText, input);
      for (const f of ungrounded) {
        violations.push({
          rule: "numeric_ungrounded",
          sectionId: section.id,
          excerpt: `"${f.raw}" (${f.type}) — ${f.reason}; ctx: ${f.context}`,
          severity: "hard",
        });
      }
      // v8 (Phase 4.1 / Task 3.7): temporal pairing. Same mirror so the
      // market call retries when it pairs a quarter with the wrong price
      // or a contradictory direction.
      const temporal = findTemporalPairings(sectionText, input);
      for (const t of temporal) {
        violations.push({
          rule: "temporal_pairing",
          sectionId: section.id,
          excerpt: `${t.type}: ${t.reason}; ctx: ${t.context}`,
          severity: "hard",
        });
      }
      // v9 (Phase 4.1 / Task 3.8 Intervention 4): qualitative grounding.
      // Same mirror — the market call retries when it introduces a Cat-A
      // subsegment-comparative fabrication.
      const qualitative = findQualitativeGroundingViolations(sectionText);
      for (const q of qualitative) {
        violations.push({
          rule: "qualitative_grounding",
          sectionId: section.id,
          excerpt: `${q.reason}; ctx: ${q.context}`,
          severity: "hard",
        });
      }
    }

    // WS5 (CHECKPOINT-2 remediation): sub-k price-band reassembly — partial-
    // validator mirror, BROADENED to ALL sections (parity with the combined
    // validator) so a band leaking into any section retries on its half.
    // Self-gates on priceRange===null (sub-k≥10).
    const subkBand = findSubkRangeReassembly(sectionText, input);
    for (const r of subkBand) {
      violations.push({
        rule: "subk_range_reassembly",
        sectionId: section.id,
        excerpt: `${r.reason}; ctx: ${r.context}`,
        severity: "hard",
      });
    }

    // Batch-001 remediation (2026-07-19) — partial-validator mirror so each
    // half retries on its own: catchment vocabulary (heading included), mixed
    // sale/lease pool claims, adjacency claims about comparison streets,
    // ungrounded builder.
    const catchmentSub = findCatchmentVocabulary(`${section.heading}\n${sectionText}`);
    if (catchmentSub) {
      violations.push({ rule: "catchment_vocabulary", sectionId: section.id, excerpt: `"${catchmentSub.matched}": ${catchmentSub.excerpt}`, severity: "hard" });
    }
    for (const mp of findMixedPoolClaims(sectionText)) {
      violations.push({ rule: "mixed_pool_claim", sectionId: section.id, excerpt: `"${mp.matched}": ${mp.excerpt}`, severity: "hard" });
    }
    for (const adj of findAdjacencyClaims(sectionText, input.crossStreets)) {
      violations.push({ rule: "adjacency_claim", sectionId: section.id, excerpt: `"${adj.street}" placed physically: ${adj.excerpt}`, severity: "hard" });
    }
    for (const cn of findComparatorNeighbourhoodClaims(sectionText, input.crossStreets, input.neighbourhoods)) {
      violations.push({ rule: "comparator_neighbourhood_claim", sectionId: section.id, excerpt: `"${cn.street}" placed in "${cn.claimed}" but input.crossStreets neighbourhood is ${cn.expected ? `"${cn.expected}"` : "ABSENT (no location claim permitted)"}; ctx: ${cn.excerpt}`, severity: "hard" });
    }
    for (const fp of findFuturePeriodClaims(sectionText)) {
      violations.push({ rule: "future_period_claim", sectionId: section.id, excerpt: `"${fp.raw}": ${fp.reason}; ctx: ${fp.excerpt}`, severity: "hard" });
    }
    const ungroundedBuilderSub = findUngroundedBuilderName(sectionText, input);
    if (ungroundedBuilderSub) {
      violations.push({ rule: "builder_without_high_confidence", sectionId: section.id, excerpt: `builder "${ungroundedBuilderSub}" named but input has NO primaryBuilder field — fabricated attribution`, severity: "hard" });
    }
    // Batch-002 P1 + N4 (partial-validator mirror).
    if (section.id === "about" || section.id === "homes" || section.id === "amenities") {
      for (const p of findUngroundedPhysicalDetails(sectionText, input)) {
        violations.push({ rule: "physical_detail_ungrounded", sectionId: section.id, excerpt: `${p.kind}: "${p.matched}": ${p.excerpt}`, severity: "hard" });
      }
    }
    for (const fh of findFairHousingRegister(sectionText)) {
      violations.push({ rule: "fair_housing_register", sectionId: section.id, excerpt: `"${fh.matched}": ${fh.excerpt}`, severity: "hard" });
    }    for (const s of findSpatialPrecisionClaims(sectionText)) {
      violations.push({ rule: "spatial_precision_claim", sectionId: section.id, excerpt: `"${s.matched}": ${s.excerpt}`, severity: "hard" });
    }

    // v10 (Workstream 2 / Step 1): per-trade fabrication — partial-validator
    // mirror so the market half retries on its own when the model fabricates
    // a singular trade. Scoped to market + neighbourhoodComparable.
    if (section.id === "market" || section.id === "neighbourhoodComparable") {
      const perTrade = findPerTradeFabrications(sectionText, input);
      for (const p of perTrade) {
        violations.push({
          rule: "per_trade_fabrication",
          sectionId: section.id,
          excerpt: `${p.side}-side: "${p.matchedPhrase}" — ${p.reason}; ctx: ${p.context}`,
          severity: "hard",
        });
      }
    }

    const wordCount = countWords(sectionText);
    const effectiveFloor = (section.id === "market" && input.aggregates.kAnonLevel !== "full")
      ? 30
      : SECTION_WORD_FLOORS[section.id];
    if (wordCount < effectiveFloor) {
      violations.push({ rule: "section_word_floor", sectionId: section.id, excerpt: `${wordCount} words, floor ${effectiveFloor}`, severity: "hard" });
    }
    if (wordCount > SECTION_WORD_CEILINGS[section.id]) {
      violations.push({ rule: "section_word_ceiling", sectionId: section.id, excerpt: `${wordCount} words, ceiling ${SECTION_WORD_CEILINGS[section.id]}`, severity: "hard" });
    }
  }

  // Cross-street invention check (only meaningful if differentPriorities is in the subset)
  const diffPriorities = sections.find((s) => s.id === "differentPriorities")?.paragraphs.join(" ");
  if (diffPriorities) {
    const allowedShortNames = input.crossStreets.map((c) => c.shortName);
    const candidatePhrases = extractCandidateStreetNames(diffPriorities);
    for (const phrase of candidatePhrases) {
      const phraseIsHostSelfReference =
        phrase.trim().split(/\s+/).length >= 2 &&
        input.street.name.toLowerCase().includes(phrase.toLowerCase());
      const isAllowed = allowedShortNames.some((s) => phrase.includes(s))
        || phrase.includes(input.street.shortName)
        || phrase.includes(input.street.name)
        || phraseIsHostSelfReference
        || input.neighbourhoods.some((n) => phrase.includes(n))
        || KNOWN_ANCHORS.some((a) => phrase.includes(a))
        // Grounded amenity names from input.nearby are legal (see the mirror
        // comment in the combined validator — pears-court false positive).
        || collectNearbyAmenityNames(input).some((a) => phrase.includes(a) || a.includes(phrase));
      if (!isAllowed) {
        violations.push({ rule: "invented_cross_street", sectionId: "differentPriorities", excerpt: phrase, severity: "hard" });
      }
    }
  }

  // Builder at insufficient confidence (only if homes is in the subset)
  const homesSection = sections.find((s) => s.id === "homes");
  if (homesSection && input.primaryBuilder && input.primaryBuilder.confidence !== "high") {
    const homesText = homesSection.paragraphs.join(" ");
    if (homesText.toLowerCase().includes(input.primaryBuilder.name.toLowerCase())) {
      violations.push({
        rule: "builder_without_high_confidence",
        sectionId: "homes",
        excerpt: `builder "${input.primaryBuilder.name}" named in prose at confidence=${input.primaryBuilder.confidence}`,
        severity: "hard",
      });
    }
  }

  return violations;
}

/**
 * Run FAQ-only validation rules. Used by the evaluative half's retry loop.
 */
export function validateFaq(
  faq: StreetFAQItem[],
  input: StreetGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];

  if (!faq || faq.length < FAQ_MIN || faq.length > FAQ_MAX) {
    violations.push({ rule: "faq_count_out_of_range", excerpt: `faq length = ${faq?.length}`, severity: "hard" });
    return violations;
  }

  const faqText = faq.map((q) => `${q.question} ${q.answer}`).join("\n");

  if (EM_DASH_CHARS.test(faqText)) {
    violations.push({ rule: "em_dash", excerpt: excerptAround(faqText, EM_DASH_CHARS), severity: "hard" });
  }
  const faqSale = findPrecisePrice(faqText, input);
  if (faqSale) violations.push({ rule: "precise_price", excerpt: `FAQ sale price "${faqSale}" violates rounding`, severity: "hard" });
  const faqRent = findPreciseRent(faqText, input);
  if (faqRent) violations.push({ rule: "precise_price", excerpt: `FAQ rent "${faqRent}" violates rounding`, severity: "hard" });
  const faqLeak = findMethodologyLeak(faqText);
  if (faqLeak) violations.push({ rule: "methodology_leak", excerpt: faqLeak.excerpt, severity: "hard" });
  const faqSalesLeak = findSalesRegisterLeak(faqText);
  if (faqSalesLeak) {
    violations.push({
      rule: "sales_register_leak",
      excerpt: `FAQ ${faqSalesLeak.matchedPhrase}: ${faqSalesLeak.excerpt}`,
      severity: "hard",
    });
  }
  // WS5 (CHECKPOINT-2 remediation): sub-k price-band reassembly in the FAQ.
  // The street FAQ previously ran no numeric/band grounding; this closes the
  // 17 band-in-FAQ cases. findSubkRangeReassembly self-gates on priceRange===null
  // (sub-k≥10), so full-k streets citing a real grounded range are untouched.
  for (const r of findSubkRangeReassembly(faqText, input)) {
    violations.push({
      rule: "subk_range_reassembly",
      excerpt: `FAQ: ${r.reason}; ctx: ${r.context}`,
      severity: "hard",
    });
  }
  // Batch-001 remediation (2026-07-19): catchment vocabulary + mixed-pool
  // claims are banned in FAQ answers exactly as in section prose.
  const faqCatchment = findCatchmentVocabulary(faqText);
  if (faqCatchment) {
    violations.push({ rule: "catchment_vocabulary", excerpt: `FAQ "${faqCatchment.matched}": ${faqCatchment.excerpt}`, severity: "hard" });
  }
  for (const mp of findMixedPoolClaims(faqText)) {
    violations.push({ rule: "mixed_pool_claim", excerpt: `FAQ "${mp.matched}": ${mp.excerpt}`, severity: "hard" });
  }
  // Batch-002 P1 + N4: era claims and spatial-precision claims in FAQ answers.
  for (const p of findUngroundedPhysicalDetails(faqText, input, { eraOnly: true })) {
    violations.push({ rule: "physical_detail_ungrounded", excerpt: `FAQ ${p.kind}: "${p.matched}": ${p.excerpt}`, severity: "hard" });
  }
  for (const fh of findFairHousingRegister(faqText)) {
    violations.push({ rule: "fair_housing_register", excerpt: `FAQ "${fh.matched}": ${fh.excerpt}`, severity: "hard" });
  }  for (const s of findSpatialPrecisionClaims(faqText)) {
    violations.push({ rule: "spatial_precision_claim", excerpt: `FAQ "${s.matched}": ${s.excerpt}`, severity: "hard" });
  }
  for (const cn of findComparatorNeighbourhoodClaims(faqText, input.crossStreets, input.neighbourhoods)) {
    violations.push({ rule: "comparator_neighbourhood_claim", excerpt: `FAQ: "${cn.street}" placed in "${cn.claimed}" but input.crossStreets neighbourhood is ${cn.expected ? `"${cn.expected}"` : "ABSENT (no location claim permitted)"}; ctx: ${cn.excerpt}`, severity: "hard" });
  }
  for (const fp of findFuturePeriodClaims(faqText)) {
    violations.push({ rule: "future_period_claim", excerpt: `FAQ "${fp.raw}": ${fp.reason}; ctx: ${fp.excerpt}`, severity: "hard" });
  }

  const allowedQuestions = new Set(
    FAQ_BANK_TEMPLATES.map((t) => t.replace("{Street}", input.street.name)),
  );
  for (const item of faq) {
    if (!allowedQuestions.has(item.question)) {
      violations.push({ rule: "faq_question_out_of_bank", excerpt: `FAQ question not in bank: "${item.question}"`, severity: "hard" });
    }
  }

  for (const item of faq) {
    const sentenceCount = countSentences(item.answer);
    if (sentenceCount < FAQ_ANSWER_MIN_SENTENCES || sentenceCount > FAQ_ANSWER_MAX_SENTENCES) {
      violations.push({
        rule: "faq_answer_length",
        excerpt: `answer for "${item.question.slice(0, 50)}..." has ${sentenceCount} sentences (allowed ${FAQ_ANSWER_MIN_SENTENCES}-${FAQ_ANSWER_MAX_SENTENCES})`,
        severity: "hard",
      });
    }
  }

  return violations;
}

// --- Helpers ---

function wordBoundaryRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function excerptAround(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match) return "";
  const idx = match.index;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + match[0].length + 40);
  return "..." + text.slice(start, end) + "...";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Names from input.nearby — grounded amenities the prompts explicitly allow
 *  as qualitative reference points; never "invented streets". */
function collectNearbyAmenityNames(input: StreetGeneratorInput): string[] {
  const out: string[] = [];
  for (const p of input.nearby.parks) out.push(p.name);
  for (const s of input.nearby.schoolsPublic) out.push(s.name);
  for (const s of input.nearby.schoolsCatholic) out.push(s.name);
  for (const m of input.nearby.mosques) out.push(m.name);
  for (const g of input.nearby.grocery) out.push(g.name);
  if (input.nearby.hospital) out.push(input.nearby.hospital.name);
  if (input.nearby.goStation) out.push(input.nearby.goStation.name);
  if (input.nearby.highway) out.push(input.nearby.highway.name);
  return out;
}

function extractCandidateStreetNames(text: string): string[] {
  const re = /\b(?:[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){1,4})\b/g;
  const hits = text.match(re) ?? [];
  const ignore = ["We ", "Our ", "If ", "When ", "Where ", "The ", `${config.CITY_NAME} `, "Toronto ", "Highway "];
  return hits.filter(h => !ignore.some(ig => h.startsWith(ig.trim())));
}

// --- Retry loop wrapper ---

export async function generateWithRetry(
  input: StreetGeneratorInput,
  callModel: (
    input: StreetGeneratorInput,
    priorViolations?: ValidatorViolation[],
    priorOutput?: StreetGeneratorOutput,
  ) => Promise<StreetGeneratorOutput>,
): Promise<{ output: StreetGeneratorOutput; attemptCount: 1 | 2 | 3 | 4 | 5; violations: ValidatorViolation[] }> {
  let lastViolations: ValidatorViolation[] = [];
  let lastOutput: StreetGeneratorOutput | undefined = undefined;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const output = await callModel(
      input,
      lastViolations.length ? lastViolations : undefined,
      lastOutput,
    );
    const violations = validateStreetGeneration(output, input);
    if (violations.length === 0) {
      return { output, attemptCount: attempt as 1 | 2 | 3 | 4 | 5, violations: [] };
    }
    lastViolations = violations;
    lastOutput = output;
  }
  throw new StreetGenerationFailure(input.street.slug, lastViolations);
}

export class StreetGenerationFailure extends Error {
  constructor(public slug: string, public violations: ValidatorViolation[]) {
    super(`Street generation failed after 3 attempts for ${slug}. ${violations.length} violations.`);
  }
}

export function formatViolationsForRetry(violations: ValidatorViolation[]): string {
  const grouped: Record<string, ValidatorViolation[]> = {};
  for (const v of violations) {
    const key = v.sectionId ? `${v.rule}::${v.sectionId}` : v.rule;
    (grouped[key] ||= []).push(v);
  }
  const lines = ["Your previous output failed validation. Revise and return a new complete output addressing:"];
  for (const [, vs] of Object.entries(grouped)) {
    const first = vs[0];
    const location = first.sectionId ? ` in section "${first.sectionId}"` : "";
    const countNote = vs.length > 1 ? ` (and ${vs.length - 1} similar)` : "";
    lines.push(`- ${first.rule}${location}: ${first.excerpt}${countNote}`);
  }
  lines.push("", "Return the complete revised JSON. Do not include any prose commentary outside the JSON.");
  return lines.join("\n");
}

/**
 * Build rule-specific actionable retry feedback. Unlike the legacy
 * formatViolationsForRetry which just lists rule names + excerpts, this
 * version computes concrete fix instructions per rule:
 * - total_word_floor: per-section word math + which sections to expand
 * - section_word_floor/ceiling: which section, how many words to add/cut
 * - precise_price: the offending price + the correct rounded form
 * - faq_answer_length: which FAQ + current sentence count + target
 * - methodology_leak: the offending phrase + suggested rewrite
 * - superlative/cliche: the offending word + suggested removal
 * - invented_cross_street: which name was invented + valid options
 * - heading_out_of_bank: which section + what the approved variants are
 * - faq_count_out_of_range: current count + min/max
 * - faq_question_out_of_bank: which FAQ + valid options
 * - em_dash: which section + count
 * - hedging_builder: the offending phrase + the correct silent-or-confident rule
 *
 * Falls back to legacy generic format for any rule not specifically handled,
 * so partial coverage is safe.
 */
export function formatViolationsForRetryEnriched(
  violations: ValidatorViolation[],
  output: StreetGeneratorOutput,
  input: StreetGeneratorInput,
): string {
  if (violations.length === 0) return "";

  const lines: string[] = [
    "Your previous attempt failed validation with the following specific issues. Fix each one and return clean JSON. Do not introduce new violations while fixing these.",
    "",
  ];

  // Group violations by rule for cleaner output
  const byRule = new Map<ValidatorRule, ValidatorViolation[]>();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule)!.push(v);
  }

  for (const [rule, rulesViolations] of Array.from(byRule.entries())) {
    lines.push(...formatRuleViolations(rule, rulesViolations, output, input));
    lines.push("");
  }

  lines.push("---");
  lines.push("Return the corrected full JSON output. Do not return only the changed sections; return the complete output with all eight sections and the FAQ block.");

  return lines.join("\n");
}

function formatRuleViolations(
  rule: ValidatorRule,
  violations: ValidatorViolation[],
  output: StreetGeneratorOutput,
  input: StreetGeneratorInput,
): string[] {
  switch (rule) {
    case "total_word_floor":
      return formatTotalWordFloor(violations, output, input);
    case "section_word_floor":
    case "section_word_ceiling":
      return formatSectionWordBounds(rule, violations, output);
    case "precise_price":
      return formatPrecisePrice(violations);
    case "faq_answer_length":
      return formatFaqAnswerLength(violations);
    case "methodology_leak":
      return formatMethodologyLeak(violations);
    case "superlative":
      return formatSuperlative(violations);
    case "cliche_opener":
      return formatClicheOpener(violations);
    case "invented_cross_street":
      return formatInventedCrossStreet(violations, input);
    case "heading_out_of_bank":
      return formatHeadingOutOfBank(violations);
    case "faq_count_out_of_range":
      return formatFaqCountOutOfRange(output);
    case "faq_question_out_of_bank":
      return formatFaqQuestionOutOfBank(violations, input);
    case "em_dash":
      return formatEmDash(violations);
    case "hedging_builder":
    case "builder_without_high_confidence":
      return formatHedging(violations, input);
    case "missing_section_id":
      return formatMissingSectionId(output);
    case "numeric_ungrounded":
      return formatNumericUngrounded(violations);
    case "temporal_pairing":
      return formatTemporalPairing(violations);
    case "qualitative_grounding":
      return formatQualitativeGrounding(violations);
    case "total_word_ceiling":
      return formatTotalWordCeiling(output);
    case "catchment_vocabulary":
      return [
        `**catchment_vocabulary**: You used school catchment/boundary/assignment language. The input contains school NAMES and computed DISTANCES only — no catchment or boundary data exists in this pipeline, so any assignment claim is fabricated. Banned everywhere: "catchment", "boundary", "zoned for/to", "draws from", "feeds into", "assigned to", "school zone", "feeder school", and "draw(s) to" in school context. State proximity only ("X is N minutes away") and note that school assignment should be confirmed with the boards.`,
        ``,
        ...violations.map(v => `  - ${v.excerpt}`),
      ];
    case "mixed_pool_claim":
      return [
        `**mixed_pool_claim**: You combined the sale pool and the lease pool inside one claim. Never emit lease-to-sale ratios, gross yields, cap rates, rent-vs-price comparisons, or blended "N total transactions" sums. A sentence may cite sale figures or lease figures, never both. Rewrite with the pools in separate sentences, each sourced only from its own input fields.`,
        ``,
        ...violations.map(v => `  - ${v.excerpt}`),
      ];
    case "adjacency_claim":
      return [
        `**adjacency_claim**: You placed a comparison street from input.crossStreets[] on the map relative to the subject street. These entries are MARKET COMPARISONS, not physical neighbours — never write "runs between", "connects to", "intersects", "corner of", or "cross-street" about them. Frame them as alternatives at a different price point; state their location only per the comparator_neighbourhood_claim rule (from crossStreets[].neighbourhood, or not at all).`,
        ``,
        ...violations.map(v => `  - ${v.excerpt}`),
      ];
    case "comparator_neighbourhood_claim":
      return [
        `**comparator_neighbourhood_claim**: You stated a comparison street's location without grounding. A comparator's location comes ONLY from its input.crossStreets[].neighbourhood field, quoted exactly ("in {neighbourhood}"). If that field is absent, write NO location for that street: no neighbourhood name near its mention, no "same neighbourhood", no "elsewhere in the neighbourhood", no "both in {X}", no "nearby". Never infer a comparator's location from the subject street's neighbourhood. Rewrite the flagged sentences either quoting the supplied neighbourhood or dropping the location wording entirely.`,
        ``,
        ...violations.map(v => `  - ${v.excerpt}`),
      ];
    case "future_period_claim":
      return [
        `**future_period_claim**: You referenced a time period that has not completed as if it were history. Never name a quarter that has not ended or a month that has not begun. Only quarters present in input.quarterlyTrend may be narrated, and every dated event must come from input record months. Remove or replace the flagged period references; do not relabel them as forecasts (forecasting is also banned).`,
        ``,
        ...violations.map(v => `  - ${v.excerpt}`),
      ];
    case "invalid_json_shape":
      return [
        "**invalid_json_shape**: Your output did not match the required JSON schema. Return a single JSON object with exactly two top-level keys: `sections` (array of 7 objects, or 8 when the input carries neighbourhoodComparable) and `faq` (array of 6-8 objects). Each section has `id`, `heading`, `paragraphs[]`. Each FAQ has `question`, `answer`. No code fences, no preamble.",
      ];
    default:
      return [
        `**${rule}**: ${violations.map(v => v.excerpt).join("; ")}`,
      ];
  }
}

// ---- Per-rule formatters ----

function formatTotalWordFloor(
  _violations: ValidatorViolation[],
  output: StreetGeneratorOutput,
  input: StreetGeneratorInput,
): string[] {
  const sectionWords = new Map<string, number>();
  let total = 0;
  for (const s of output.sections) {
    const words = s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
    sectionWords.set(s.id, words);
    total += words;
  }

  const kAnon = input.aggregates.kAnonLevel;
  const floor = getTotalWordFloor(kAnon);
  const target = kAnon === "full" ? 1190 : kAnon === "thin" ? 890 : 740;
  const deficit = target - total;

  const expansionPriority: Array<{ id: string; reason: string }> = [
    { id: "homes", reason: "add detail on architectural style, exterior treatments, lot characteristics, and how the stock behaves in trade" },
    { id: "market", reason: "describe trade pace, what the quarterly trend shows, range texture, and buyer-seller dynamics" },
    { id: "amenities", reason: "add second-tier walking-distance places (grocery, parks, places of worship) and describe daily-rhythm patterns" },
    { id: "differentPriorities", reason: "expand the priority comparison with comparison streets from input.crossStreets[] (verbatim shortNames only; never as physical neighbours)" },
  ];

  const lines = [
    `**total_word_floor**: Your output produced ${total} words. The floor for kAnonLevel="${kAnon}" is ${floor} words. You need ${deficit > 0 ? `at least ${target - total} more words to reach the target of ${target}` : "to add more material"}.`,
    ``,
    `Per-section breakdown:`,
  ];

  for (const s of output.sections) {
    const wc = sectionWords.get(s.id) ?? 0;
    lines.push(`  - ${s.id}: ${wc} words`);
  }

  lines.push(``, `Expand these sections in priority order. Distribute the additional ${deficit} words across the first 2-3:`);
  let remaining = deficit;
  for (const { id, reason } of expansionPriority) {
    if (remaining <= 0) break;
    const allocation = Math.min(Math.ceil(deficit / 3), remaining);
    lines.push(`  - ${id}: add ~${allocation} words. ${reason}.`);
    remaining -= allocation;
  }

  lines.push(``, `Do not pad with caveats, methodology references, or filler. Add grounded observation about the street's actual character.`);

  return lines;
}

function formatTotalWordCeiling(
  output: StreetGeneratorOutput,
): string[] {
  let total = 0;
  for (const s of output.sections) {
    total += s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
  }
  const excess = total - 2000;
  return [
    `**total_word_ceiling**: Your output produced ${total} words, exceeding the 2,000-word ceiling by ${excess}. Trim ${excess} words. Cut from sections that ran longest, prioritizing the removal of: redundant observations across sections, hedging caveats, and overly-elaborate transitions.`,
  ];
}

function formatSectionWordBounds(
  rule: "section_word_floor" | "section_word_ceiling",
  violations: ValidatorViolation[],
  output: StreetGeneratorOutput,
): string[] {
  const lines = [`**${rule}**:`];
  for (const v of violations) {
    if (!v.sectionId) continue;
    const section = output.sections.find(s => s.id === v.sectionId);
    if (!section) continue;
    const wc = section.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
    lines.push(`  - section "${v.sectionId}" has ${wc} words. Excerpt: "${v.excerpt}". ${rule === "section_word_floor" ? `Expand by adding more grounded detail` : `Trim by combining or cutting redundant observations`}.`);
  }
  return lines;
}

function formatPrecisePrice(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**precise_price**: One or more prices in your output use MLS-precision form rather than the prose rounding rules. Specific issues:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.sectionId ? `section "${v.sectionId}": ` : ""}${v.excerpt}`);
  }
  lines.push(``, `Reference the rounding tables in the system prompt. Sale prices: under $500K → nearest $10K with band prose ("mid-$480s"); $500K-$999K → nearest $25K; $1M-$1.99M → nearest $50K with prose forms ("the low-$1Ms," "the mid-$1.3Ms," "around $1.5M"); $2M+ → nearest $100K. Rental prices: under $2,500 → nearest $50; $2,500-$4,000 → nearest $100; over $4,000 → nearest $250 with band prose ("around $4,250," "the mid-$4,000s"). Never emit a comma-separated precise price like "$3,225" or "$4,200" in customer prose; round to "$3,200" or "the mid-$4,000s".`);
  return lines;
}

function formatFaqAnswerLength(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**faq_answer_length**: One or more FAQ answers fall outside the 2-4 sentence range:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.excerpt}`);
  }
  lines.push(``, `Each FAQ answer must be 2-4 sentences inclusive. Count sentence-ending periods, question marks, and exclamation points. To trim a long answer: combine related observations using semicolons or compound clauses. To expand a short answer: add a second observation that complements the first.`);
  return lines;
}

function formatMethodologyLeak(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**methodology_leak**: One or more passages reveal how the numbers were computed. The reader should experience finished observation, not exposed plumbing. Issues:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.sectionId ? `section "${v.sectionId}": ` : ""}"${v.excerpt}"`);
  }
  lines.push(``, `Rewrite to remove statistical framing. Substitutions: "median price" → "trades around"; "average days on market" → "homes typically sit"; "sample size" → omit; "transactions drive" → omit; "the Milton average" → "Milton norm" or "comparable streets"; "days on market mean buyers" → "the deliberate pace allows buyers"; "X days to sell on average" → "homes tend to sit for around X days." Avoid mentioning timeframes like "12 months" or "quarter."`);
  return lines;
}

function formatSuperlative(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**superlative**: One or more banned superlatives appeared in your output:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.sectionId ? `section "${v.sectionId}": ` : ""}"${v.excerpt}"`);
  }
  lines.push(``, `Banned superlatives: "best," "unbeatable," "premier," "finest," "most desirable," "top-tier," "world-class," "unparalleled," "unmatched," "second to none," "nothing comes close." Note: even idiomatic uses like "in the best sense" trigger the rule. Rewrite to remove the superlative entirely. Replace with neutral descriptive language: "calm and unhurried" instead of "in the best sense"; "well-regarded" instead of "premier"; "characteristic of the area" instead of "second to none."`);
  return lines;
}

function formatClicheOpener(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**cliche_opener**: One or more banned realtor-cliché phrases appeared:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.sectionId ? `section "${v.sectionId}": ` : ""}"${v.excerpt}"`);
  }
  lines.push(``, `Banned: "welcome to," "nestled in," "tucked away," "hidden gem," "sought-after," "desirable," "charming," "stunning," "must-see," "breathtaking," "boasts," "offers the perfect blend," "lifestyle you deserve," "dream home." Rewrite the opening with concrete observation about the street itself, not generic praise.`);
  return lines;
}

function formatInventedCrossStreet(violations: ValidatorViolation[], input: StreetGeneratorInput): string[] {
  const validNames = input.crossStreets.map(cs => cs.shortName).join(", ") || "(none provided)";
  const lines = [
    `**invented_cross_street**: You named a street that is not in input.crossStreets[]. Specifically:`,
  ];
  for (const v of violations) {
    lines.push(`  - "${v.excerpt}" is not a valid cross-street.`);
  }
  lines.push(
    ``,
    `The ONLY street names allowed in section "differentPriorities" are these shortNames from input.crossStreets[]: ${validNames}.`,
    ``,
    `If you cannot place one of these into a meaningful priority-comparison sentence, rewrite the section to name NO streets at all and use the qualitative form: "buyers who weight [tradeoff] over [tradeoff] often end up in [region], and we can point to specific streets in conversation." Do not invent or guess at any other street names, even real Milton streets.`,
  );
  return lines;
}

function formatHeadingOutOfBank(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**heading_out_of_bank**: One or more section headings don't match the approved variants:`,
  ];
  for (const v of violations) {
    lines.push(`  - section "${v.sectionId}": "${v.excerpt}"`);
  }
  lines.push(
    ``,
    `Approved heading variants per section (substitute {name} or {shortName} where indicated; no other changes allowed):`,
    `  - about: "About {name}" or "{name} at a glance"`,
    `  - homes: "The homes here" or "Housing stock on {shortName}"`,
    `  - amenities: "What's nearby" or "Around the corner"`,
    `  - market: "The market right now" or "Trade patterns"`,
    `  - gettingAround: "Getting around" or "Where this street reaches"`,
    `  - schools: "Schools nearby" or "Education and schools"`,
    `  - differentPriorities: "If different priorities matter more"`,
  );
  return lines;
}

function formatFaqCountOutOfRange(output: StreetGeneratorOutput): string[] {
  return [
    `**faq_count_out_of_range**: Your FAQ has ${output.faq.length} items. The range is 6-8 inclusive. ${output.faq.length < 6 ? `Add ${6 - output.faq.length} more from the FAQ bank, drawn from underused clusters per the selection rules.` : `Remove ${output.faq.length - 8} items, prioritizing the least essential clusters first.`}`,
  ];
}

function formatFaqQuestionOutOfBank(violations: ValidatorViolation[], input: StreetGeneratorInput): string[] {
  const streetName = input.street.name;
  const lines = [
    `**faq_question_out_of_bank**: One or more FAQ questions are not from the canonical bank:`,
  ];
  for (const v of violations) {
    lines.push(`  - "${v.excerpt}"`);
  }
  lines.push(
    ``,
    `Every FAQ question must be drawn VERBATIM from the canonical bank with only "{Street}" replaced with "${streetName}". Do not paraphrase. Do not invent new questions. Refer to the FAQ bank in the system prompt for the 18 valid templates organized by cluster (PRICE, SPEED, HOUSING STOCK, SCHOOLS, COMMUTE, BUILDER, RENTAL, INVESTOR, ROUTING).`,
  );
  return lines;
}

function formatEmDash(violations: ValidatorViolation[]): string[] {
  return [
    `**em_dash**: Your output contains em-dashes (—) or en-dashes (–), which are absolutely banned. ${violations.length} occurrence${violations.length > 1 ? "s" : ""} found in: ${violations.map(v => v.sectionId).filter(Boolean).join(", ") || "the output"}. Replace every em-dash and en-dash with a comma, semicolon, period, or parenthetical phrase. Hyphen-minus (-) is allowed for compound words; em-dash (—) and en-dash (–) are not.`,
  ];
}

function formatHedging(violations: ValidatorViolation[], input: StreetGeneratorInput): string[] {
  const builder = input.primaryBuilder;
  const lines = [
    `**hedging_builder / builder_without_high_confidence**: Your output contains hedging language about builder attribution.`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.sectionId ? `section "${v.sectionId}": ` : ""}"${v.excerpt}"`);
  }
  if (builder?.confidence === "high") {
    lines.push(``, `input.primaryBuilder.confidence is "high" — name "${builder.name}" factually and once. Remove all hedging words ("likely," "probably," "appears to," "may have been," "possibly").`);
  } else {
    lines.push(``, `input.primaryBuilder.confidence is ${builder?.confidence === "medium" ? `"medium"` : "absent"} — do not name any builder at all. Describe observable patterns instead ("predominantly 2018-2021 construction," "consistent façade treatment across the block"). Remove all builder names and all hedging words.`);
  }
  return lines;
}

function formatMissingSectionId(
  output: StreetGeneratorOutput,
): string[] {
  const present = output.sections.map(s => s.id);
  // Pick expected canonical order based on whether the output is base (7) or Track 2 (8).
  // bestFitFor removed 2026-07-19 (fair housing).
  const isT2 = output.sections.length === 8 || present.includes("neighbourhoodComparable");
  const required: StreetSectionId[] = isT2
    ? ["about", "homes", "amenities", "market", "neighbourhoodComparable", "gettingAround", "schools", "differentPriorities"]
    : ["about", "homes", "amenities", "market", "gettingAround", "schools", "differentPriorities"];
  const missing = required.filter(r => !present.includes(r));
  const orderStr = required.join(", ");
  const countStr = isT2 ? "8" : "7";
  return [
    `**missing_section_id**: Your output is missing required sections or has them out of order. Missing: ${missing.length ? missing.join(", ") : "(none missing — likely a positional issue)"}. The sections array MUST contain all ${countStr} ids in canonical order: ${orderStr}. Even for kAnonLevel="zero" streets, the market section is required (collapse to one paragraph acknowledging no resale history).`,
  ];
}

function formatQualitativeGrounding(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**qualitative_grounding**: Your market section made ${violations.length} subsegment-comparative claim${violations.length === 1 ? "" : "s"} that the input data does not support. The input schema has NO by-condition, by-position, by-era, by-basement-finish, or by-lot-size fields — so any claim that "end units command a premium over interiors" or "older construction trades at a discount" or "larger lots command higher" is fabricated, regardless of whether you stated a specific number.`,
    ``,
    `Specific findings:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.excerpt}`);
  }
  lines.push(
    ``,
    `Fix: Remove every subsegment-comparative pairing. Banned constructions include any pairing of {end-unit, interior, older/newer construction, finished basement, larger/smaller lot, corner unit, end of street, north/south end} with {premium, discount, command, trade higher/lower, value higher/lower}. The qualitative versions of these claims are as ungrounded as the numeric versions — the input simply doesn't carry the data needed to support them.`,
    ``,
    `Acceptable substitute: describe the price RANGE without claiming WHY some units land where. "Townhouses on Asleton trade between $725K and $875K" is fine. "End-units in the upper end of that range" is not.`,
  );
  return lines;
}

function formatTemporalPairing(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**temporal_pairing**: Your market section paired ${violations.length} quarter mention${violations.length === 1 ? "" : "s"} with the wrong price or direction. The quarter exists in the input data, but the price you stated alongside it doesn't match the input value (price_mismatch), or the direction word you used contradicts the actual q-over-q change (direction_mismatch).`,
    ``,
    `Specific findings:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.excerpt}`);
  }
  lines.push(
    ``,
    `Fix: For each quarter mention, look at input.quarterlyTrend. The price you cite within ~50 chars of the quarter must match input.quarterlyTrend[that quarter].typical within $25K (or 5%). The direction word ("rose", "softened", "pushed higher", "declined") must agree with the actual change from the prior quarter — do not describe a quarter as "higher" if the input shows it flat or down vs the prior.`,
    ``,
    `Common failure mode: conflating two different outlier quarters. If only one quarter has a single-trade outlier price, name only THAT quarter. Do not transfer the outlier description to a different, well-trafficked quarter.`,
  );
  return lines;
}

function formatNumericUngrounded(violations: ValidatorViolation[]): string[] {
  const lines = [
    `**numeric_ungrounded**: Your market section contains ${violations.length} numeric value${violations.length === 1 ? "" : "s"} that do not trace to the input data. Every dollar amount, percentage, count, ratio, days-on-market figure, and quarter label in the market section MUST appear in the StreetGeneratorInput payload (or be a single-step derivation: yield = (lease × 12 / sale) × 100; lease-to-sale ratio = leasesCount / salesCount).`,
    ``,
    `Specific findings:`,
  ];
  for (const v of violations) {
    lines.push(`  - ${v.excerpt}`);
  }
  lines.push(
    ``,
    `Fix: For each ungrounded numeric, either remove it or replace with qualitative language. Do not invent specific dollar amounts, percentages, or counts to satisfy structural slots in the prompt — if the input data does not provide a number, write the analysis qualitatively (e.g., "end units typically command a premium" instead of "$X premium").`,
    ``,
    `Banned patterns: any "$X premium" / "$X differential" / "X% premium" / "X-Y% premium over older stock" — the input schema has no condition/position/era price split, so these constructions are always fabricated.`,
  );
  return lines;
}
