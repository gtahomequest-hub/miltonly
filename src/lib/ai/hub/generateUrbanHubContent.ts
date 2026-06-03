// src/lib/ai/hub/generateUrbanHubContent.ts
// WS5 — URBAN hub-tier generation orchestrator (the larger sibling of
// generateRuralHubContent in generateHubContent.ts). PURE generation — no DB,
// no fail-closed routing; the entry generateUrbanHub.ts does the terminal writes.
//
// URBAN SCOPE (DEC-WS4 / DEC-WS5), vs the rural subset:
//   - THREE calls (rural is two):
//       (1) editorial : openingIdentity + amenities + bestFitFor + buySellCtas + FAQ
//       (2) market    : liveMarket + inventorySnapshot
//       (3) compared  : comparedToMilton — payload carries MiltonWideContext; this is the
//                        only section gated by the net-new comparison_mismatch rule (DEC-WS4-3).
//   - Input via buildHubInput (THROWS unless profile==='urban_hub') + buildMiltonWideContext
//     (computed once per run, shared across all 14 hubs).
//   - schoolsCatchments (urban/04) is NOT loaded and NOT generated — input.schools.sourced is
//     false (gates WS5). The section never enters any call or the output, so the renderer has
//     nothing to skip and no half-section renders. (Decision: ship urban WITHOUT schools.)
//   - streetsInNeighbourhood (08) + schemaMarkup (11) are PROJECTED (projectHubEntities) at
//     render time — never generated here, never in this validator pass. VIP lives there.
//
// WHY THE RETRY RUNNER IS DUPLICATED (not imported from generateHubContent.ts):
//   runHubHalfWithRetry there hardcodes `validateHubSectionsSubset(..., RURAL_NO_MILTON)`.
//   Urban's comparedToMilton MUST be validated against the REAL MiltonWideContext (else
//   findComparisonMismatch fires side_ungrounded on every verb against a null stub). Exporting
//   the rural runner as-is would validate urban with the wrong context; threading a `milton`
//   param through it would restructure rural's internals — which the build brief forbids. So
//   the ~90-line runner + its two helpers are duplicated here and generateHubContent.ts is left
//   100% untouched (rural behavior byte-identical by construction). A future refactor could
//   extract a shared milton-parametrized runner; out of scope for this build.

import fs from "fs";
import path from "path";

import { buildHubInput, buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import {
  validateHubSectionsSubset,
  validateHubFaq,
  hubInputToStreetAdapter,
} from "@/lib/ai/validateHubGeneration";
import {
  callDeepSeek,
  callClaude,
  tryParseGenerationResponse,
} from "@/lib/ai/compliance";
import { roundPricesInOutput } from "@/lib/ai/roundPricesInOutput";
import { formatViolationsForRetry } from "@/lib/ai/validateStreetGeneration";
import { trimFaqAnswersToSentenceCap } from "@/lib/ai/trimFaqAnswers";
// Reuse the rural module's PUBLIC contract types/class so the urban result is
// structurally identical to the rural one (the entry depends on this shape).
import {
  HubGenerationError,
  type HubAttempt,
  type HubGenerationResult,
} from "@/lib/ai/hub/generateHubContent";
import type {
  HubGeneratorInput,
  HubSection,
  HubSectionId,
  HubFAQItem,
  MiltonWideContext,
} from "@/types/hub-generator";
import type {
  ValidatorViolation,
  StreetSection,
  StreetFAQItem,
  StreetGeneratorOutput,
} from "@/types/street-generator";

type ClaudeModelKey = "opus" | "sonnet" | "haiku";

// Per-call section ownership (the validator keys on section id, not call grouping).
const EDITORIAL_SECTION_IDS: HubSectionId[] = ["openingIdentity", "amenities", "bestFitFor", "buySellCtas"];
const MARKET_SECTION_IDS: HubSectionId[] = ["liveMarket", "inventorySnapshot"];
const COMPARED_SECTION_IDS: HubSectionId[] = ["comparedToMilton"];

// Canonical urban order for the STORED LLM sections (urban README 01/02/03/05/06/07/09).
// 04-schools (skipped) and 08-streets / 11-schema (projected) are intentionally absent.
const URBAN_SECTION_ORDER: HubSectionId[] = [
  "openingIdentity",
  "liveMarket",
  "inventorySnapshot",
  "amenities",
  "comparedToMilton",
  "bestFitFor",
  "buySellCtas",
];

// ---------------------------------------------------------------------------
// Urban prompt loading (mirrors loadRural*Prompt: process.cwd()/docs + cache).
// editorial = 00 (system) + 01 (opening) + 05 (amenities) + 07 (best-fit) + 09 (ctas) + 10 (faq).
// market    = 00 (system) + 02 (live-market) + 03 (inventory-snapshot).
// compared  = 00 (system) + 06 (compared-to-milton).
// 04 (schools) is NEVER loaded (decision: ship without schools). 08/11 are PROJECTED.
// ---------------------------------------------------------------------------

const URBAN_DIR = path.join(process.cwd(), "docs", "phase-4.1", "hub", "urban");

function loadUrbanFile(file: string): string {
  const p = path.join(URBAN_DIR, file);
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    throw new Error(`Failed to load urban hub prompt at ${p}: ${(e as Error).message}`);
  }
}

let _editorialPromptCache: string | null = null;
let _marketPromptCache: string | null = null;
let _comparedPromptCache: string | null = null;

function loadUrbanEditorialPrompt(): string {
  if (_editorialPromptCache !== null) return _editorialPromptCache;
  _editorialPromptCache = [
    loadUrbanFile("00-hub-system-prompt.md"),
    loadUrbanFile("01-opening-identity.md"),
    loadUrbanFile("05-amenities.md"),
    loadUrbanFile("07-best-fit-for.md"),
    loadUrbanFile("09-buy-sell-ctas.md"),
    loadUrbanFile("10-faq.md"),
  ].join("\n\n---\n\n");
  return _editorialPromptCache;
}

function loadUrbanMarketPrompt(): string {
  if (_marketPromptCache !== null) return _marketPromptCache;
  _marketPromptCache = [
    loadUrbanFile("00-hub-system-prompt.md"),
    loadUrbanFile("02-live-market.md"),
    loadUrbanFile("03-inventory-snapshot.md"),
  ].join("\n\n---\n\n");
  return _marketPromptCache;
}

function loadUrbanComparedPrompt(): string {
  if (_comparedPromptCache !== null) return _comparedPromptCache;
  _comparedPromptCache = [
    loadUrbanFile("00-hub-system-prompt.md"),
    loadUrbanFile("06-compared-to-milton.md"),
  ].join("\n\n---\n\n");
  return _comparedPromptCache;
}

// ---------------------------------------------------------------------------
// Input-aware rounding (DEC-WS5-3). REUSE roundPricesInOutput via the hub
// adapter — no rounding logic re-derived. (Duplicate of rural roundHubOutput.)
// ---------------------------------------------------------------------------

function roundUrbanOutput(
  sections: HubSection[],
  faq: HubFAQItem[],
  input: HubGeneratorInput,
): { sections: HubSection[]; faq: HubFAQItem[] } {
  const adapter = hubInputToStreetAdapter(input);
  const rounded = roundPricesInOutput(
    {
      sections: sections as unknown as StreetSection[],
      faq: faq as unknown as StreetFAQItem[],
    } as StreetGeneratorOutput,
    adapter,
  );
  return {
    sections: rounded.sections as unknown as HubSection[],
    faq: rounded.faq as unknown as HubFAQItem[],
  };
}

// Shape gate — a half must return exactly the section ids it owns. (Duplicate of
// rural checkExpectedSections.)
function checkExpectedSections(
  sections: HubSection[],
  expected: HubSectionId[],
): ValidatorViolation[] {
  const present = new Set(sections.map((s) => s.id));
  const missing = expected.filter((id) => !present.has(id));
  if (missing.length === 0) return [];
  return [{
    rule: "invalid_json_shape",
    excerpt: `missing expected section(s): ${missing.join(", ")}`,
    severity: "hard",
  }];
}

// ---------------------------------------------------------------------------
// runUrbanHalfWithRetry — duplicate of rural runHubHalfWithRetry, with TWO
// urban deltas: (a) it validates against the REAL `milton` context (passed in),
// not a null stub; (b) the compared call carries `milton` in the user payload so
// the model can ground both sides of the comparison.
// ---------------------------------------------------------------------------

interface HubHalfResult {
  sections: HubSection[];
  faq?: HubFAQItem[];
  attemptCount: number;
  violations: ValidatorViolation[];
  attempts: HubAttempt[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

interface RunUrbanHalfParams {
  halfLabel: "editorial" | "market" | "compared";
  systemPrompt: string;
  expectedSectionIds: HubSectionId[];
  expectsFaq: boolean;
  input: HubGeneratorInput;
  milton: MiltonWideContext;
  includeMiltonInPayload: boolean;
  maxAttempts: number;
  provider?: "deepseek" | "claude";
  claudeModel?: ClaudeModelKey;
}

async function runUrbanHalfWithRetry(params: RunUrbanHalfParams): Promise<HubHalfResult> {
  const { halfLabel, systemPrompt, expectedSectionIds, expectsFaq, input, milton, includeMiltonInPayload, maxAttempts, provider = "deepseek", claudeModel = "opus" } = params;
  const attempts: HubAttempt[] = [];
  let totalIn = 0, totalOut = 0, totalCost = 0;
  let lastViolations: ValidatorViolation[] = [];
  let lastSections: HubSection[] = [];
  let lastFaq: HubFAQItem[] | undefined = undefined;
  const slug = input.neighbourhood.slug;

  // The compared call needs Milton-wide aggregates in the payload; the other two
  // calls never reference Milton, so they get the neighbourhood input alone.
  const payloadObject: unknown = includeMiltonInPayload ? { ...input, milton } : input;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let userPrompt = JSON.stringify(payloadObject, null, 2);
    if (lastViolations.length > 0) {
      const feedback = formatViolationsForRetry(lastViolations);
      userPrompt += "\n\n---\nYour previous attempt failed validation. Fix these specific issues and return clean JSON:\n\n" + feedback;
    }

    const response = provider === "claude"
      ? await callClaude({ modelKey: claudeModel, systemPrompt, userPrompt, jsonOnly: true, maxTokens: 5000 })
      : await callDeepSeek({ systemPrompt, userPrompt, responseFormat: { type: "json_object" }, maxTokens: 5000, temperature: 0.4 });
    totalIn += response.inputTokens;
    totalOut += response.outputTokens;
    totalCost += response.costUsd;

    const parseResult = tryParseGenerationResponse(response.text, expectsFaq);
    if (parseResult.violation) {
      const violations: ValidatorViolation[] = [{ ...parseResult.violation, sectionId: undefined }];
      attempts.push({ attemptN: attempt, violations, tokens: { in: response.inputTokens, out: response.outputTokens }, costUsd: response.costUsd });
      console.log(`[UrbanHubGen/${halfLabel}] ${slug} attempt ${attempt}: invalid_json_shape (${parseResult.violation.excerpt}) — RETRY`);
      lastViolations = violations;
      continue;
    }
    const candidate = parseResult.candidate!;
    const candidateSections = (candidate.sections ?? []) as unknown as HubSection[];
    const candidateFaq = (expectsFaq && candidate.faq ? candidate.faq : []) as unknown as HubFAQItem[];

    const rounded = roundUrbanOutput(candidateSections, candidateFaq, input);
    const sectionsForValidate = rounded.sections;
    const faqForValidate = expectsFaq ? trimFaqAnswersToSentenceCap(rounded.faq as unknown as StreetFAQItem[]) as unknown as HubFAQItem[] : [];

    // Validate with the REAL milton context (urban delta vs rural's RURAL_NO_MILTON stub).
    const violations: ValidatorViolation[] = [
      ...checkExpectedSections(sectionsForValidate, expectedSectionIds),
      ...validateHubSectionsSubset(sectionsForValidate, input, milton),
      ...(expectsFaq ? validateHubFaq(faqForValidate, input) : []),
    ];

    attempts.push({ attemptN: attempt, violations, tokens: { in: response.inputTokens, out: response.outputTokens }, costUsd: response.costUsd });
    const ruleSummary = violations.length === 0 ? "clean" : violations.map((v) => v.sectionId ? `${v.rule}@${v.sectionId}` : v.rule).join(", ");
    console.log(`[UrbanHubGen/${halfLabel}] ${slug} attempt ${attempt}: ${violations.length} violation${violations.length === 1 ? "" : "s"} (${ruleSummary}) | ${response.inputTokens}in/${response.outputTokens}out | $${response.costUsd.toFixed(5)}`);

    if (violations.length === 0) {
      return {
        sections: sectionsForValidate,
        faq: expectsFaq ? faqForValidate : undefined,
        attemptCount: attempt,
        violations: [],
        attempts,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        totalCostUsd: totalCost,
      };
    }

    lastViolations = violations;
    lastSections = sectionsForValidate;
    lastFaq = expectsFaq ? faqForValidate : undefined;
  }

  return {
    sections: lastSections,
    faq: lastFaq,
    attemptCount: maxAttempts,
    violations: lastViolations,
    attempts,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    totalCostUsd: totalCost,
  };
}

// ---------------------------------------------------------------------------
// generateUrbanHubContent — the urban analogue of generateRuralHubContent.
// THREE parallel calls; surgical AI_PROVIDER_FALLBACK re-run of only failed
// call(s); merge in canonical urban order; input-aware round; final validate
// with the real milton context. Pure — no DB writes.
// ---------------------------------------------------------------------------

export interface UrbanProviderOpts {
  // Primary provider for the three calls. Default 'deepseek' (batch convention).
  // The single-slug DRY proof forces 'claude'/'opus' to isolate orchestrator
  // correctness — NOT baked into the orchestrator default.
  primaryProvider?: "deepseek" | "claude";
  primaryClaudeModel?: ClaudeModelKey;
}

export async function generateUrbanHubContent(
  neighbourhoodSlug: string,
  prebuiltInput?: HubGeneratorInput,
  prebuiltMilton?: MiltonWideContext,
  opts?: UrbanProviderOpts,
): Promise<HubGenerationResult> {
  // Throws unless profile==='urban_hub' (guard lives in buildHubInput).
  const input = prebuiltInput ?? await buildHubInput(neighbourhoodSlug);
  const milton = prebuiltMilton ?? await buildMiltonWideContext();

  const provider = opts?.primaryProvider ?? "deepseek";
  const claudeModel = opts?.primaryClaudeModel ?? "opus";

  const editorialPrompt = loadUrbanEditorialPrompt();
  const marketPrompt = loadUrbanMarketPrompt();
  const comparedPrompt = loadUrbanComparedPrompt();

  // Three parallel calls. comparedToMilton is isolated so a comparison_mismatch
  // retry re-runs only that call, never market.
  const [editorialRes, marketRes, comparedRes] = await Promise.all([
    runUrbanHalfWithRetry({ halfLabel: "editorial", systemPrompt: editorialPrompt, expectedSectionIds: EDITORIAL_SECTION_IDS, expectsFaq: true, input, milton, includeMiltonInPayload: false, maxAttempts: 5, provider, claudeModel }),
    runUrbanHalfWithRetry({ halfLabel: "market", systemPrompt: marketPrompt, expectedSectionIds: MARKET_SECTION_IDS, expectsFaq: false, input, milton, includeMiltonInPayload: false, maxAttempts: 5, provider, claudeModel }),
    runUrbanHalfWithRetry({ halfLabel: "compared", systemPrompt: comparedPrompt, expectedSectionIds: COMPARED_SECTION_IDS, expectsFaq: false, input, milton, includeMiltonInPayload: true, maxAttempts: 5, provider, claudeModel }),
  ]);

  // Surgical fallback (mirror generateRuralHubContent): when AI_PROVIDER_FALLBACK
  // is a Claude mode and a call exhausted its budget with violations, re-run ONLY
  // that call with the fallback model; replace it only if the fallback is clean.
  const fallbackRaw = (process.env.AI_PROVIDER_FALLBACK || "").trim();
  const fallbackModel: ClaudeModelKey | null =
    fallbackRaw === "claude" || fallbackRaw === "opus" ? "opus" :
    fallbackRaw === "sonnet" ? "sonnet" :
    fallbackRaw === "haiku" ? "haiku" : null;

  if (fallbackModel) {
    const calls: Array<{ label: "editorial" | "market" | "compared"; res: HubHalfResult; prompt: string; ids: HubSectionId[]; faq: boolean; milton: boolean }> = [];
    if (editorialRes.violations.length > 0) calls.push({ label: "editorial", res: editorialRes, prompt: editorialPrompt, ids: EDITORIAL_SECTION_IDS, faq: true, milton: false });
    if (marketRes.violations.length > 0) calls.push({ label: "market", res: marketRes, prompt: marketPrompt, ids: MARKET_SECTION_IDS, faq: false, milton: false });
    if (comparedRes.violations.length > 0) calls.push({ label: "compared", res: comparedRes, prompt: comparedPrompt, ids: COMPARED_SECTION_IDS, faq: false, milton: true });

    if (calls.length > 0) {
      console.log(`[UrbanHubGen] ${neighbourhoodSlug} FALLBACK: ${calls.length} call(s) failed primary — retrying with Claude ${fallbackModel}: ${calls.map((c) => c.label).join(", ")}`);
      const results = await Promise.all(calls.map(({ label, prompt, ids, faq, milton: incMilton }) =>
        runUrbanHalfWithRetry({ halfLabel: label, systemPrompt: prompt, expectedSectionIds: ids, expectsFaq: faq, input, milton, includeMiltonInPayload: incMilton, maxAttempts: 3, provider: "claude", claudeModel: fallbackModel })
          .catch((e: unknown) => { console.log(`[UrbanHubGen/${label}-fallback] ${neighbourhoodSlug}: threw — ${e instanceof Error ? e.message : String(e)}`); return null; })
      ));
      for (let i = 0; i < calls.length; i++) {
        const orig = calls[i].res;
        const fb = results[i];
        if (fb === null) continue;
        orig.totalInputTokens += fb.totalInputTokens;
        orig.totalOutputTokens += fb.totalOutputTokens;
        orig.totalCostUsd += fb.totalCostUsd;
        orig.attempts.push(...fb.attempts);
        if (fb.violations.length === 0) {
          orig.sections = fb.sections;
          orig.violations = [];
          if (fb.faq !== undefined) orig.faq = fb.faq;
        }
      }
    }
  }

  const totalInputTokens = editorialRes.totalInputTokens + marketRes.totalInputTokens + comparedRes.totalInputTokens;
  const totalOutputTokens = editorialRes.totalOutputTokens + marketRes.totalOutputTokens + comparedRes.totalOutputTokens;
  const totalCostUsd = editorialRes.totalCostUsd + marketRes.totalCostUsd + comparedRes.totalCostUsd;
  const attemptCount = Math.max(editorialRes.attemptCount, marketRes.attemptCount, comparedRes.attemptCount);
  const attempts: HubAttempt[] = [...editorialRes.attempts, ...marketRes.attempts, ...comparedRes.attempts];

  // If any call exhausted its retry budget, fail-closed (throw) — the entry
  // catches this and routes to StreetGenerationReview (hub:<slug>).
  const callFailures: ValidatorViolation[] = [...editorialRes.violations, ...marketRes.violations, ...comparedRes.violations];
  if (callFailures.length > 0) {
    throw new HubGenerationError(
      `Urban hub three-call generation failed: editorial=${editorialRes.violations.length}, market=${marketRes.violations.length}, compared=${comparedRes.violations.length} violation(s) after ${attemptCount} attempts.`,
      { violations: callFailures, attemptCount, totalInputTokens, totalOutputTokens, totalCostUsd, attempts },
    );
  }

  // Combine in canonical urban order, post-process (faq trim + round), final-validate.
  const merged: HubSection[] = [...editorialRes.sections, ...marketRes.sections, ...comparedRes.sections];
  const orderedSections = URBAN_SECTION_ORDER
    .map((id) => merged.find((s) => s.id === id))
    .filter((s): s is HubSection => s !== undefined);
  const faqTrimmed = trimFaqAnswersToSentenceCap((editorialRes.faq ?? []) as unknown as StreetFAQItem[]) as unknown as HubFAQItem[];
  const finalOutput = roundUrbanOutput(orderedSections, faqTrimmed, input);

  // Final validation on combined output WITH the real milton context (so the
  // comparedToMilton comparison_mismatch gate runs for real).
  const finalViolations = [
    ...validateHubSectionsSubset(finalOutput.sections, input, milton),
    ...validateHubFaq(finalOutput.faq as unknown as HubFAQItem[], input),
  ];
  const wordTotal = finalOutput.sections.reduce((sum, s) => sum + s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length, 0);
  console.log(`[UrbanHubGen] ${neighbourhoodSlug} combined: ${wordTotal} words, editorial=${editorialRes.attemptCount}+market=${marketRes.attemptCount}+compared=${comparedRes.attemptCount} attempts, total $${totalCostUsd.toFixed(5)}, ${finalViolations.length === 0 ? "PASS" : `FAIL (${finalViolations.length} combined violations)`}`);

  return {
    output: { sections: finalOutput.sections, faq: finalOutput.faq },
    attemptCount,
    validatorPassed: finalViolations.length === 0,
    finalViolations,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    attempts,
  };
}
