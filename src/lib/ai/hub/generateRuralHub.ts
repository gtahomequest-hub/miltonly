// src/lib/ai/hub/generateRuralHub.ts
// WS5 Stage 2 — RURAL hub generation ENTRY (A1 persistence + fail-closed).
//
// Mirrors the street terminal-status contract in generateStreet.ts:319-475:
//   1. Build the rural input once and compute its inputHash.
//   2. Atomic claim into HubGeneration (insert-or-flip-to-generating) so two
//      workers never double-generate the same neighbourhood.
//   3. Run generateRuralHubContent (the orchestrator) with the pre-built input.
//   4. Terminal writes:
//      - retry-exhausted (HubGenerationError thrown) → HubGeneration.status=failed
//        + telemetry; routeHubGeneration(hub:<slug>) records the review row;
//        HubContent is NOT written (prior published row preserved).
//      - combined-validator failure (validatorPassed=false) → same fail-closed.
//      - clean → HubGeneration.status=succeeded + sectionsJson/faqJson/telemetry;
//        routeHubGeneration([]) clears any prior review row; dual-write HubContent
//        (the published surface).
//
// This is a callable function (used by the WS5 generation step / a thin script).
// It is NOT auto-run on any slug here. The fail-closed queue is the EXISTING
// StreetGenerationReview, keyed hub:<slug> via routeHubGeneration — no new table.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { buildRuralHubInput } from "@/lib/ai/buildHubInput";
import { routeHubGeneration } from "@/lib/ai/hub/hubFailClosed";
import {
  generateRuralHubContent,
  HubGenerationError,
} from "@/lib/ai/hub/generateHubContent";

export interface GenerateRuralHubResult {
  neighbourhoodSlug: string;
  published: boolean;
  validatorPassed: boolean;
  attempts: number;
  queued: boolean;
}

export async function generateRuralHub(neighbourhoodSlug: string): Promise<GenerateRuralHubResult> {
  // Throws unless profile==='rural_hub' (guard lives in buildRuralHubInput).
  const input = await buildRuralHubInput(neighbourhoodSlug);
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");

  // Atomic claim — insert-or-flip-to-generating (mirror generateStreet.ts:319-334).
  await prisma.$queryRaw`
    INSERT INTO "HubGeneration" (
      "neighbourhoodSlug", "sectionsJson", "faqJson", "inputHash",
      "status", "generatedAt", "attemptCount", "wordCounts", "totalWords"
    ) VALUES (
      ${neighbourhoodSlug}, '[]'::jsonb, '[]'::jsonb, ${inputHash},
      'generating'::"GenerationStatus", NOW(), 0, '{}'::jsonb, 0
    )
    ON CONFLICT ("neighbourhoodSlug") DO UPDATE
      SET "status"      = 'generating'::"GenerationStatus",
          "inputHash"   = EXCLUDED."inputHash",
          "generatedAt" = NOW()
      WHERE "HubGeneration"."status" <> 'generating'::"GenerationStatus"
  `;

  let result: Awaited<ReturnType<typeof generateRuralHubContent>>;
  try {
    result = await generateRuralHubContent(neighbourhoodSlug, input);
  } catch (err) {
    // Retry-exhausted: HubGenerationError carries violations + telemetry.
    const isHubErr = err instanceof HubGenerationError;
    const violations = isHubErr ? err.payload.violations : [];
    const attemptCount = isHubErr ? err.payload.attemptCount : 0;
    const tokensIn = isHubErr ? err.payload.totalInputTokens : 0;
    const tokensOut = isHubErr ? err.payload.totalOutputTokens : 0;
    const costUsd = isHubErr ? err.payload.totalCostUsd : 0;

    await prisma.hubGeneration.update({
      where: { neighbourhoodSlug },
      data: { status: "failed", attemptCount, tokensIn, tokensOut, costUsd, inputHash },
    });
    await routeHubGeneration(neighbourhoodSlug, violations, inputHash);
    console.log(
      `[generateRuralHub] ${neighbourhoodSlug}: FAIL-CLOSED (retry exhausted) — ` +
        `HubGeneration=failed, routed to review (hub:${neighbourhoodSlug}). HubContent untouched.`,
    );
    if (!isHubErr) throw err; // unexpected error — surface after recording state
    return { neighbourhoodSlug, published: false, validatorPassed: false, attempts: attemptCount, queued: violations.length > 0 };
  }

  const { output, validatorPassed, finalViolations, attemptCount, totalInputTokens, totalOutputTokens, totalCostUsd } = result;
  const sections = output.sections;
  const faq = output.faq;

  const wordCounts: Record<string, number> = {};
  let totalWords = 0;
  for (const s of sections) {
    const w = s.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
    wordCounts[s.id] = w;
    totalWords += w;
  }

  if (!validatorPassed) {
    // Halves passed individually but combined validation failed → fail closed.
    await prisma.hubGeneration.update({
      where: { neighbourhoodSlug },
      data: { status: "failed", attemptCount, tokensIn: totalInputTokens, tokensOut: totalOutputTokens, costUsd: totalCostUsd, inputHash },
    });
    await routeHubGeneration(neighbourhoodSlug, finalViolations, inputHash);
    console.log(
      `[generateRuralHub] ${neighbourhoodSlug}: FAIL-CLOSED (combined validation) — ` +
        `HubContent upsert skipped. Prior published row (if any) preserved.`,
    );
    return { neighbourhoodSlug, published: false, validatorPassed: false, attempts: attemptCount, queued: finalViolations.length > 0 };
  }

  // Clean — succeed HubGeneration, clear any review row, dual-write HubContent.
  await prisma.hubGeneration.update({
    where: { neighbourhoodSlug },
    data: {
      sectionsJson: sections as unknown as object,
      faqJson: faq as unknown as object,
      inputHash,
      status: "succeeded",
      generatedAt: new Date(),
      attemptCount,
      wordCounts,
      totalWords,
      tokensIn: totalInputTokens,
      tokensOut: totalOutputTokens,
      costUsd: totalCostUsd,
    },
  });
  await routeHubGeneration(neighbourhoodSlug, [], inputHash); // clears prior review row

  const description = sections.flatMap((s) => s.paragraphs).join("\n\n");
  const metaTitle = `${input.neighbourhood.name} ${config.CITY_NAME} Neighbourhood Guide | Homes, Roads & Market`;
  const metaDescription =
    `${input.neighbourhood.name}, ${config.CITY_NAME}: local character, a light market read, and the roads that make up the area.`;

  await prisma.hubContent.upsert({
    where: { neighbourhoodSlug },
    create: {
      neighbourhoodSlug,
      neighbourhoodName: input.neighbourhood.name,
      description,
      rawAiOutput: "",
      metaTitle,
      metaDescription,
      faqJson: JSON.stringify(faq),
      statsJson: JSON.stringify(input.aggregates),
      marketDataHash: inputHash,
      status: "published",
      needsReview: false,
      aiGenerated: true,
      publishedAt: new Date(),
      generatedAt: new Date(),
      attempts: attemptCount,
    },
    update: {
      neighbourhoodName: input.neighbourhood.name,
      description,
      rawAiOutput: "",
      metaTitle,
      metaDescription,
      faqJson: JSON.stringify(faq),
      statsJson: JSON.stringify(input.aggregates),
      marketDataHash: inputHash,
      status: "published",
      needsReview: false,
      publishedAt: new Date(),
      generatedAt: new Date(),
      attempts: attemptCount,
    },
  });

  console.log(
    `[generateRuralHub] ${neighbourhoodSlug}: PUBLISHED — ${totalWords} words, ` +
      `${attemptCount} attempt(s), $${totalCostUsd.toFixed(5)}.`,
  );
  return { neighbourhoodSlug, published: true, validatorPassed: true, attempts: attemptCount, queued: false };
}
