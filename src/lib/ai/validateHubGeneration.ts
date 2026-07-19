// src/lib/ai/validateHubGeneration.ts
// WS4 (DEC-WS4-3, ADR 0002) — hub-tier validator.
//
// Net-new rule: `comparison_mismatch`. The cross-sectional cousin of W2's
// `direction_mismatch` (findTemporalPairings). For any comparison verb in the
// compared-to-milton section ("runs above / below / in line with the rest of
// Milton"), it asserts:
//   (a) BOTH the neighbourhood side and the Milton side are present in the input
//       (k-anon gated typicalPrice / daysOnMarket), and
//   (b) the asserted direction matches the actual aggregate delta.
// It mirrors the widened findTemporalPairings sweep (DEC-GROUNDING-GATE §3):
// collect ALL candidate metric readings in the verb's window; accept if ANY
// supports the stated direction; fire only when none does.
//
// Everything else the hub validator needs is the W2 gate RE-POINTED at hub-tier
// input via a thin adapter (no aggregation logic re-derived): per-trade
// fabrication + numeric grounding + temporal pairing run on the liveMarket
// section, exactly as they run on the street market section. This is the
// principle in DEC-WS4: "the only genuinely net-new validator rule in WS4 is
// comparison_mismatch."

import type {
  StreetGeneratorInput,
  ValidatorViolation,
} from "@/types/street-generator";
import type {
  HubSection,
  HubGeneratorInput,
  MiltonWideContext,
} from "@/types/hub-generator";
import {
  findUngroundedNumerics,
  findTemporalPairings,
  findPerTradeFabrications,
  findSubkRangeReassembly,
} from "@/lib/ai/validateStreetGeneration";
import { findCatchmentVocabulary } from "@/lib/ai/catchmentVocabulary";
import type { HubFAQItem } from "@/types/hub-generator";

// ---------------------------------------------------------------------------
// Comparison vocabulary. Each verb asserts a direction on one axis.
//   price-up   = neighbourhood pricier than Milton
//   price-down = neighbourhood cheaper than Milton
//   in-line    = roughly level with Milton (flat on any axis)
//   pace-fast  = neighbourhood sells faster (lower DOM) than Milton
//   pace-slow  = neighbourhood sells slower (higher DOM) than Milton
// ---------------------------------------------------------------------------

type Asserted = "price-up" | "price-down" | "in-line" | "pace-fast" | "pace-slow";

const COMPARISON_VERBS: Array<{ re: RegExp; asserted: Asserted }> = [
  // in-line first so "in line with" wins its span before "above/below" fragments.
  { re: /\b(in line with|on par with|comparable to|consistent with|level with|in step with|roughly matches|mirrors|tracks|broadly matches)\b/gi, asserted: "in-line" },
  { re: /\b(sells? faster|moves? faster|clears? faster|faster than|quicker than|turn(?:s)? over faster)\b/gi, asserted: "pace-fast" },
  { re: /\b(sells? slower|moves? slower|slower than|takes? longer than|linger(?:s)? longer|sit(?:s)? longer)\b/gi, asserted: "pace-slow" },
  { re: /\b(above|higher than|exceeds?|outpaces?|outperforms?|richer than|pricier than|more expensive than|steeper than|commands? a premium|sit(?:s)? above|run(?:s)? above|trade(?:s)? above|stronger than)\b/gi, asserted: "price-up" },
  { re: /\b(below|lower than|cheaper than|more affordable than|softer than|trails?|lags?|a discount to|less expensive than|sit(?:s)? below|run(?:s)? below|trade(?:s)? below|gentler than|more accessible than)\b/gi, asserted: "price-down" },
];

// Milton-side anchor — the comparison must reference the wider Milton market.
// Without it the verb is an intra-neighbourhood claim, not our gate.
const MILTON_ANCHOR =
  /\b(the rest of milton|across milton|milton-wide|citywide|city-wide|the wider milton(?:\s+market)?|the broader milton(?:\s+market)?|the milton (?:average|norm|median|market)|other milton neighbourhoods|milton (?:overall|as a whole)|elsewhere in milton|the city overall)\b/i;

const WINDOW = 90; // chars between verb and Milton anchor

export interface ComparisonFinding {
  verb: string;
  asserted: Asserted;
  context: string;
  reason: string;
  type: "side_ungrounded" | "direction_mismatch";
}

type Dir = "up" | "down" | "flat" | "none";

function priceDelta(nbhd: number | null, milton: number | null): Dir {
  if (nbhd === null || milton === null || milton === 0) return "none";
  const tol = Math.max(25_000, milton * 0.05);
  const d = nbhd - milton;
  if (d > tol) return "up";
  if (d < -tol) return "down";
  return "flat";
}

function paceDelta(nbhd: number | null, milton: number | null): Dir {
  // Lower DOM = faster. Map faster→"up" (neighbourhood "ahead"), slower→"down".
  if (nbhd === null || milton === null) return "none";
  const tol = 3; // days
  const d = milton - nbhd; // positive ⇒ nbhd faster
  if (d > tol) return "up";   // faster
  if (d < -tol) return "down"; // slower
  return "flat";
}

/**
 * Detect comparison_mismatch in compared-to-milton prose. Pure function over
 * (prose, hub input, milton-wide context) so it is unit-testable in isolation.
 */
export function findComparisonMismatch(
  prose: string,
  input: HubGeneratorInput,
  milton: MiltonWideContext,
): ComparisonFinding[] {
  const findings: ComparisonFinding[] = [];
  const seen = new Set<string>();

  // Grounded deltas, computed once.
  const price = priceDelta(input.aggregates.typicalPrice, milton.aggregates.typicalPrice);
  const pace = paceDelta(input.aggregates.daysOnMarket, milton.aggregates.daysOnMarket);

  const priceSidesPresent =
    input.aggregates.typicalPrice !== null && milton.aggregates.typicalPrice !== null;
  const paceSidesPresent =
    input.aggregates.daysOnMarket !== null && milton.aggregates.daysOnMarket !== null;

  for (const { re, asserted } of COMPARISON_VERBS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prose)) !== null) {
      const verb = m[0];
      const idx = m.index;
      const winStart = Math.max(0, idx - WINDOW);
      const winEnd = Math.min(prose.length, idx + verb.length + WINDOW);
      const window = prose.slice(winStart, winEnd);

      // Require a Milton anchor in the window — else it's intra-nbhd, not our gate.
      if (!MILTON_ANCHOR.test(window)) continue;

      const key = `${asserted}|${idx}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const ctxStart = Math.max(0, idx - 40);
      const ctxEnd = Math.min(prose.length, idx + verb.length + 50);
      const context = prose.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim();

      // Which axis does this verb assert on, and is that axis grounded on both sides?
      const isPaceVerb = asserted === "pace-fast" || asserted === "pace-slow";
      const isInLine = asserted === "in-line";

      // (a) Side-present gate. in-line may ground on EITHER axis; price/pace verbs
      // need their own axis. Fire side_ungrounded only when no candidate axis is
      // grounded for the asserted reading.
      const axisGrounded = isInLine
        ? priceSidesPresent || paceSidesPresent
        : isPaceVerb
          ? paceSidesPresent
          : priceSidesPresent;

      if (!axisGrounded) {
        findings.push({
          verb,
          asserted,
          context,
          type: "side_ungrounded",
          reason:
            `comparison "${verb}" vs the rest of Milton, but the required aggregate is not present on both sides ` +
            `(nbhd typicalPrice=${fmt(input.aggregates.typicalPrice)}, milton typicalPrice=${fmt(milton.aggregates.typicalPrice)}; ` +
            `nbhd DOM=${fmt(input.aggregates.daysOnMarket)}, milton DOM=${fmt(milton.aggregates.daysOnMarket)}). ` +
            `A comparison verb requires both sides grounded (DEC-WS4-3).`,
        });
        continue;
      }

      // (b) Direction gate — widened candidate sweep. Collect every grounded
      // metric reading and accept if ANY supports the asserted direction.
      const candidates: Dir[] = [];
      if (priceSidesPresent) candidates.push(price);
      if (paceSidesPresent) candidates.push(pace);

      const supports = candidates.some((c) => directionSupports(asserted, c));
      if (supports) continue;

      findings.push({
        verb,
        asserted,
        context,
        type: "direction_mismatch",
        reason:
          `comparison "${verb}" asserts ${asserted} vs the rest of Milton, but no grounded aggregate delta supports it ` +
          `(price: nbhd ${fmt(input.aggregates.typicalPrice)} vs milton ${fmt(milton.aggregates.typicalPrice)} → ${price}; ` +
          `pace: nbhd ${fmt(input.aggregates.daysOnMarket)}d vs milton ${fmt(milton.aggregates.daysOnMarket)}d → ${pace}).`,
      });
    }
  }

  return findings;
}

function directionSupports(asserted: Asserted, actual: Dir): boolean {
  switch (asserted) {
    case "price-up":
      return actual === "up";
    case "price-down":
      return actual === "down";
    case "pace-fast":
      return actual === "up"; // paceDelta maps faster→up
    case "pace-slow":
      return actual === "down";
    case "in-line":
      return actual === "flat";
  }
}

function fmt(n: number | null): string {
  return n === null ? "null" : n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Adapter — re-point the W2 street-tier grounding rules at hub-tier input with
// no logic duplication. The W2 detectors only read aggregates / byType /
// quarterlyTrend / activeListingsCount / neighbourhoods, all of which the hub
// input carries in a structurally-compatible shape.
// ---------------------------------------------------------------------------

export function hubInputToStreetAdapter(input: HubGeneratorInput): StreetGeneratorInput {
  return {
    street: {
      name: input.neighbourhood.name,
      slug: input.neighbourhood.slug,
      shortName: input.neighbourhood.name,
      type: "neighbourhood",
      identityKey: `${input.neighbourhood.slug}|`,
      siblingSlugs: [input.neighbourhood.slug],
      direction: "",
    },
    neighbourhoods: [input.neighbourhood.name],
    aggregates: {
      salesCount: input.aggregates.salesCount,
      leasesCount: input.aggregates.leasesCount,
      typicalPrice: input.aggregates.typicalPrice,
      priceRange: input.aggregates.priceRange,
      daysOnMarket: input.aggregates.daysOnMarket,
      kAnonLevel: input.aggregates.kAnonLevel,
    },
    byType: input.byType,
    quarterlyTrend: input.quarterlyTrend
      .filter((q) => q.typical !== null)
      .map((q) => ({ quarter: q.quarter, typical: q.typical as number, count: q.count })),
    nearby: {
      parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [],
    },
    commute: {
      toTorontoDowntown: { method: "", minutes: 0 },
      toMississauga: { method: "", minutes: 0 },
      toOakville: { method: "", minutes: 0 },
      toBurlington: { method: "", minutes: 0 },
      toPearson: { method: "", minutes: 0 },
    },
    activeListingsCount: input.activeListingsCount,
    crossStreets: [],
  };
}

// ---------------------------------------------------------------------------
// validateHubSectionsSubset — the hub analogue of validateSectionsSubset.
// Runs comparison_mismatch on comparedToMilton (DEC-WS4-3 wiring) and the
// re-pointed W2 aggregate gates (per-trade, numeric, temporal) on liveMarket.
// ---------------------------------------------------------------------------

export function validateHubSectionsSubset(
  sections: HubSection[],
  input: HubGeneratorInput,
  milton: MiltonWideContext,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];
  const adapter = hubInputToStreetAdapter(input);

  for (const section of sections) {
    const text = section.paragraphs.join("\n\n");

    // WS4 catchment ban (amended 2026-07-19, batch-001 remediation): applies
    // on EVERY tier. School names + distances only; no catchment/boundary/
    // assignment vocabulary anywhere in hub prose.
    const catchment = findCatchmentVocabulary(text);
    if (catchment) {
      violations.push({
        rule: "catchment_vocabulary",
        excerpt: `"${catchment.matched}": ${catchment.excerpt}`,
        severity: "hard",
      });
    }

    // liveMarket / inventorySnapshot: aggregate sections. Per-trade claims are
    // banned (input has no per-trade rows) and numerics must ground — the W2
    // gate re-pointed at hub aggregates.
    if (section.id === "liveMarket" || section.id === "inventorySnapshot") {
      for (const p of findPerTradeFabrications(text, adapter)) {
        violations.push({
          rule: "per_trade_fabrication",
          excerpt: `${p.side}-side: "${p.matchedPhrase}" — ${p.reason}; ctx: ${p.context}`,
          severity: "hard",
        });
      }
      for (const f of findUngroundedNumerics(text, adapter)) {
        violations.push({
          rule: "numeric_ungrounded",
          excerpt: `"${f.raw}" (${f.type}) — ${f.reason}; ctx: ${f.context}`,
          severity: "hard",
        });
      }
      for (const t of findTemporalPairings(text, adapter)) {
        violations.push({
          rule: "temporal_pairing",
          excerpt: `${t.type}: ${t.reason}; ctx: ${t.context}`,
          severity: "hard",
        });
      }
      // WS5 — sub-k range reassembly: a low–high band when priceRange is null.
      for (const r of findSubkRangeReassembly(text, adapter)) {
        violations.push({
          rule: "subk_range_reassembly",
          excerpt: `${r.reason}; ctx: ${r.context}`,
          severity: "hard",
        });
      }
    }

    // comparedToMilton: the net-new cross-sectional gate (DEC-WS4-3).
    if (section.id === "comparedToMilton") {
      // Per-trade + numeric grounding still apply (it cites aggregates).
      for (const p of findPerTradeFabrications(text, adapter)) {
        violations.push({
          rule: "per_trade_fabrication",
          excerpt: `${p.side}-side: "${p.matchedPhrase}" — ${p.reason}; ctx: ${p.context}`,
          severity: "hard",
        });
      }
      for (const c of findComparisonMismatch(text, input, milton)) {
        violations.push({
          rule: "comparison_mismatch",
          excerpt: `${c.type}: ${c.reason}; ctx: ${c.context}`,
          severity: "hard",
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// validateHubFaq (WS5, Rule A) — the hub FAQ was previously UNVALIDATED for
// grounding (the street tier validates its FAQ via validateFaq; the hub did
// not, so brookville's "$2.0M–$2.25M" band slipped through). Run the aggregate
// gates on the FAQ answers so a number in an FAQ answer must ground exactly
// like a section: per-trade fabrication banned in EVERY answer; numeric
// grounding + temporal pairing on aggregate-bucket answers; the sub-k range
// gate on ANY answer (defense against mislabeling a price band as editorial).
// ---------------------------------------------------------------------------

export function validateHubFaq(
  faq: HubFAQItem[],
  input: HubGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];
  const adapter = hubInputToStreetAdapter(input);

  for (const item of faq) {
    const q = item.question.slice(0, 48);
    const text = item.answer;

    // WS4 catchment ban (all tiers, 2026-07-19): question or answer.
    const catchment = findCatchmentVocabulary(`${item.question} ${item.answer}`);
    if (catchment) {
      violations.push({
        rule: "catchment_vocabulary",
        excerpt: `FAQ "${q}": "${catchment.matched}": ${catchment.excerpt}`,
        severity: "hard",
      });
    }

    // Per-trade fabrication is banned in any answer (input has no per-trade rows).
    for (const p of findPerTradeFabrications(text, adapter)) {
      violations.push({
        rule: "per_trade_fabrication",
        excerpt: `FAQ "${q}": ${p.side}-side: "${p.matchedPhrase}" — ${p.reason}`,
        severity: "hard",
      });
    }
    // Sub-k range band is banned in ANY answer (mislabel-resistant).
    for (const r of findSubkRangeReassembly(text, adapter)) {
      violations.push({
        rule: "subk_range_reassembly",
        excerpt: `FAQ "${q}": ${r.reason}; ctx: ${r.context}`,
        severity: "hard",
      });
    }
    // Aggregate-bucket answers cite aggregates → numeric grounding + temporal.
    if (item.bucket === "aggregate") {
      for (const f of findUngroundedNumerics(text, adapter)) {
        violations.push({
          rule: "numeric_ungrounded",
          excerpt: `FAQ "${q}": "${f.raw}" (${f.type}) — ${f.reason}`,
          severity: "hard",
        });
      }
      for (const t of findTemporalPairings(text, adapter)) {
        violations.push({
          rule: "temporal_pairing",
          excerpt: `FAQ "${q}": ${t.type}: ${t.reason}`,
          severity: "hard",
        });
      }
    }
  }
  return violations;
}
