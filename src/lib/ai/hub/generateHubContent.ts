// src/lib/ai/hub/generateHubContent.ts
// WS5 Stage 2 (DEC-WS5-1..5) — RURAL hub-tier generation orchestrator.
//
// Mirrors the SHAPE of generatePhase41StreetContent (src/lib/ai/compliance.ts):
// parallel half-calls via Promise.all, a per-half retry-with-feedback loop
// (runHubHalfWithRetry ≈ runHalfWithRetry), a surgical AI_PROVIDER_FALLBACK
// re-run of only the failed half, combined post-processing + final validation,
// and a Phase41GenerationResult-equivalent return (HubGenerationResult) with full
// token/cost accounting. It THROWS HubGenerationError when a half exhausts its
// retry budget, and returns validatorPassed=false when the halves pass
// individually but the combined validator does not (mirrors the street contract
// generateStreet.ts depends on).
//
// RURAL SCOPE (strict subset — DEC-WS5):
//   - TWO calls only: editorial (openingIdentity, bestFitFor, buySellCtas + FAQ)
//     and light-market (liveMarket). NO comparedToMilton call, NO MiltonWideContext,
//     NO schools call, NO VIP.
//   - Projected sections (rural-roads = streetsInNeighbourhood, schemaMarkup) are
//     renderer-emitted (projectStreetsSection / projectHubSchema), NOT generated
//     here — so they are never in the LLM output or this validator pass.
//   - Input via buildRuralHubInput (throws unless profile==='rural_hub').
//   - Input-aware rounding BEFORE validation (DEC-WS5-3): roundPricesInOutput is
//     REUSED against the hub aggregates via hubInputToStreetAdapter — no rounding
//     logic re-derived.
//   - Validation via validateHubSectionsSubset. Confirmed by reading it: it only
//     gates liveMarket / inventorySnapshot / comparedToMilton. Rural emits none of
//     a comparedToMilton section, so findComparisonMismatch is never reached and
//     the `milton` argument is never accessed — RURAL_NO_MILTON below is a stub
//     that satisfies the signature without supplying a real Milton-wide rollup.
//
// This module does NOT write the DB and does NOT route fail-closed — the Step-4
// generation entry (generateRuralHub) does the terminal-status writes and calls
// routeHubGeneration. This file is pure generation, exactly like
// generatePhase41StreetContent.

import fs from "fs";
import path from "path";

import { buildRuralHubInput } from "@/lib/ai/buildHubInput";
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
import type {
  HubGeneratorInput,
  HubGeneratorOutput,
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

// Canonical rural section order (rural README 01/02/03/05).
const EDITORIAL_SECTION_IDS: HubSectionId[] = ["openingIdentity", "bestFitFor", "buySellCtas"];
const MARKET_SECTION_IDS: HubSectionId[] = ["liveMarket"];
const RURAL_SECTION_ORDER: HubSectionId[] = ["openingIdentity", "liveMarket", "bestFitFor", "buySellCtas"];

// Rural emits NO comparedToMilton section, so validateHubSectionsSubset never
// reads `milton`. Stub to satisfy the signature; structurally never accessed.
const RURAL_NO_MILTON: MiltonWideContext = {
  scope: "milton-wide",
  aggregates: {
    txCount: 0, salesCount: 0, leasesCount: 0,
    typicalPrice: null, priceRange: null, daysOnMarket: null, kAnonLevel: "zero",
  },
  quarterlyTrend: [],
  activeListingsCount: 0,
  neighbourhoodCount: 0,
};

// ---------------------------------------------------------------------------
// Rural prompt loading (mirrors loadPhase41*Prompt: process.cwd()/docs + cache).
// editorial = 00 (system) + 01 (opening) + 03 (whats-distinctive→bestFitFor) +
// 05 (buy/sell ctas) + 06 (faq). market = 00 (system) + 02 (light-market).
// 04 (rural-roads) and 07 (schema) are PROJECTED — never loaded as LLM prompts.
// ---------------------------------------------------------------------------

const RURAL_DIR = path.join(process.cwd(), "docs", "phase-4.1", "hub", "rural");

function loadRuralFile(file: string): string {
  const p = path.join(RURAL_DIR, file);
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    throw new Error(`Failed to load rural hub prompt at ${p}: ${(e as Error).message}`);
  }
}

let _editorialPromptCache: string | null = null;
let _marketPromptCache: string | null = null;

function loadRuralEditorialPrompt(): string {
  if (_editorialPromptCache !== null) return _editorialPromptCache;
  _editorialPromptCache = [
    loadRuralFile("00-rural-system-prompt.md"),
    loadRuralFile("01-opening-identity.md"),
    loadRuralFile("03-whats-distinctive.md"),
    loadRuralFile("05-buy-sell-ctas.md"),
    loadRuralFile("06-faq.md"),
  ].join("\n\n---\n\n");
  return _editorialPromptCache;
}

function loadRuralMarketPrompt(): string {
  if (_marketPromptCache !== null) return _marketPromptCache;
  _marketPromptCache = [
    loadRuralFile("00-rural-system-prompt.md"),
    loadRuralFile("02-light-market.md"),
  ].join("\n\n---\n\n");
  return _marketPromptCache;
}

// ---------------------------------------------------------------------------
// Input-aware rounding (DEC-WS5-3). REUSE roundPricesInOutput against the hub
// aggregates carried by hubInputToStreetAdapter — no rounding logic re-derived.
// The hub section/faq shapes are structurally identical to the street ones
// (id/heading/paragraphs ; question/answer), so the cross-cast is safe.
// ---------------------------------------------------------------------------

function roundHubOutput(
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

// Shape gate: a half must return exactly the section ids it owns. A missing
// section is a recoverable invalid_json_shape violation (retry with feedback),
// mirroring validateSectionsSubset's presence check at street tier.
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
// Telemetry shapes (mirror Phase41Attempt / HalfResult / Phase41GenerationResult).
// ---------------------------------------------------------------------------

export interface HubAttempt {
  attemptN: number;
  violations: ValidatorViolation[];
  tokens: { in: number; out: number };
  costUsd: number;
}

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

interface RunHubHalfParams {
  halfLabel: "editorial" | "market";
  systemPrompt: string;
  expectedSectionIds: HubSectionId[];
  expectsFaq: boolean;
  input: HubGeneratorInput;
  maxAttempts: number;
  provider?: "deepseek" | "claude";
  claudeModel?: ClaudeModelKey;
}

export interface HubGenerationResult {
  output: HubGeneratorOutput;
  attemptCount: number;
  validatorPassed: boolean;
  finalViolations: ValidatorViolation[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  attempts: HubAttempt[];
}

export interface HubGenerationErrorPayload {
  violations: ValidatorViolation[];
  attemptCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  attempts: HubAttempt[];
}

export class HubGenerationError extends Error {
  public readonly payload: HubGenerationErrorPayload;
  constructor(message: string, payload: HubGenerationErrorPayload) {
    super(message);
    this.name = "HubGenerationError";
    this.payload = payload;
  }
}

// ---------------------------------------------------------------------------
// runHubHalfWithRetry — the hub analogue of runHalfWithRetry. Loops up to
// maxAttempts: call model → parse → round (pre-validation) → validate via
// validateHubSectionsSubset (+ section-presence shape gate) → on violations,
// retry with formatted feedback. Returns clean on success, or the last state
// with violations when the budget is exhausted (caller decides).
// ---------------------------------------------------------------------------

async function runHubHalfWithRetry(params: RunHubHalfParams): Promise<HubHalfResult> {
  const { halfLabel, systemPrompt, expectedSectionIds, expectsFaq, input, maxAttempts, provider = "deepseek", claudeModel = "opus" } = params;
  const attempts: HubAttempt[] = [];
  let totalIn = 0, totalOut = 0, totalCost = 0;
  let lastViolations: ValidatorViolation[] = [];
  let lastSections: HubSection[] = [];
  let lastFaq: HubFAQItem[] | undefined = undefined;
  const slug = input.neighbourhood.slug;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let userPrompt = JSON.stringify(input, null, 2);
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

    // Parse-retry: unparseable / missing-shape → recoverable invalid_json_shape.
    const parseResult = tryParseGenerationResponse(response.text, expectsFaq);
    if (parseResult.violation) {
      const violations: ValidatorViolation[] = [{ ...parseResult.violation, sectionId: undefined }];
      attempts.push({ attemptN: attempt, violations, tokens: { in: response.inputTokens, out: response.outputTokens }, costUsd: response.costUsd });
      console.log(`[HubGen/${halfLabel}] ${slug} attempt ${attempt}: invalid_json_shape (${parseResult.violation.excerpt}) — RETRY`);
      lastViolations = violations;
      continue;
    }
    const candidate = parseResult.candidate!;
    const candidateSections = (candidate.sections ?? []) as unknown as HubSection[];
    const candidateFaq = (expectsFaq && candidate.faq ? candidate.faq : []) as unknown as HubFAQItem[];

    // Input-aware rounding BEFORE validation (DEC-WS5-3).
    const rounded = roundHubOutput(candidateSections, candidateFaq, input);
    const sectionsForValidate = rounded.sections;
    const faqForValidate = expectsFaq ? trimFaqAnswersToSentenceCap(rounded.faq as unknown as StreetFAQItem[]) as unknown as HubFAQItem[] : [];

    // Validate: section-presence shape gate + the re-pointed W2 hub gate +
    // the FAQ grounding gate (WS5 Rule A — the FAQ was previously unvalidated).
    const violations: ValidatorViolation[] = [
      ...checkExpectedSections(sectionsForValidate, expectedSectionIds),
      ...validateHubSectionsSubset(sectionsForValidate, input, RURAL_NO_MILTON),
      ...(expectsFaq ? validateHubFaq(faqForValidate, input) : []),
    ];

    attempts.push({ attemptN: attempt, violations, tokens: { in: response.inputTokens, out: response.outputTokens }, costUsd: response.costUsd });
    const ruleSummary = violations.length === 0 ? "clean" : violations.map((v) => v.sectionId ? `${v.rule}@${v.sectionId}` : v.rule).join(", ");
    console.log(`[HubGen/${halfLabel}] ${slug} attempt ${attempt}: ${violations.length} violation${violations.length === 1 ? "" : "s"} (${ruleSummary}) | ${response.inputTokens}in/${response.outputTokens}out | $${response.costUsd.toFixed(5)}`);

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
// generateRuralHubContent — the rural analogue of generatePhase41StreetContent.
// ---------------------------------------------------------------------------

export async function generateRuralHubContent(
  neighbourhoodSlug: string,
  prebuiltInput?: HubGeneratorInput,
): Promise<HubGenerationResult> {
  // Throws unless profile==='rural_hub' (the 9 rural pools). NO MiltonWideContext.
  // The entry (generateRuralHub) builds the input once for the atomic claim and
  // passes it here to avoid a redundant rebuild.
  const input = prebuiltInput ?? await buildRuralHubInput(neighbourhoodSlug);

  const editorialPrompt = loadRuralEditorialPrompt();
  const marketPrompt = loadRuralMarketPrompt();

  // Two parallel half-calls (DeepSeek by default — no flag flipped here).
  const [editorialRes, marketRes] = await Promise.all([
    runHubHalfWithRetry({ halfLabel: "editorial", systemPrompt: editorialPrompt, expectedSectionIds: EDITORIAL_SECTION_IDS, expectsFaq: true, input, maxAttempts: 5, provider: "deepseek" }),
    runHubHalfWithRetry({ halfLabel: "market", systemPrompt: marketPrompt, expectedSectionIds: MARKET_SECTION_IDS, expectsFaq: false, input, maxAttempts: 5, provider: "deepseek" }),
  ]);

  // Surgical fallback (mirror compliance.ts): when AI_PROVIDER_FALLBACK is a
  // Claude mode and a half exhausted retries with violations, re-run ONLY that
  // half with the fallback model; replace the half only if the fallback is clean.
  const fallbackRaw = (process.env.AI_PROVIDER_FALLBACK || "").trim();
  const fallbackModel: ClaudeModelKey | null =
    fallbackRaw === "claude" || fallbackRaw === "opus" ? "opus" :
    fallbackRaw === "sonnet" ? "sonnet" :
    fallbackRaw === "haiku" ? "haiku" : null;

  if (fallbackModel) {
    const halves: Array<{ label: "editorial" | "market"; res: HubHalfResult; prompt: string; ids: HubSectionId[]; faq: boolean }> = [];
    if (editorialRes.violations.length > 0) halves.push({ label: "editorial", res: editorialRes, prompt: editorialPrompt, ids: EDITORIAL_SECTION_IDS, faq: true });
    if (marketRes.violations.length > 0) halves.push({ label: "market", res: marketRes, prompt: marketPrompt, ids: MARKET_SECTION_IDS, faq: false });

    if (halves.length > 0) {
      console.log(`[HubGen] ${neighbourhoodSlug} FALLBACK: ${halves.length} half(ves) failed primary — retrying with Claude ${fallbackModel}: ${halves.map((h) => h.label).join(", ")}`);
      const results = await Promise.all(halves.map(({ label, prompt, ids, faq }) =>
        runHubHalfWithRetry({ halfLabel: label, systemPrompt: prompt, expectedSectionIds: ids, expectsFaq: faq, input, maxAttempts: 3, provider: "claude", claudeModel: fallbackModel })
          .catch((e: unknown) => { console.log(`[HubGen/${label}-fallback] ${neighbourhoodSlug}: threw — ${e instanceof Error ? e.message : String(e)}`); return null; })
      ));
      for (let i = 0; i < halves.length; i++) {
        const orig = halves[i].res;
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

  const totalInputTokens = editorialRes.totalInputTokens + marketRes.totalInputTokens;
  const totalOutputTokens = editorialRes.totalOutputTokens + marketRes.totalOutputTokens;
  const totalCostUsd = editorialRes.totalCostUsd + marketRes.totalCostUsd;
  const attemptCount = Math.max(editorialRes.attemptCount, marketRes.attemptCount);
  const attempts: HubAttempt[] = [...editorialRes.attempts, ...marketRes.attempts];

  // If either half exhausted its retry budget, fail-closed (throw) — the entry
  // catches this and routes to StreetGenerationReview (hub:<slug>).
  const callFailures: ValidatorViolation[] = [...editorialRes.violations, ...marketRes.violations];
  if (callFailures.length > 0) {
    throw new HubGenerationError(
      `Rural hub two-call generation failed: editorial=${editorialRes.violations.length} violation(s) after ${editorialRes.attemptCount} attempts, market=${marketRes.violations.length} violation(s) after ${marketRes.attemptCount} attempts.`,
      { violations: callFailures, attemptCount, totalInputTokens, totalOutputTokens, totalCostUsd, attempts },
    );
  }

  // Combine in canonical rural order, post-process (faq trim + round), final-validate.
  const merged: HubSection[] = [...editorialRes.sections, ...marketRes.sections];
  const orderedSections = RURAL_SECTION_ORDER
    .map((id) => merged.find((s) => s.id === id))
    .filter((s): s is HubSection => s !== undefined);
  const faqTrimmed = trimFaqAnswersToSentenceCap((editorialRes.faq ?? []) as unknown as StreetFAQItem[]) as unknown as HubFAQItem[];
  const finalOutput = roundHubOutput(orderedSections, faqTrimmed, input);

  // Final validation on combined output (defense-in-depth; no combined-only hub
  // rule exists, but mirror the street contract: validatorPassed reflects this).
  // Includes the FAQ grounding gate (WS5 Rule A) on the merged-and-trimmed FAQ.
  const finalViolations = [
    ...validateHubSectionsSubset(finalOutput.sections, input, RURAL_NO_MILTON),
    ...validateHubFaq(finalOutput.faq as unknown as HubFAQItem[], input),
  ];
  const wordTotal = finalOutput.sections.reduce((sum, s) => sum + s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length, 0);
  console.log(`[HubGen] ${neighbourhoodSlug} combined: ${wordTotal} words, editorial=${editorialRes.attemptCount}+market=${marketRes.attemptCount} attempts, total $${totalCostUsd.toFixed(5)}, ${finalViolations.length === 0 ? "PASS" : `FAIL (${finalViolations.length} combined violations)`}`);

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
