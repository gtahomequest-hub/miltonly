// src/lib/ai/roundPricesInOutput.ts
//
// Programmatic post-processor that rounds price tokens in Phase 4.1
// generator output to the validator's tier-aware multiples. Runs after
// JSON parse + shape narrowing + FAQ trim, before validateStreetGeneration.
// Eliminates `precise_price` as a failure mode the same way trimFaqAnswers
// eliminated FAQ over-cap: deterministic, inspectable, no LLM in the loop.
//
// Tier rules (must match validator's isPriceProperlyRounded /
// isRentProperlyRounded — single source of truth via shared constants):
//
//   Sale prices (>= $10,000):
//     <  $500,000        → multiples of $10,000
//     $500K - $999,999   → multiples of $25,000
//     $1M - $1,999,999   → multiples of $50,000
//     >= $2,000,000      → multiples of $100,000
//
//   Rent prices (< $10,000, default range $500-$10K):
//     <  $2,500          → multiples of $50
//     $2,500 - $3,999    → multiples of $100
//     >= $4,000          → multiples of $250
//
// Token formats handled:
//   "$880,000"       comma form
//   "$1,130,000"     comma form
//   "$1.13M"         M-suffix form
//   "$425K"          K-suffix form
//   "$2,950"         comma form (rent-sized)
//
// Format preservation:
//   - M-suffix in → M-suffix out (e.g. "$1.13M" → "$1.15M", not "$1,150,000")
//   - K-suffix in → K-suffix out
//   - comma in → comma out
//
// Sale-vs-rent disambiguation: by value alone. Values >= $10K are sale,
// values < $10K are rent. Matches the validator's existing detection logic
// (DOLLAR_FIGURE skips < $10K for sale checks, RENT_FIGURE skips >= $20K).
// Real Milton rents are $1,500–$5,000/month; real Milton sales start
// $400K+. The threshold cleanly separates the two.

import type { StreetGeneratorOutput, StreetSectionId } from "@/types/street-generator";

interface Tier {
  upperExclusive: number;
  multiple: number;
}

const SALE_TIERS: Tier[] = [
  { upperExclusive: 500_000, multiple: 10_000 },
  { upperExclusive: 1_000_000, multiple: 25_000 },
  { upperExclusive: 2_000_000, multiple: 50_000 },
  { upperExclusive: Infinity, multiple: 100_000 },
];

const RENT_TIERS: Tier[] = [
  { upperExclusive: 2_500, multiple: 50 },
  { upperExclusive: 4_000, multiple: 100 },
  { upperExclusive: Infinity, multiple: 250 },
];

const SALE_THRESHOLD = 10_000;

function pickTier(value: number, tiers: Tier[]): Tier {
  for (const t of tiers) {
    if (value < t.upperExclusive) return t;
  }
  return tiers[tiers.length - 1];
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

function isSale(value: number): boolean {
  return value >= SALE_THRESHOLD;
}

function roundPrice(value: number): { rounded: number; tier: Tier; sale: boolean } {
  const sale = isSale(value);
  const tier = pickTier(value, sale ? SALE_TIERS : RENT_TIERS);
  return { rounded: roundToMultiple(value, tier.multiple), tier, sale };
}

function tierLabel(value: number, sale: boolean): string {
  if (sale) {
    if (value < 500_000) return "<$500K/$10K";
    if (value < 1_000_000) return "$500K-$999K/$25K";
    if (value < 2_000_000) return "$1M-$2M/$50K";
    return "$2M+/$100K";
  }
  if (value < 2_500) return "<$2.5K/$50";
  if (value < 4_000) return "$2.5K-$4K/$100";
  return "$4K+/$250";
}

// ---- Format helpers (match input form on output) ----

function formatM(value: number): string {
  const m = value / 1_000_000;
  // Up to 2 decimals, strip trailing zeros.
  const s = m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `$${s}M`;
}

function formatK(value: number): string {
  const k = Math.round(value / 1_000);
  return `$${k}K`;
}

function formatComma(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

type Format = "M" | "K" | "comma";

function reformat(value: number, format: Format): string {
  switch (format) {
    case "M": return formatM(value);
    case "K": return formatK(value);
    case "comma": return formatComma(value);
  }
}

// ---- Price token detection ----

interface PriceMatch {
  start: number;
  end: number;
  raw: string;
  value: number;
  format: Format;
}

function findPriceTokens(text: string): PriceMatch[] {
  const matches: PriceMatch[] = [];
  const claimedRanges: Array<[number, number]> = [];

  // 1. M/K suffix form: $1.13M, $425K. Word boundary at end so "$1.5MM" doesn't match.
  const suffixRe = /\$(\d+(?:\.\d+)?)([KM])\b/g;
  let m: RegExpExecArray | null;
  while ((m = suffixRe.exec(text)) !== null) {
    const num = parseFloat(m[1]);
    if (!Number.isFinite(num)) continue;
    const value = Math.round(num * (m[2] === "M" ? 1_000_000 : 1_000));
    const start = m.index;
    const end = start + m[0].length;
    matches.push({ start, end, raw: m[0], value, format: m[2] === "M" ? "M" : "K" });
    claimedRanges.push([start, end]);
  }

  // 2. Comma form: $880,000, $1,130,000, $2,950. Excludes ranges already
  //    captured by suffix form (e.g. "$1,000,000" should not also match if
  //    something else already claimed it; suffix runs first since it's
  //    less ambiguous).
  const commaRe = /\$(\d{1,3}(?:,\d{3})+)(?!\d)/g;
  while ((m = commaRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const overlaps = claimedRanges.some(([s, e]) => start < e && end > s);
    if (overlaps) continue;
    const value = parseInt(m[1].replace(/,/g, ""), 10);
    if (!Number.isFinite(value)) continue;
    matches.push({ start, end, raw: m[0], value, format: "comma" });
    claimedRanges.push([start, end]);
  }

  // 3. Bare 4-digit rent without comma: $2950. Lower-priority so we don't
  //    misfire on "1234" being part of an MLS code or address. Only matches
  //    isolated 4-digit dollar amounts in the rent range.
  const bareRe = /\$(\d{4})(?!\d)/g;
  while ((m = bareRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const overlaps = claimedRanges.some(([s, e]) => start < e && end > s);
    if (overlaps) continue;
    const value = parseInt(m[1], 10);
    if (!Number.isFinite(value)) continue;
    if (value < 500 || value >= 10_000) continue; // outside plausible rent range
    matches.push({ start, end, raw: m[0], value, format: "comma" });
    claimedRanges.push([start, end]);
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

// ---- Public API ----

interface Change {
  from: string;
  to: string;
  valueFrom: number;
  valueTo: number;
  sale: boolean;
  tierLabel: string;
}

interface RoundResult {
  text: string;
  changes: Change[];
}

function roundPricesInString(text: string): RoundResult {
  const matches = findPriceTokens(text);
  if (matches.length === 0) return { text, changes: [] };

  const changes: Change[] = [];
  // Process in reverse so earlier indices don't shift.
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const { rounded, sale } = roundPrice(m.value);
    if (rounded === m.value) continue;
    const newToken = reformat(rounded, m.format);
    result = result.slice(0, m.start) + newToken + result.slice(m.end);
    changes.unshift({
      from: m.raw,
      to: newToken,
      valueFrom: m.value,
      valueTo: rounded,
      sale,
      tierLabel: tierLabel(m.value, sale),
    });
  }
  return { text: result, changes };
}

/**
 * Round every sale and rent price token in the generator's output to the
 * validator's tier-aware multiples. Returns a new output; input is not
 * mutated. Logs every replacement to console.
 */
export function roundPricesInOutput(output: StreetGeneratorOutput): StreetGeneratorOutput {
  const newSections = output.sections.map((s) => {
    const newParagraphs = s.paragraphs.map((p) => {
      const r = roundPricesInString(p);
      for (const c of r.changes) {
        console.log(
          `[roundPrices] section=${s.id as StreetSectionId} '${c.from}' → '${c.to}' ` +
          `(${c.sale ? "sale" : "rent"}, ${c.tierLabel})`
        );
      }
      return r.text;
    });
    return { ...s, paragraphs: newParagraphs };
  });

  const newFaq = output.faq.map((f, i) => {
    const r = roundPricesInString(f.answer);
    for (const c of r.changes) {
      console.log(
        `[roundPrices] faq[${i}] '${c.from}' → '${c.to}' ` +
        `(${c.sale ? "sale" : "rent"}, ${c.tierLabel})`
      );
    }
    return { ...f, answer: r.text };
  });

  return { sections: newSections, faq: newFaq };
}

// Exposed for unit tests only.
export const __test__ = {
  findPriceTokens,
  roundPricesInString,
  roundPrice,
};
