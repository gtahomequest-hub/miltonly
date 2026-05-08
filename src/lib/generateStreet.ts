// Street-content generation core. Extracted from
// src/app/api/sync/generate/route.ts so both the normal cron-driven route
// and the admin force-regenerate route share the exact same prompt,
// validator, compliance gateway, and DB write shape. All Claude calls go
// through src/lib/ai/compliance.ts — no other entry point exists.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getStreetStats } from "@/lib/streetDecision";
import { calcMarketDataHash, deriveIdentity } from "@/lib/streetUtils";
import { sendSMS } from "@/lib/smsAlert";
import { buildGeneratorInput } from "@/lib/ai/buildGeneratorInput";
import {
  generateStreetDescription as aiGenerate,
  generateLongFormStreetDescription,
  generatePhase41StreetContent,
  Phase41GenerationError,
  type SafeStreetStats,
} from "@/lib/ai/compliance";

// UPG-4 Stage 2 Piece 2: Feature flag selects AI provider.
// AI_PROVIDER unset OR "anthropic" → legacy 300-word Anthropic path (default).
// AI_PROVIDER="deepseek_v2" → new 1,400-word DeepSeek 7-pass path.
// Flag is read at runtime so flipping in Vercel env takes effect on next request,
// no rebuild required.
const AI_PROVIDER_V2 = "deepseek_v2";
function isDeepSeekV2(): boolean {
  return (process.env.AI_PROVIDER || "").trim() === AI_PROVIDER_V2;
}

// Phase 4.1: structured 8-section + FAQ output via DeepSeek + strict validator + retry.
// AI_PROVIDER="phase41_v2" → buildGeneratorInput + generatePhase41StreetContent path.
// Mutually exclusive with "deepseek_v2"; checked first because it is the migration target.
const AI_PROVIDER_PHASE41 = "phase41_v2";
function isPhase41V2(): boolean {
  return (process.env.AI_PROVIDER || "").trim() === AI_PROVIDER_PHASE41;
}

const BANNED_WORDS = [
  "nestled", "charming", "vibrant", "picturesque", "bustling",
  "sought-after", "stunning", "dream home", "perfect blend",
  "a stone's throw", "boasts", "in the heart of", "don't miss",
  "rare opportunity", "pride of ownership", "meticulously",
  "truly special", "ideal for families", "conveniently located",
  "this is the one", "look no further", "tranquil", "serene",
  "oasis", "turnkey", "hidden gem", "breathtaking", "sophisticated",
  "prestigious", "remarkable", "exceptional", "incredible", "amazing",
];

// Milton-specific anchor list used by the validator's "needs ≥2 known anchors"
// rule. Sources from config.ai.knownAnchors so a city fork can swap in
// destination-specific anchors. Note: SYSTEM_PROMPT below still embeds the
// historical Milton anchor list inline — full prompt extraction is deferred
// until the prompt is rewritten as a city-agnostic template.
const KNOWN_ANCHORS = config.ai.knownAnchors;

const SYSTEM_PROMPT = `You are a local Milton Ontario real estate expert writing for Miltonly.com. You have 10+ years of experience selling homes in Milton. You know every street personally.

Write a 3-paragraph street description (300-340 words total) that is specific, data-driven, and reads like a knowledgeable local expert wrote it — not a machine.

BANNED WORDS — never use any of these:
nestled, charming, vibrant, picturesque, bustling, sought-after, stunning, dream home, perfect blend, a stone's throw, boasts, in the heart of, don't miss, rare opportunity, pride of ownership, meticulously, truly special, ideal for families, conveniently located, this is the one, look no further, tranquil, serene, oasis, turnkey, hidden gem, breathtaking, sophisticated, prestigious, remarkable, exceptional, incredible, amazing

HARD RULES:
1. No sentence longer than 25 words
2. No passive voice
3. Must include the actual dollar figure (e.g. $1.24M)
4. Must include the actual days on market as a number
5. Must name at least one real Milton school
6. Must reference Milton GO station or Highway 401 by name
7. Must not start with the street name
8. Must not start with "Located" or "Situated"
9. Write in second or third person — never first person
10. Must include at least 2 Milton-specific anchors from: Milton GO station, Union Station, Craig Kielburger, Bishop Reding, Milton District Hospital, Tiger Jeet Singh PS, Stuart E. Russell PS, Sam Sherratt PS, Escarpment, Kelso Conservation Area, Highway 401, Willmott, Coates, Clarke, Beaty, Dempsey, Old Milton, Hawthorne, Scott, Harrison

STRUCTURE:
Paragraph 1 (~100 words): Life on this street. Location in Milton, nearest schools and parks, GO train access, neighbourhood character. Be specific. Name real Milton places.

Paragraph 2 (~120 words): The real estate market. Property types found here, price range, how fast homes sell, who typically buys here. Use real numbers. Write the dollar figure and days on market naturally inside a sentence — never as a bullet point.

Paragraph 3 (~100 words): Buyer perspective. Why people specifically choose this street, price trend context, commute story (GO or 401), what makes this street different from adjacent ones. End with a specific insight — not a call to action.

Total: 300-340 words.
Write the description only. No preamble. No explanation.`;

export function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price.toLocaleString()}`;
}

interface ValidationResult {
  passed: boolean;
  failures: string[];
}

function validateContent(text: string, streetName: string): ValidationResult {
  const failures: string[] = [];
  const lower = text.toLowerCase();

  const foundBanned = BANNED_WORDS.filter((w) => lower.includes(w.toLowerCase()));
  if (foundBanned.length > 0) failures.push(`Banned words found: ${foundBanned.join(", ")}`);

  if (!/\$[\d,\.]+[MKB]?/i.test(text)) failures.push("Missing dollar figure");
  if (!/\d+\s*days?/i.test(text)) failures.push("Missing days on market number");

  const schools = ["Craig Kielburger", "Bishop Reding", "Tiger Jeet Singh", "Stuart E. Russell", "Sam Sherratt"];
  const hasSchool = schools.some((s) => text.includes(s));
  const hasTransit = /\bGO\b/.test(text) || text.includes("401") || text.includes("Union Station");
  if (!hasSchool) failures.push(`Missing ${config.CITY_NAME} school name`);
  if (!hasTransit) failures.push("Missing GO station / Highway 401 / Union Station reference");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 280) failures.push(`Too short: ${wordCount} words (min 280)`);
  if (wordCount > 360) failures.push(`Too long: ${wordCount} words (max 360)`);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) {
    const sw = s.trim().split(/\s+/).filter(Boolean).length;
    if (sw > 30) failures.push(`Sentence too long (${sw} words): "${s.trim().slice(0, 60)}..."`);
  }

  const foundAnchors = KNOWN_ANCHORS.filter((a) => text.includes(a));
  if (foundAnchors.length < 2) failures.push(`Only ${foundAnchors.length} ${config.CITY_NAME} anchors (need 2+). Found: ${foundAnchors.join(", ") || "none"}`);

  const first30 = text.slice(0, 30).toLowerCase();
  if (first30.includes(streetName.toLowerCase())) failures.push("Starts with the street name");

  const trimmed = text.trimStart();
  if (/^(located|situated)/i.test(trimmed)) failures.push("Starts with 'Located' or 'Situated'");

  return { passed: failures.length === 0, failures };
}

async function generateDescription(
  streetName: string,
  stats: NonNullable<Awaited<ReturnType<typeof getStreetStats>>>,
  previousFailure?: string
): Promise<string> {
  const bestMonth = stats.monthlyTrend.length > 0
    ? stats.monthlyTrend.reduce((a, b) => (b.salesCount > a.salesCount ? b : a)).month
    : "N/A";

  let userPrompt = "";
  if (previousFailure) {
    userPrompt += `Your previous attempt failed because: ${previousFailure}\nFix only that issue. Keep everything else the same.\n\n`;
  }

  userPrompt += `Write a street description for ${streetName} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}.

Real market data — use all of this naturally in the text:
- Street: ${streetName}, ${stats.neighbourhood} neighbourhood
- Average list price: ${formatPrice(stats.avgListPrice)}
- Closed home sales on record: ${stats.totalSold12mo}
- Average days on market: ${stats.avgDOM} days
- Active listings right now: ${stats.activeCount}
- Primary property type: ${stats.dominantPropertyType}
- School zone: ${stats.schoolZone || `${config.CITY_NAME} public schools`}
- Price trend: Prices have ${stats.priceDirection}
- Most active month recently: ${bestMonth}`;

  const safeStats: SafeStreetStats = {
    streetName,
    neighbourhood: stats.neighbourhood,
    avgListPrice: stats.avgListPrice,
    medianListPrice: stats.medianListPrice,
    totalSold12mo: stats.totalSold12mo,
    avgDOM: stats.avgDOM,
    activeCount: stats.activeCount,
    dominantPropertyType: stats.dominantPropertyType,
    priceDirection: stats.priceDirection,
    schoolZone: stats.schoolZone,
    bestMonth,
  };

  // UPG-4 Stage 2 Piece 2: Feature-flag-gated provider selection.
  if (isDeepSeekV2()) {
    const deepSeekResult = await generateLongFormStreetDescription(safeStats, {
      cityName: config.CITY_NAME,
      cityProvince: config.CITY_PROVINCE,
    });
    // The DeepSeek function runs its own v2 validator internally and applies
    // post-trim. We trust its output; the legacy validateContent() in this
    // module will be bypassed by generateStreetContent() when the flag is set.
    return deepSeekResult.text;
  }

  const result = await aiGenerate(SYSTEM_PROMPT, userPrompt, safeStats);
  return result.text;
}

function buildFaqJson(
  streetName: string,
  stats: NonNullable<Awaited<ReturnType<typeof getStreetStats>>>
): string {
  return JSON.stringify([
    {
      q: `What is the average home price on ${streetName} in Milton?`,
      a: `The average list price on ${streetName} in Milton is ${formatPrice(stats.avgListPrice)}. Register for full MLS® access to see detailed market data for this street, including historical transaction records.`,
    },
    {
      q: `How long do homes take to sell on ${streetName} Milton?`,
      a: `Active listings on ${streetName} in Milton have been on market an average of ${stats.avgDOM} days. ${stats.totalSold12mo} sold transactions on record for this street — exact days-on-market per transaction is available to registered users.`,
    },
    {
      q: `What types of homes are on ${streetName} in Milton?`,
      a: `The most common property type on ${streetName} is ${stats.dominantPropertyType}. The street is in the ${stats.neighbourhood} neighbourhood of Milton, Ontario.`,
    },
    {
      q: `What school zone is ${streetName} Milton in?`,
      a: `${streetName} in Milton falls within the ${stats.schoolZone || "Milton public"} school catchment area.`,
    },
    {
      q: `How far is ${streetName} Milton from the GO station?`,
      a: `${streetName} is located in Milton's ${stats.neighbourhood} neighbourhood. Milton GO station provides direct service to Union Station in downtown Toronto. Drive times to Highway 401 vary by exact location on the street.`,
    },
  ]);
}

export interface GenerateResult {
  streetName: string;
  passed: boolean;
  attempts: number;
  // Phase 4.1 v2 in-memory output. Populated only when AI_PROVIDER=phase41_v2
  // and the generator returns (success path). Lets callers gate against the
  // actual generated content rather than reading back from the DB row, which
  // can be stale on the failure path.
  v2?: {
    sections: { id: string; heading: string; paragraphs: string[] }[];
    faq: { question: string; answer: string }[];
    wordCounts: Record<string, number>;
    totalWords: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    kAnonLevel: "full" | "thin" | "zero";
  };
}

export interface GenerateOptions {
  // Suppress the per-street SMS. Used for bulk force-regenerate to avoid
  // texting the owner 45+ times in a row.
  skipSms?: boolean;
}

/**
 * Full pipeline: stats → AI (up to 3 attempts with feedback retry) →
 * validator → upsert StreetContent row. Does NOT touch StreetQueue — that
 * housekeeping is the caller's responsibility because it differs between
 * normal cron runs and one-off force regenerations.
 */
export async function generateStreetContent(
  streetSlug: string,
  streetName: string,
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  // Slug canonicalization at write-time entry. Mirrors the render-layer
  // identity logic in deriveIdentity() — abbreviated suffix tokens (crt, blvd,
  // ave, dr, trl, cres, terr, …) collapse to their full-word canonical form
  // (court, boulevard, avenue, drive, trail, crescent, terrace, …). Defense-
  // in-depth: today's call sites already pass canonical slugs, but this guard
  // means any future ingestion or admin path that fails to canonicalize will
  // not write divergent slugs to StreetGeneration / StreetContent.
  const canonicalSlug = deriveIdentity(streetSlug)?.canonicalSlug ?? streetSlug;
  if (canonicalSlug !== streetSlug) {
    console.log(
      `[generateStreetContent] slug canonicalized at entry: ${streetSlug} -> ${canonicalSlug}`
    );
    streetSlug = canonicalSlug;
  }

  const stats = await getStreetStats(streetSlug);
  if (!stats) throw new Error("No stats available");

  // Hoisted so v2 branch results are accessible after the if/else block closes,
  // for the FAQ + needsReview overrides at the StreetContent upsert below.
  // StreetContent.faqJson is a Text column holding a JSON-stringified array,
  // so we stringify here to match the legacy buildFaqJson() shape.
  let phase41FaqOverride: string | null = null;
  let phase41NeedsReview: boolean | null = null;
  let phase41V2Out: GenerateResult["v2"] = undefined;

  const marketDataHash = calcMarketDataHash(stats);
  let description = "";
  let rawAiOutput = "";
  let attempts = 0;
  let lastFailures: string[] = [];

  // Phase 4.1 v2 path: structured 8-section + FAQ output, dual-writes to both
  // StreetContent (operational metadata for sitemap/admin/crons) and
  // StreetGeneration (structured prose for page renderer). Five non-renderer
  // read surfaces only know about StreetContent, so dual-write is mandatory
  // until full migration off StreetContent in a future phase.
  // DEC-PH41-DUALWRITE locked 2026-05-05.
  if (isPhase41V2()) {
    // PHASE41_HALT feature flag: blocks NEW Phase 4.1 generations while the
    // numeric-grounding validator + architecture decision is in flight.
    // In-flight work that's already past this gate drains naturally through
    // the validator path (which now has numeric_ungrounded wired in), so we
    // don't waste cost on aborts. Set to false once the architecture
    // decision resolves.
    if ((process.env.PHASE41_HALT || "").trim() === "true") {
      console.log(
        `[generateStreetContent] Phase 4.1 generation halted by PHASE41_HALT feature flag. ` +
        `New generations blocked. In-flight work draining through validator. ` +
        `Set to false when validator deploys and architecture decision resolves. ` +
        `(slug=${streetSlug})`
      );
      return { streetName, passed: false, attempts: 0 };
    }

    const phase41Input = await buildGeneratorInput(streetSlug);
    const inputHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(phase41Input))
      .digest("hex");

    // Atomic claim: insert-or-flip-to-generating in StreetGeneration.
    // Mirrors scripts/backfill-descriptions.ts:507 pattern.
    await prisma.$queryRaw`
      INSERT INTO "StreetGeneration" (
        "streetSlug", "sectionsJson", "faqJson", "inputHash",
        "status", "generatedAt", "attemptCount", "wordCounts", "totalWords"
      ) VALUES (
        ${streetSlug}, '[]'::jsonb, '[]'::jsonb, ${inputHash},
        'generating'::"GenerationStatus", NOW(), 0, '{}'::jsonb, 0
      )
      ON CONFLICT ("streetSlug") DO UPDATE
        SET "status"      = 'generating'::"GenerationStatus",
            "inputHash"   = EXCLUDED."inputHash",
            "generatedAt" = NOW()
        WHERE "StreetGeneration"."status" <> 'generating'::"GenerationStatus"
    `;

    let phase41Result;
    try {
      phase41Result = await generatePhase41StreetContent(phase41Input);
    } catch (err) {
      // Phase41GenerationError carries violations + telemetry on retry-exhausted
      // failures. Plain Errors (network hiccup, JSON parse hard fail before
      // retry layer) carry no violations. Handle both.
      const isPhase41Err = err instanceof Phase41GenerationError;
      const violations = isPhase41Err ? err.payload.violations : [];
      const attemptCountFromErr = isPhase41Err ? err.payload.attemptCount : 0;
      const tokensInFromErr = isPhase41Err ? err.payload.totalInputTokens : 0;
      const tokensOutFromErr = isPhase41Err ? err.payload.totalOutputTokens : 0;
      const costFromErr = isPhase41Err ? err.payload.totalCostUsd : 0;

      // Update the StreetGeneration row with telemetry and terminal status.
      await prisma.streetGeneration.update({
        where: { streetSlug },
        data: {
          status: "failed",
          attemptCount: attemptCountFromErr,
          tokensIn: tokensInFromErr,
          tokensOut: tokensOutFromErr,
          costUsd: costFromErr,
          inputHash,
        },
      });

      // Write the review row so admin tooling can surface the failure
      // with violation details. Mirrors writeFailure() in
      // scripts/backfill-descriptions.ts:560-595.
      if (violations.length > 0) {
        await prisma.streetGenerationReview.upsert({
          where: { streetSlug },
          update: {
            violations: violations as unknown as object,
            lastAttemptAt: new Date(),
            lastInputHash: inputHash,
          },
          create: {
            streetSlug,
            violations: violations as unknown as object,
            lastAttemptAt: new Date(),
            lastInputHash: inputHash,
          },
        });
      }

      throw err;
    }

    const v2Passed = phase41Result.validatorPassed;
    const v2Sections = phase41Result.output.sections;
    const v2Faq = phase41Result.output.faq;
    attempts = phase41Result.attemptCount;

    // Compute per-section word counts + total for StreetGeneration row.
    const wordCounts: Record<string, number> = {};
    let totalWords = 0;
    for (const s of v2Sections) {
      const sectionWords = s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
      wordCounts[s.id] = sectionWords;
      totalWords += sectionWords;
    }

    // Update StreetGeneration with succeeded or failed terminal state.
    if (v2Passed) {
      await prisma.streetGeneration.update({
        where: { streetSlug },
        data: {
          sectionsJson: v2Sections as unknown as object,
          faqJson: v2Faq as unknown as object,
          inputHash,
          status: "succeeded",
          generatedAt: new Date(),
          attemptCount: attempts,
          wordCounts,
          totalWords,
          tokensIn: phase41Result.totalInputTokens,
          tokensOut: phase41Result.totalOutputTokens,
          costUsd: phase41Result.totalCostUsd,
        },
      });
      // Clear any prior review row.
      await prisma.streetGenerationReview
        .delete({ where: { streetSlug } })
        .catch(() => undefined);
    } else {
      await prisma.streetGeneration.update({
        where: { streetSlug },
        data: {
          status: "failed",
          attemptCount: attempts,
          tokensIn: phase41Result.totalInputTokens,
          tokensOut: phase41Result.totalOutputTokens,
          costUsd: phase41Result.totalCostUsd,
          inputHash,
        },
      });
      await prisma.streetGenerationReview.upsert({
        where: { streetSlug },
        update: {
          violations: phase41Result.finalViolations as unknown as object,
          lastAttemptAt: new Date(),
          lastInputHash: inputHash,
        },
        create: {
          streetSlug,
          violations: phase41Result.finalViolations as unknown as object,
          lastAttemptAt: new Date(),
          lastInputHash: inputHash,
        },
      });
    }

    phase41NeedsReview = !v2Passed;
    phase41V2Out = {
      sections: v2Sections,
      faq: v2Faq,
      wordCounts,
      totalWords,
      tokensIn: phase41Result.totalInputTokens,
      tokensOut: phase41Result.totalOutputTokens,
      costUsd: phase41Result.totalCostUsd,
      kAnonLevel: phase41Input.aggregates.kAnonLevel,
    };

    // Build the flattened description for StreetContent fallback rendering
    // and SEO failover. ALL 8 sections' paragraphs joined with double-newline.
    // This is what Google indexes if loadStreetGeneration ever returns null
    // for this street; must contain real content, not a stub.
    description = v2Sections
      .flatMap((s) => s.paragraphs)
      .join("\n\n");
    rawAiOutput = ""; // raw debugging captured in StreetGeneration.sectionsJson

    phase41FaqOverride = JSON.stringify(v2Faq);
  } else if (isDeepSeekV2()) {
    rawAiOutput = await generateDescription(streetName, stats);
    description = rawAiOutput;
    attempts = 1;
  } else {
    for (attempts = 1; attempts <= 3; attempts++) {
      const failureReason = lastFailures.length > 0 ? lastFailures.join("; ") : undefined;
      rawAiOutput = await generateDescription(streetName, stats, failureReason);
      const validation = validateContent(rawAiOutput, streetName);

      if (validation.passed) {
        description = rawAiOutput;
        break;
      }

      lastFailures = validation.failures;
      console.log(`${streetName} attempt ${attempts} failed:`, validation.failures);
    }
  }

  const passed = description.length > 0;
  if (!passed) description = rawAiOutput;

  const metaTitle = `${streetName} ${config.CITY_NAME} Real Estate | Homes, Prices & Market Data`;
  const metaDescription = `${stats.totalSold12mo} homes sold on ${streetName} recently. Average list price ${formatPrice(stats.avgListPrice)}. ${stats.avgDOM} days on market. ${config.CITY_NAME}'s most detailed street guide.`;
  const faqJson = phase41FaqOverride ?? buildFaqJson(streetName, stats);

  const contentStatus = passed ? "published" : "draft";

  await prisma.streetContent.upsert({
    where: { streetSlug },
    create: {
      streetSlug,
      streetName,
      neighbourhood: stats.neighbourhood,
      description,
      rawAiOutput,
      metaTitle,
      metaDescription,
      faqJson,
      statsJson: JSON.stringify(stats),
      marketDataHash,
      status: contentStatus,
      needsReview: phase41NeedsReview ?? !passed,
      aiGenerated: true,
      publishedAt: passed ? new Date() : null,
      generatedAt: new Date(),
      attempts,
    },
    update: {
      description,
      rawAiOutput,
      neighbourhood: stats.neighbourhood,
      metaTitle,
      metaDescription,
      faqJson,
      statsJson: JSON.stringify(stats),
      marketDataHash,
      status: contentStatus,
      needsReview: phase41NeedsReview ?? !passed,
      publishedAt: passed ? new Date() : undefined,
      generatedAt: new Date(),
      attempts,
    },
  });

  if (!opts.skipSms) {
    await sendSMS(
      passed
        ? `\u2713 Published: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgListPrice)} avg list\n${config.SITE_DOMAIN}/streets/${streetSlug}`
        : `\u{1f4dd} Draft needs review: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgListPrice)} avg list\nmiltonly.vercel.app/admin/review`
    );
  }

  return {
    streetName,
    passed,
    attempts,
    v2: phase41V2Out,
  };
}

/**
 * Render-time fallback used by /streets/[slug]. Returns the stored
 * StreetContent description if one exists and is fresher than 30 days;
 * otherwise triggers the canonical generation pipeline, then returns the
 * newly written row. If generation fails (e.g. no DB3 stats yet for a
 * new street), returns a minimal placeholder — the cron will re-try
 * and populate a full description on the next pass.
 */
export async function getOrGenerateStreetContent(
  slug: string,
  data: { streetName: string }
): Promise<{ description: string; needsReview: boolean }> {
  const existing = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });
  if (existing) {
    const daysSince = (Date.now() - existing.generatedAt.getTime()) / 86400000;
    if (daysSince < 30) {
      return { description: existing.description, needsReview: existing.needsReview };
    }
  }

  try {
    await generateStreetContent(slug, data.streetName, { skipSms: true });
    const after = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });
    if (after) return { description: after.description, needsReview: after.needsReview };
  } catch (e) {
    console.error(`[generateStreet] render-time fallback failed for ${slug}:`, e);
  }

  return {
    description:
      `${data.streetName} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}. Full street data is being prepared — ` +
      `registered users will see detailed market intelligence here shortly.`,
    needsReview: true,
  };
}
