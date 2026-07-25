// src/lib/geni/inputFairHousing.ts
// GENI Phase 1 — STAGE 1: deterministic protected-signal scan + neutralize on the RAW
// USER SENTENCE. This is the input firewall's first steering gate. It is a NEW, SEPARATE
// list from the street-OUTPUT FAIR_HOUSING_PATTERNS (validateStreetGeneration.ts) — that
// one scans generated prose and is wired into street validation; DO NOT touch it. User
// phrasing needs its own list ("safe area", "good part of town", "people like us" — things
// generated prose never says).
//
// On a hit: NEUTRALIZE (strip the protected clause), record what was removed. The orchestrator
// then either proceeds on the objective residue (Stage 2) or declines — it NEVER answers the steer.

export interface ProtectedHit {
  removed: string;
  reason: string;
}

// Ontario Human Rights Code grounds + the housing-search proxies that stand in for them.
// Ordered longest/most-specific first so the removed span is meaningful.
const PROTECTED: Array<{ re: RegExp; reason: string }> = [
  { re: /\bpeople\s+like\s+(?:us|me|myself)\b|\bour\s+(?:kind|type|sort)\s+of\s+people\b|\bour\s+own\s+kind\b/gi, reason: "community-composition proxy ('people like us')" },
  { re: /\bfamily[-\s]friendly\b/gi, reason: "family status" },
  { re: /\bfamily\s+(?:neighbou?rhood|area|community|street|oriented|enclave)\b/gi, reason: "family status" },
  { re: /\bgood\s+for\s+(?:kids|children|a\s+family|families|family|raising)\b/gi, reason: "family status" },
  { re: /\b(?:great|good|perfect)\s+for\s+(?:young\s+)?(?:families|professionals|retirees|singles|couples)\b/gi, reason: "life-stage / buyer-class characterization" },
  { re: /\bnice\s+part\s+of\s+town\b|\b(?:good|bad|nice|better|worse|desirable|undesirable|rough|sketchy|posh|upscale|classy|low[-\s]?end)\s+(?:area|neighbou?rhood|part\s+of\s+town|pocket|side\s+of\s+town|street)\b/gi, reason: "quality-of-area proxy (steering)" },
  // "safe family area", "safe area", "safe place", "safe to raise" — caught as a full span.
  { re: /\b(?:un)?safe(?:r|st)?\s+(?:family\s+|good\s+)?(?:area|neighbou?rhood|part|pocket|street|place|town|community)\b/gi, reason: "safety/crime is a protected-class proxy — steering, not a data gap" },
  { re: /\b(?:un)?safe\s+(?:to|for)\s+(?:live|raise|kids|children|famil)/gi, reason: "safety/crime proxy — steering" },
  // Bare safe/unsafe/safety fallback — in a neighbourhood search this always means area safety.
  { re: /\b(?:un)?safe(?:r|st)?\b|\bsafety\b/gi, reason: "safety/crime is a protected-class proxy — steering, not a data gap" },
  { re: /\b(?:crime|criminal|dangerous|gang|violence|sketchy)\b/gi, reason: "crime/safety proxy — steering" },
  { re: /\b(?:white|black|asian|indian|brown|chinese|filipino|arab|muslim|christian|catholic|jewish|hindu|sikh|immigrant|newcomer)\s+(?:area|neighbou?rhood|community|families|people|part)\b/gi, reason: "race/ethnicity/religion/origin (OHRC ground)" },
  { re: /\bno\s+(?:kids|children|renters|immigrants|students)\b/gi, reason: "protected-class exclusion" },
  { re: /\b(?:young|older|elderly|retiree|senior|professional)s?\s+(?:crowd|people|area|neighbou?rhood|community|vibe)\b/gi, reason: "age / occupation characterization" },
  { re: /\bwhere\s+(?:do\s+)?(?:rich|wealthy|affluent|educated|professional)\s+people\b/gi, reason: "income/class characterization" },
];

// Objective, whitelist-groundable signals — used to decide whether anything MATCHABLE
// survives after neutralizing. Lenient: when in doubt, let Stage 2 run (it declines to {}).
const OBJECTIVE_SIGNAL =
  /(\$|\bunder\b|\bbelow\b|\bover\b|\bbudget\b|\bmax\b|\bprice\b|\d{2,3}\s*[km]\b|\d{5,6}\b|\bdetached\b|\bsemi\b|\btownhou?se\b|\btownhome\b|\bcondo\b|\bbungalow\b|\d\s*(?:bed|beds|bedroom|br|bath)\b|\bgo\s*(?:station|train)?\b|\bfast(?:est)?\b|\bselling\b|\bvolume\b|\bactive\b|\bhot\b|\brent(?:al)?\b|\blease\b|\bsqft\b|\bsquare\s*f)/i;

export interface Stage1Result {
  hits: ProtectedHit[];
  residue: string; // sentence with protected clauses stripped
  hasObjectiveResidue: boolean;
}

export function scanAndNeutralize(sentence: string): Stage1Result {
  const hits: ProtectedHit[] = [];
  let residue = sentence;
  for (const p of PROTECTED) {
    residue = residue.replace(p.re, (m) => {
      hits.push({ removed: m.trim(), reason: p.reason });
      return " ";
    });
  }
  // Tidy: drop now-orphaned area words + filler, collapse whitespace. Residue need NOT be
  // grammatical — Stage 2 extracts structured criteria from it regardless.
  residue = residue
    .replace(/\b(?:area|neighbou?rhood|part\s+of\s+town|pocket)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { hits, residue, hasObjectiveResidue: OBJECTIVE_SIGNAL.test(residue) };
}
