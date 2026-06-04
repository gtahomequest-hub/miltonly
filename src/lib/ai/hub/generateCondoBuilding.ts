// src/lib/ai/hub/generateCondoBuilding.ts
// WS5 — CONDO-BUILDING generation ENTRY (persistence + fail-closed). The condo
// analogue of generateUrbanHub.ts; mirrors its terminal-status contract
// verbatim, writing the NEW CondoGeneration/CondoContent pair and reusing the
// EXISTING failure queue (StreetGenerationReview, key condo:<slug> via
// routeCondoGeneration — already built in WS4 patch 2).
//
//   1. GATE: refuse unless CONDO_ENABLED==='true' (dormant until flipped — the
//      84-building batch cannot run by accident). The PURE orchestrator
//      generateCondoBuildingContent is NOT gated (the DRY proof uses it, writes nothing).
//   2. ZERO-DATA GUARD: a building with saleCount12mo===0 AND leaseCount12mo===0
//      (24 of 108) has nothing to ground ANY section — refuse before any write.
//   3. Build the condo input; compute inputHash.
//   4. Atomic claim into CondoGeneration (insert-or-flip-to-'generating').
//   5. Terminal writes (identical contract to rural/urban):
//      - retry-exhausted (HubGenerationError) → CondoGeneration.status=failed +
//        routeCondoGeneration(condo:<slug>); CondoContent NOT written (prior row preserved).
//      - combined-validator failure → same fail-closed.
//      - clean → CondoGeneration.status=succeeded + dual-write CondoContent (published).

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { buildCondoBuildingInput } from "@/lib/ai/buildCondoBuildingInput";
import { routeCondoGeneration } from "@/lib/ai/hub/condoFailClosed";
import { HubGenerationError } from "@/lib/ai/hub/generateHubContent";
import {
  generateCondoBuildingContent,
  type CondoProviderOpts,
} from "@/lib/ai/hub/generateCondoBuildingContent";

export interface GenerateCondoBuildingResult {
  buildingSlug: string;
  published: boolean;
  validatorPassed: boolean;
  attempts: number;
  queued: boolean;
  skipped: boolean; // true only for the zero-data refusal
}

export function condoEnabled(): boolean {
  return (process.env.CONDO_ENABLED || "").trim() === "true";
}

export async function generateCondoBuilding(
  buildingSlug: string,
  opts?: CondoProviderOpts,
): Promise<GenerateCondoBuildingResult> {
  // GATE — dormant until explicitly flipped. The pure orchestrator is ungated
  // (DRY proof path); only the persisting entry is guarded.
  if (!condoEnabled()) {
    throw new Error(
      `generateCondoBuilding: CONDO_ENABLED is not 'true' — condo generation is gated off ` +
        `(dormant). Set CONDO_ENABLED=true to enable the building batch.`,
    );
  }

  // Throws if the building is missing or unkeyed (guard lives in the builder).
  const input = await buildCondoBuildingInput(buildingSlug);

  // ZERO-DATA GUARD — nothing to ground any section; refuse before any write.
  if (!input.saleActive && input.lease.leaseCount12mo === 0) {
    console.log(
      `[generateCondoBuilding] ${buildingSlug}: SKIPPED (zero-data — saleCount12mo=0, ` +
        `leaseCount12mo=0). No generation, no writes.`,
    );
    return { buildingSlug, published: false, validatorPassed: false, attempts: 0, queued: false, skipped: true };
  }

  const inputHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");

  // Atomic claim — insert-or-flip-to-generating (mirror generateUrbanHub.ts).
  await prisma.$queryRaw`
    INSERT INTO "CondoGeneration" (
      "buildingSlug", "sectionsJson", "faqJson", "inputHash",
      "status", "generatedAt", "attemptCount", "wordCounts", "totalWords"
    ) VALUES (
      ${buildingSlug}, '[]'::jsonb, '[]'::jsonb, ${inputHash},
      'generating'::"GenerationStatus", NOW(), 0, '{}'::jsonb, 0
    )
    ON CONFLICT ("buildingSlug") DO UPDATE
      SET "status"      = 'generating'::"GenerationStatus",
          "inputHash"   = EXCLUDED."inputHash",
          "generatedAt" = NOW()
      WHERE "CondoGeneration"."status" <> 'generating'::"GenerationStatus"
  `;

  let result: Awaited<ReturnType<typeof generateCondoBuildingContent>>;
  try {
    result = await generateCondoBuildingContent(buildingSlug, input, opts);
  } catch (err) {
    // Retry-exhausted: HubGenerationError carries violations + telemetry.
    const isHubErr = err instanceof HubGenerationError;
    const violations = isHubErr ? err.payload.violations : [];
    const attemptCount = isHubErr ? err.payload.attemptCount : 0;
    const tokensIn = isHubErr ? err.payload.totalInputTokens : 0;
    const tokensOut = isHubErr ? err.payload.totalOutputTokens : 0;
    const costUsd = isHubErr ? err.payload.totalCostUsd : 0;

    await prisma.condoGeneration.update({
      where: { buildingSlug },
      data: { status: "failed", attemptCount, tokensIn, tokensOut, costUsd, inputHash },
    });
    await routeCondoGeneration(buildingSlug, violations, inputHash);
    console.log(
      `[generateCondoBuilding] ${buildingSlug}: FAIL-CLOSED (retry exhausted) — ` +
        `CondoGeneration=failed, routed to review (condo:${buildingSlug}). CondoContent untouched.`,
    );
    if (!isHubErr) throw err; // unexpected error — surface after recording state
    return { buildingSlug, published: false, validatorPassed: false, attempts: attemptCount, queued: violations.length > 0, skipped: false };
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
    // Calls passed individually but combined validation failed → fail closed.
    await prisma.condoGeneration.update({
      where: { buildingSlug },
      data: { status: "failed", attemptCount, tokensIn: totalInputTokens, tokensOut: totalOutputTokens, costUsd: totalCostUsd, inputHash },
    });
    await routeCondoGeneration(buildingSlug, finalViolations, inputHash);
    console.log(
      `[generateCondoBuilding] ${buildingSlug}: FAIL-CLOSED (combined validation) — ` +
        `CondoContent upsert skipped. Prior published row (if any) preserved.`,
    );
    return { buildingSlug, published: false, validatorPassed: false, attempts: attemptCount, queued: finalViolations.length > 0, skipped: false };
  }

  // Clean — succeed CondoGeneration, clear any review row, dual-write CondoContent.
  await prisma.condoGeneration.update({
    where: { buildingSlug },
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
  await routeCondoGeneration(buildingSlug, [], inputHash); // clears prior review row

  const name = input.building.displayName;
  const description = sections.flatMap((s) => s.paragraphs).join("\n\n");
  const metaTitle = `${name} | ${config.CITY_NAME} Condo Building Guide`;
  const metaDescription = input.saleActive
    ? `${name}, ${config.CITY_NAME}: the building, its unit mix, fees, and a grounded read on how units trade.`
    : `${name}, ${config.CITY_NAME}: the building, its unit mix, fees, and current rental availability.`;

  await prisma.condoContent.upsert({
    where: { buildingSlug },
    create: {
      buildingSlug,
      buildingName: name,
      description,
      rawAiOutput: "",
      metaTitle,
      metaDescription,
      faqJson: JSON.stringify(faq),
      statsJson: JSON.stringify(input.saleAggregates),
      marketDataHash: inputHash,
      status: "published",
      needsReview: false,
      aiGenerated: true,
      publishedAt: new Date(),
      generatedAt: new Date(),
      attempts: attemptCount,
    },
    update: {
      buildingName: name,
      description,
      rawAiOutput: "",
      metaTitle,
      metaDescription,
      faqJson: JSON.stringify(faq),
      statsJson: JSON.stringify(input.saleAggregates),
      marketDataHash: inputHash,
      status: "published",
      needsReview: false,
      publishedAt: new Date(),
      generatedAt: new Date(),
      attempts: attemptCount,
    },
  });

  console.log(
    `[generateCondoBuilding] ${buildingSlug}: PUBLISHED — ${totalWords} words, ` +
      `${attemptCount} attempt(s), $${totalCostUsd.toFixed(5)}.`,
  );
  return { buildingSlug, published: true, validatorPassed: true, attempts: attemptCount, queued: false, skipped: false };
}
