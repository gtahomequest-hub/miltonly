// src/lib/ai/hub/generateCondoBuildingContent.ts
// WS5 — CONDO-BUILDING-tier generation orchestrator (the condo sibling of
// generateUrbanHubContent.ts). PURE generation — no DB, no fail-closed routing;
// the entry generateCondoBuilding.ts does the terminal writes.
//
// CONDO SCOPE (DEC-WS4-5), vs the urban three-call shape:
//   - TWO calls (condo has no comparedToMilton → no third call, no milton context):
//       (1) editorial : buildingHistory + amenities + fees + buySellCtas + FAQ
//       (2) market    : unitMix + condoMarket (sale-active) | unitMix ONLY (lease-only —
//                        05-building-market.md is never loaded; emitting condoMarket on a
//                        lease-only building fires the hard condo_lease_only_market rule).
//   - Input via buildCondoBuildingInput (building-keyed SQL, transaction_type split,
//     K_ANON_PRICE=5 / K_ANON_RANGE=10 — 39/41 sale-active buildings have a suppressed
//     range, so the subk_range_reassembly gate is the dominant validator at this tier).
//   - schemaMarkup (08) is PROJECTED at render time — never generated here.
//
// WHY THE RETRY RUNNER IS DUPLICATED (urban precedent, generateUrbanHubContent.ts:20-28):
//   the rural/urban runners validate with hub-shaped validators + milton context; condo
//   validates with validateCondoSectionsSubset + validateCondoFaq (no milton). Threading a
//   validator strategy through the shared runner would restructure rural/urban internals.
//   So the ~90-line runner is duplicated again, and both prior files stay untouched.

import fs from "fs";
import path from "path";

import { buildCondoBuildingInput } from "@/lib/ai/buildCondoBuildingInput";
import {
  validateCondoSectionsSubset,
  validateCondoFaq,
  condoInputToStreetAdapter,
} from "@/lib/ai/validateCondoGeneration";
import {
  callDeepSeek,
  callClaude,
  tryParseGenerationResponse,
} from "@/lib/ai/compliance";
import { roundPricesInOutput } from "@/lib/ai/roundPricesInOutput";
import { formatViolationsForRetry } from "@/lib/ai/validateStreetGeneration";
import { trimFaqAnswersToSentenceCap } from "@/lib/ai/trimFaqAnswers";
// Reuse the hub module's PUBLIC contract class so the condo result is
// structurally identical to rural/urban (the entry depends on this shape).
import {
  HubGenerationError,
  type HubAttempt,
} from "@/lib/ai/hub/generateHubContent";
import type {
  CondoBuildingGeneratorInput,
  CondoSection,
  CondoSectionId,
  HubFAQItem,
} from "@/types/hub-generator";
import type {
  ValidatorViolation,
  StreetSection,
  StreetFAQItem,
  StreetGeneratorOutput,
} from "@/types/street-generator";

type ClaudeModelKey = "opus" | "sonnet" | "haiku";

// Per-call section ownership. The market call's expectation varies by fork:
// sale-active owns [unitMix, condoMarket]; lease-only owns [unitMix] only.
const EDITORIAL_SECTION_IDS: CondoSectionId[] = ["buildingHistory", "amenities", "fees", "buySellCtas"];
const MARKET_SALE_ACTIVE_IDS: CondoSectionId[] = ["unitMix", "condoMarket"];
const MARKET_LEASE_ONLY_IDS: CondoSectionId[] = ["unitMix"];

// Canonical condo order for the STORED LLM sections (condo README 01-07).
// 08-schema (projected) is intentionally absent. condoMarket simply won't be
// present on a lease-only building.
const CONDO_SECTION_ORDER: CondoSectionId[] = [
  "buildingHistory",
  "unitMix",
  "condoMarket",
  "amenities",
  "fees",
  "buySellCtas",
];

// ---------------------------------------------------------------------------
// Condo prompt loading (mirrors loadUrban*Prompt: process.cwd()/docs + cache).
// editorial = 00 (system) + 01 (history) + 03 (amenities) + 04 (fees) + 06 (ctas) + 07 (faq).
// market    = 00 (system) + 02 (unit-mix) [+ 05 (building-market) — SALE-ACTIVE ONLY].
// 08 (schema) is NEVER loaded (projected).
// ---------------------------------------------------------------------------

const CONDO_DIR = path.join(process.cwd(), "docs", "phase-4.1", "hub", "condo");

function loadCondoFile(file: string): string {
  const p = path.join(CONDO_DIR, file);
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    throw new Error(`Failed to load condo prompt at ${p}: ${(e as Error).message}`);
  }
}

let _editorialPromptCache: string | null = null;
let _marketSalePromptCache: string | null = null;
let _marketLeasePromptCache: string | null = null;

function loadCondoEditorialPrompt(): string {
  if (_editorialPromptCache !== null) return _editorialPromptCache;
  _editorialPromptCache = [
    loadCondoFile("00-condo-system-prompt.md"),
    loadCondoFile("01-building-history.md"),
    loadCondoFile("03-amenities.md"),
    loadCondoFile("04-fees.md"),
    loadCondoFile("06-buy-sell-ctas.md"),
    loadCondoFile("07-faq.md"),
  ].join("\n\n---\n\n");
  return _editorialPromptCache;
}

function loadCondoMarketPrompt(saleActive: boolean): string {
  if (saleActive) {
    if (_marketSalePromptCache !== null) return _marketSalePromptCache;
    _marketSalePromptCache = [
      loadCondoFile("00-condo-system-prompt.md"),
      loadCondoFile("02-unit-mix.md"),
      loadCondoFile("05-building-market.md"),
    ].join("\n\n---\n\n");
    return _marketSalePromptCache;
  }
  // Lease-only: 05 is NEVER loaded — the model cannot be steered toward a
  // market section it must not write.
  if (_marketLeasePromptCache !== null) return _marketLeasePromptCache;
  _marketLeasePromptCache = [
    loadCondoFile("00-condo-system-prompt.md"),
    loadCondoFile("02-unit-mix.md"),
  ].join("\n\n---\n\n");
  return _marketLeasePromptCache;
}

// ---------------------------------------------------------------------------
// Input-aware rounding (DEC-WS5-3). REUSE roundPricesInOutput via the condo
// adapter — no rounding logic re-derived. (Mirror of urban roundUrbanOutput.)
// ---------------------------------------------------------------------------

function roundCondoOutput(
  sections: CondoSection[],
  faq: HubFAQItem[],
  input: CondoBuildingGeneratorInput,
): { sections: CondoSection[]; faq: HubFAQItem[] } {
  const adapter = condoInputToStreetAdapter(input);
  const rounded = roundPricesInOutput(
    {
      sections: sections as unknown as StreetSection[],
      faq: faq as unknown as StreetFAQItem[],
    } as StreetGeneratorOutput,
    adapter,
  );
  return {
    sections: rounded.sections as unknown as CondoSection[],
    faq: rounded.faq as unknown as HubFAQItem[],
  };
}

// Shape gate — a half must return exactly the section ids it owns.
function checkExpectedSections(
  sections: CondoSection[],
  expected: CondoSectionId[],
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
// runCondoHalfWithRetry — duplicate of urban runUrbanHalfWithRetry with the
// condo validator pair (validateCondoSectionsSubset + validateCondoFaq) and no
// milton context.
// ---------------------------------------------------------------------------

interface CondoHalfResult {
  sections: CondoSection[];
  faq?: HubFAQItem[];
  attemptCount: number;
  violations: ValidatorViolation[];
  attempts: HubAttempt[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

interface RunCondoHalfParams {
  halfLabel: "editorial" | "market";
  systemPrompt: string;
  expectedSectionIds: CondoSectionId[];
  expectsFaq: boolean;
  input: CondoBuildingGeneratorInput;
  maxAttempts: number;
  provider?: "deepseek" | "claude";
  claudeModel?: ClaudeModelKey;
}

async function runCondoHalfWithRetry(params: RunCondoHalfParams): Promise<CondoHalfResult> {
  const { halfLabel, systemPrompt, expectedSectionIds, expectsFaq, input, maxAttempts, provider = "deepseek", claudeModel = "opus" } = params;
  const attempts: HubAttempt[] = [];
  let totalIn = 0, totalOut = 0, totalCost = 0;
  let lastViolations: ValidatorViolation[] = [];
  let lastSections: CondoSection[] = [];
  let lastFaq: HubFAQItem[] | undefined = undefined;
  const slug = input.building.slug;

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

    const parseResult = tryParseGenerationResponse(response.text, expectsFaq);
    if (parseResult.violation) {
      const violations: ValidatorViolation[] = [{ ...parseResult.violation, sectionId: undefined }];
      attempts.push({ attemptN: attempt, violations, tokens: { in: response.inputTokens, out: response.outputTokens }, costUsd: response.costUsd });
      console.log(`[CondoGen/${halfLabel}] ${slug} attempt ${attempt}: invalid_json_shape (${parseResult.violation.excerpt}) — RETRY`);
      lastViolations = violations;
      continue;
    }
    const candidate = parseResult.candidate!;
    const candidateSections = (candidate.sections ?? []) as unknown as CondoSection[];
    const candidateFaq = (expectsFaq && candidate.faq ? candidate.faq : []) as unknown as HubFAQItem[];

    const rounded = roundCondoOutput(candidateSections, candidateFaq, input);
    const sectionsForValidate = rounded.sections;
    const faqForValidate = expectsFaq ? trimFaqAnswersToSentenceCap(rounded.faq as unknown as StreetFAQItem[]) as unknown as HubFAQItem[] : [];

    const violations: ValidatorViolation[] = [
      ...checkExpectedSections(sectionsForValidate, expectedSectionIds),
      ...validateCondoSectionsSubset(sectionsForValidate, input),
      ...(expectsFaq ? validateCondoFaq(faqForValidate, input) : []),
    ];

    attempts.push({ attemptN: attempt, violations, tokens: { in: response.inputTokens, out: response.outputTokens }, costUsd: response.costUsd });
    const ruleSummary = violations.length === 0 ? "clean" : violations.map((v) => v.sectionId ? `${v.rule}@${v.sectionId}` : v.rule).join(", ");
    console.log(`[CondoGen/${halfLabel}] ${slug} attempt ${attempt}: ${violations.length} violation${violations.length === 1 ? "" : "s"} (${ruleSummary}) | ${response.inputTokens}in/${response.outputTokens}out | $${response.costUsd.toFixed(5)}`);

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
// generateCondoBuildingContent — the condo analogue of generateUrbanHubContent.
// TWO parallel calls; surgical AI_PROVIDER_FALLBACK re-run of only failed
// call(s); merge in canonical condo order; input-aware round; final validate.
// Pure — no DB writes.
// ---------------------------------------------------------------------------

export interface CondoProviderOpts {
  // Primary provider for the two calls. Default 'deepseek' (batch convention).
  // The single-slug DRY proof forces 'claude'/'opus' to isolate orchestrator
  // correctness — NOT baked into the orchestrator default.
  primaryProvider?: "deepseek" | "claude";
  primaryClaudeModel?: ClaudeModelKey;
}

export interface CondoGenerationResult {
  output: { sections: CondoSection[]; faq: HubFAQItem[] };
  attemptCount: number;
  validatorPassed: boolean;
  finalViolations: ValidatorViolation[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  attempts: HubAttempt[];
}

export async function generateCondoBuildingContent(
  buildingSlug: string,
  prebuiltInput?: CondoBuildingGeneratorInput,
  opts?: CondoProviderOpts,
): Promise<CondoGenerationResult> {
  const input = prebuiltInput ?? await buildCondoBuildingInput(buildingSlug);

  const provider = opts?.primaryProvider ?? "deepseek";
  const claudeModel = opts?.primaryClaudeModel ?? "opus";

  const editorialPrompt = loadCondoEditorialPrompt();
  const marketPrompt = loadCondoMarketPrompt(input.saleActive);
  const marketIds = input.saleActive ? MARKET_SALE_ACTIVE_IDS : MARKET_LEASE_ONLY_IDS;

  // Two parallel calls.
  const [editorialRes, marketRes] = await Promise.all([
    runCondoHalfWithRetry({ halfLabel: "editorial", systemPrompt: editorialPrompt, expectedSectionIds: EDITORIAL_SECTION_IDS, expectsFaq: true, input, maxAttempts: 5, provider, claudeModel }),
    runCondoHalfWithRetry({ halfLabel: "market", systemPrompt: marketPrompt, expectedSectionIds: marketIds, expectsFaq: false, input, maxAttempts: 5, provider, claudeModel }),
  ]);

  // Surgical fallback (mirror urban): when AI_PROVIDER_FALLBACK is a Claude mode
  // and a call exhausted its budget with violations, re-run ONLY that call with
  // the fallback model; replace it only if the fallback is clean.
  const fallbackRaw = (process.env.AI_PROVIDER_FALLBACK || "").trim();
  const fallbackModel: ClaudeModelKey | null =
    fallbackRaw === "claude" || fallbackRaw === "opus" ? "opus" :
    fallbackRaw === "sonnet" ? "sonnet" :
    fallbackRaw === "haiku" ? "haiku" : null;

  if (fallbackModel) {
    const calls: Array<{ label: "editorial" | "market"; res: CondoHalfResult; prompt: string; ids: CondoSectionId[]; faq: boolean }> = [];
    if (editorialRes.violations.length > 0) calls.push({ label: "editorial", res: editorialRes, prompt: editorialPrompt, ids: EDITORIAL_SECTION_IDS, faq: true });
    if (marketRes.violations.length > 0) calls.push({ label: "market", res: marketRes, prompt: marketPrompt, ids: marketIds, faq: false });

    if (calls.length > 0) {
      console.log(`[CondoGen] ${buildingSlug} FALLBACK: ${calls.length} call(s) failed primary — retrying with Claude ${fallbackModel}: ${calls.map((c) => c.label).join(", ")}`);
      const results = await Promise.all(calls.map(({ label, prompt, ids, faq }) =>
        runCondoHalfWithRetry({ halfLabel: label, systemPrompt: prompt, expectedSectionIds: ids, expectsFaq: faq, input, maxAttempts: 3, provider: "claude", claudeModel: fallbackModel })
          .catch((e: unknown) => { console.log(`[CondoGen/${label}-fallback] ${buildingSlug}: threw — ${e instanceof Error ? e.message : String(e)}`); return null; })
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

  const totalInputTokens = editorialRes.totalInputTokens + marketRes.totalInputTokens;
  const totalOutputTokens = editorialRes.totalOutputTokens + marketRes.totalOutputTokens;
  const totalCostUsd = editorialRes.totalCostUsd + marketRes.totalCostUsd;
  const attemptCount = Math.max(editorialRes.attemptCount, marketRes.attemptCount);
  const attempts: HubAttempt[] = [...editorialRes.attempts, ...marketRes.attempts];

  // If any call exhausted its retry budget, fail-closed (throw) — the entry
  // catches this and routes to StreetGenerationReview (condo:<slug>).
  const callFailures: ValidatorViolation[] = [...editorialRes.violations, ...marketRes.violations];
  if (callFailures.length > 0) {
    throw new HubGenerationError(
      `Condo two-call generation failed: editorial=${editorialRes.violations.length}, market=${marketRes.violations.length} violation(s) after ${attemptCount} attempts.`,
      { violations: callFailures, attemptCount, totalInputTokens, totalOutputTokens, totalCostUsd, attempts },
    );
  }

  // Combine in canonical condo order, post-process (faq trim + round), final-validate.
  const merged: CondoSection[] = [...editorialRes.sections, ...marketRes.sections];
  const orderedSections = CONDO_SECTION_ORDER
    .map((id) => merged.find((s) => s.id === id))
    .filter((s): s is CondoSection => s !== undefined);
  const faqTrimmed = trimFaqAnswersToSentenceCap((editorialRes.faq ?? []) as unknown as StreetFAQItem[]) as unknown as HubFAQItem[];
  const finalOutput = roundCondoOutput(orderedSections, faqTrimmed, input);

  // Final validation on the combined output (section + FAQ gates, incl. subk).
  const finalViolations = [
    ...validateCondoSectionsSubset(finalOutput.sections, input),
    ...validateCondoFaq(finalOutput.faq, input),
  ];
  const wordTotal = finalOutput.sections.reduce((sum, s) => sum + s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length, 0);
  console.log(`[CondoGen] ${buildingSlug} combined: ${wordTotal} words, editorial=${editorialRes.attemptCount}+market=${marketRes.attemptCount} attempts, total $${totalCostUsd.toFixed(5)}, ${finalViolations.length === 0 ? "PASS" : `FAIL (${finalViolations.length} combined violations)`}`);

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
