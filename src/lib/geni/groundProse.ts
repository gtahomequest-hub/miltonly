// src/lib/geni/groundProse.ts
// GENI Phase 3 — GUARD 1: the grounding gate + a deterministic format gate for the
// explanation prose. Reuses the street validator's numeric primitives (extractNumerics,
// parseDollarTokenForGrounding, isPriceWithinInputTolerance) but grounds against the
// match's STABLE drivers pool — NOT a StreetGeneratorInput.
//
// DEC-GENI-11: the allowed pool is { typical price, GO km, sold_12mo volume, dom_avg }.
// It deliberately EXCLUDES the live active count — so any count the model states about
// what is "listed now / available / for sale" is, by construction, ungrounded and MUST
// fire. Present-tense inventory claims fire regardless of value; every other numeric
// (dollar, past-year volume, days, km, percent, ratio, year) is checked against the pool.
import {
  extractNumerics,
  parseDollarTokenForGrounding,
  isPriceWithinInputTolerance,
} from "@/lib/ai/validateStreetGeneration";

/** The numbers the prose is allowed to state. Built from the stable nightly drivers only. */
export interface GroundingPool {
  prices: number[]; // typical for the requested type (empty for rural_hub / rent / no data)
  volumes: number[]; // sold_12mo (empty for rent)
  doms: number[]; // dom_avg (empty for rent)
  kms: number[]; // dist_go_km
}

export interface GroundingHit {
  raw: string;
  reason: string;
}

// Present-tense inventory vocabulary → refers to the LIVE active count, which is never in
// the payload (DEC-GENI-11). A number in this context is ungrounded by construction.
const LIVE_COUNT_RE =
  /\b\d+\s+(?:listed|active|available|for\s+sale|on\s+the\s+market)\b|\b(?:currently|now|right\s+now)\s+\d+\b|\b\d+\s+(?:homes?|properties|units?|listings?)\s+(?:are\s+)?(?:listed|available|for\s+sale|on\s+the\s+market)\b/gi;

const COUNT_TOL = (c: number) => Math.max(2, c * 0.05);
const KM_TOL = 0.3;

function firstInt(raw: string): number | null {
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
function withinCount(v: number, pool: number[]): boolean {
  return pool.some((c) => Math.abs(v - c) <= COUNT_TOL(c));
}

/**
 * Scan prose for numerics not grounded in the drivers pool. Empty array = clean.
 * Fail direction: when in doubt about a numeric TYPE with no pool basis
 * (percent/ratio/year/quarter), fire — GENI prose has no methodology to cite them from.
 */
export function findUngroundedInDrivers(prose: string, pool: GroundingPool): GroundingHit[] {
  const hits: GroundingHit[] = [];

  // (a) Live-count / present-inventory claims — always ungrounded (DEC-GENI-11).
  LIVE_COUNT_RE.lastIndex = 0;
  let lm: RegExpExecArray | null;
  while ((lm = LIVE_COUNT_RE.exec(prose))) {
    hits.push({ raw: lm[0].trim(), reason: "live active-count claim — the payload has no live count (DEC-GENI-11)" });
  }

  // (b) Distance to the GO — extractNumerics has no km pattern, scan explicitly.
  const kmRe = /\b(\d+(?:\.\d+)?)\s*km\b/gi;
  let km: RegExpExecArray | null;
  while ((km = kmRe.exec(prose))) {
    const v = parseFloat(km[1]);
    if (!Number.isFinite(v)) continue;
    if (!pool.kms.some((k) => Math.abs(v - k) <= KM_TOL)) {
      hits.push({ raw: km[0], reason: `${v} km not within ${KM_TOL}km of GO distance {${pool.kms.join(",") || "none"}}` });
    }
  }

  // (c) Tokenised numerics (dollar / count / days / percent / ratio / year / quarter).
  for (const n of extractNumerics(prose)) {
    if (n.type === "dollar") {
      const v = parseDollarTokenForGrounding(n.raw);
      if (v === null) continue;
      if (!isPriceWithinInputTolerance(v, pool.prices)) {
        hits.push({ raw: n.raw, reason: `${v} not within tolerance of typical price {${pool.prices.join(",") || "none"}}` });
      }
    } else if (n.type === "count") {
      const v = firstInt(n.raw);
      if (v === null) continue;
      if (!withinCount(v, pool.volumes)) {
        hits.push({ raw: n.raw, reason: `count ${v} not in past-year volume {${pool.volumes.join(",") || "none"}}` });
      }
    } else if (n.type === "days") {
      const v = firstInt(n.raw);
      if (v === null) continue;
      if (!withinCount(v, pool.doms)) {
        hits.push({ raw: n.raw, reason: `${v} days not near avg days-on-market {${pool.doms.join(",") || "none"}}` });
      }
    } else if (n.type === "percent" || n.type === "ratio" || n.type === "year" || n.type === "quarter") {
      hits.push({ raw: n.raw, reason: `${n.type} has no grounding in the drivers payload` });
    }
  }
  return hits;
}

export interface FormatIssue {
  reason: string;
}

const SUPERLATIVES = /\b(best|greatest|premier|finest|unbeatable|prestigious|top-rated|most\s+desirable|second\s+to\s+none)\b/i;

// DEC-GENI-11 EXTENSION: current-availability is deterministic-card-only. The prose may make
// NO present-inventory claim, numeric OR qualitative. PAST sales ("N sold last year") and days
// on market stay allowed — those are stable drivers. "on the market" is exempted only in the
// DOM idiom "days on the market".
const AVAILABILITY_BANS: Array<{ re: RegExp; label: string }> = [
  { re: /\bavailable\b/i, label: "available" },
  { re: /\blisted\b/i, label: "listed" },
  { re: /\bfor\s+sale\b/i, label: "for sale" },
  { re: /\binventor(?:y|ies)\b/i, label: "inventory" },
  { re: /\bon\s+offer\b/i, label: "on offer" },
  { re: /(?<!days\s)\bon\s+the\s+market\b/i, label: "on the market" },
  { re: /\b(?:limited|few|plenty|scarce|sparse|ample|handful)\b[^.]{0,24}\b(?:home|homes|inventory|listing|listings|supply|selection|options?|properties|units?)\b/i, label: "availability quantifier + supply" },
  { re: /\b(?:home|homes|inventory|listing|listings|supply|selection|options?|properties|units?)\b[^.]{0,24}\b(?:are\s+)?(?:limited|few|plentiful|plenty|scarce|sparse|ample)\b/i, label: "supply + availability quantifier" },
];

/** DEC-GENI-11: present-availability language, numeric or qualitative. Empty = clean. */
export function findAvailabilityClaims(prose: string): string[] {
  const hits: string[] = [];
  for (const { re, label } of AVAILABILITY_BANS) if (re.test(prose)) hits.push(label);
  return hits;
}

/**
 * GUARD 0 (cheap, deterministic): enforce the hard length cap and the boutique-voice
 * bans the model routinely violates (em-dash, "median", superlatives). A format failure
 * is a pipeline failure → retry → deterministic fallback.
 */
export function checkFormat(prose: string): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const words = prose.trim().split(/\s+/).filter(Boolean).length;
  // Count only sentence-terminating punctuation (followed by whitespace or end) — a bare
  // "." inside a decimal like $1.0M or "1.5 km" must NOT register as a sentence break.
  const sentences = (prose.match(/[.!?]+(?=\s|$)/g) ?? []).length;
  if (words < 10) issues.push({ reason: `too short (${words} words)` });
  if (words > 70) issues.push({ reason: `over length cap (${words} words > 70)` });
  if (sentences > 3) issues.push({ reason: `too many sentences (${sentences} > 3)` });
  if (/[—–]/.test(prose)) issues.push({ reason: "contains an em/en dash (voice ban)" });
  if (/\bmedian\b/i.test(prose)) issues.push({ reason: "says 'median' (use 'typical')" });
  if (SUPERLATIVES.test(prose)) issues.push({ reason: `contains a superlative (${prose.match(SUPERLATIVES)?.[0]})` });
  for (const a of findAvailabilityClaims(prose)) {
    issues.push({ reason: `present-availability language ("${a}") — availability is deterministic-card-only (DEC-GENI-11)` });
  }
  return issues;
}
