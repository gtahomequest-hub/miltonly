// src/lib/geni/parseGeniQuery.ts
// GENI Phase 1 — the input firewall orchestrator. parseGeniQuery(sentence) runs the four
// short-circuiting stages and returns EITHER whitelist-only criteria OR a decline/neutralize
// result. HARD INVARIANT: this NEVER returns a neighbourhood name/slug, a ranking, a
// recommendation, or area prose. It does not read neighbourhood_match_stats and builds no
// /listings URL. It parses and guards, full stop. (Matching is Phase 2.)
import { validatePromptSafety } from "@/lib/ai/compliance";
import { scanAndNeutralize, type ProtectedHit } from "./inputFairHousing";
import { parseWithLLM, type GeniCriteria, type DeclinedField } from "./parsePrompt";
import { judgeParse } from "./judgeParse";

export type GeniOutcome = "proceed" | "proceed_with_note" | "declined";

export interface GeniParseResult {
  outcome: GeniOutcome;
  criteria: GeniCriteria; // {} when declined
  declined: DeclinedField[];
  neutralized: ProtectedHit[];
  note?: string;
}

// The area-finder ranks on objective facts only; it never characterizes who lives somewhere.
const NOTE_STEER =
  "Geni ranks areas on price, property type, sales activity, and distance to the GO station — not on who lives there.";
const NOTE_REDIRECT =
  "I can't match neighbourhoods on that. Give me a budget, home type, or distance to the GO and I'll find areas that fit.";
const NOTE_PII =
  "That looks like it contains a listing ID or a full address — I can't process those. Give me a budget, home type, or distance to the GO.";

function isEmptyCriteria(c: GeniCriteria): boolean {
  return Object.keys(c).length === 0;
}

export async function parseGeniQuery(sentence: string): Promise<GeniParseResult> {
  const input = (sentence ?? "").trim();

  // STAGE 0 — PII / data-leak (reuse the existing prompt-safety check). Reject, no further.
  const safety = validatePromptSafety(input);
  if (!safety.safe) {
    return { outcome: "declined", criteria: {}, declined: [{ field: "_safety", reason: safety.reason ?? "unsafe input" }], neutralized: [], note: NOTE_PII };
  }

  // STAGE 1 — deterministic protected-signal scan + neutralize (no LLM).
  const s1 = scanAndNeutralize(input);
  if (s1.hits.length > 0 && !s1.hasObjectiveResidue) {
    // Protected content, nothing objective survives — DECLINE here, never call the LLM, never steer.
    return { outcome: "declined", criteria: {}, declined: [], neutralized: s1.hits, note: NOTE_STEER };
  }
  const residue = s1.hits.length > 0 ? s1.residue : input;

  // STAGE 2 — constrained LLM parse (whitelist schema + declined[]; allowlist-enforced).
  const s2 = await parseWithLLM(residue);

  // STAGE 3 — OHRC judge on the parse (only when something groundable survived). FAIL-CLOSED.
  // Judges the RESIDUE (what we'd actually proceed on), NOT the raw input — so it catches a
  // proxy Stage 1 MISSED without re-flagging content Stage 1 already neutralized. (For a clean
  // input with no Stage-1 hit, residue === input, so the smuggle case is judged in full.)
  if (!isEmptyCriteria(s2.criteria)) {
    const verdict = await judgeParse(residue, s2.criteria);
    if (!verdict.pass) {
      const findingDecl: DeclinedField[] = verdict.judgeError
        ? [{ field: "_steering", reason: `fair-housing judge unavailable (fail-closed): ${verdict.judgeError}` }]
        : verdict.findings.map((f) => ({ field: "_steering", reason: `parse flagged as steering [${f.class}]: "${f.span}"` }));
      // Discard the parse — never proceed on a criteria set the judge flagged.
      return { outcome: "declined", criteria: {}, declined: findingDecl, neutralized: s1.hits, note: NOTE_STEER };
    }
  }

  // Outcome.
  if (isEmptyCriteria(s2.criteria)) {
    // Nothing matchable survived.
    const note = s1.hits.length > 0 ? NOTE_STEER : NOTE_REDIRECT;
    return { outcome: "declined", criteria: {}, declined: s2.declined, neutralized: s1.hits, note };
  }
  if (s1.hits.length > 0 || s2.declined.length > 0) {
    return { outcome: "proceed_with_note", criteria: s2.criteria, declined: s2.declined, neutralized: s1.hits, note: NOTE_STEER };
  }
  return { outcome: "proceed", criteria: s2.criteria, declined: [], neutralized: [] };
}
