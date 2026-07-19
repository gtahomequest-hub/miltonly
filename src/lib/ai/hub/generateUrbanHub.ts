// src/lib/ai/hub/generateUrbanHub.ts
// WS5 — URBAN hub generation ENTRY (persistence + fail-closed). The urban analogue
// of generateRuralHub.ts; mirrors its terminal-status contract verbatim, reusing
// the SAME tables (HubGeneration + HubContent) and the SAME failure queue
// (StreetGenerationReview, key hub:<slug>). No new schema.
//
//   1. GATE: refuse unless URBAN_HUB_ENABLED==='true' (dormant until flipped — the
//      14-hub batch cannot run by accident). The PURE orchestrator
//      generateUrbanHubContent is NOT gated (the DRY proof uses it, writes nothing).
//   2. Build the urban input + Milton-wide context once; compute inputHash.
//   3. Atomic claim into HubGeneration (insert-or-flip-to-'generating').
//   4. Run generateUrbanHubContent with the pre-built input + milton.
//   5. Terminal writes (identical to rural):
//      - retry-exhausted (HubGenerationError) → HubGeneration.status=failed +
//        routeHubGeneration(hub:<slug>); HubContent NOT written (prior row preserved).
//      - combined-validator failure → same fail-closed.
//      - clean → HubGeneration.status=succeeded + dual-write HubContent (published).

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildHubInput, buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { routeHubGeneration } from "@/lib/ai/hub/hubFailClosed";
import { HubGenerationError } from "@/lib/ai/hub/generateHubContent";
import { buildHubMeta } from "@/lib/ai/hub/hubMeta";
import {
  generateUrbanHubContent,
  type UrbanProviderOpts,
} from "@/lib/ai/hub/generateUrbanHubContent";

export interface GenerateUrbanHubResult {
  neighbourhoodSlug: string;
  published: boolean;
  validatorPassed: boolean;
  attempts: number;
  queued: boolean;
}

export function urbanHubEnabled(): boolean {
  return (process.env.URBAN_HUB_ENABLED || "").trim() === "true";
}

export async function generateUrbanHub(
  neighbourhoodSlug: string,
  opts?: UrbanProviderOpts,
): Promise<GenerateUrbanHubResult> {
  // GATE — dormant until explicitly flipped. The pure orchestrator is ungated
  // (DRY proof path); only the persisting entry is guarded.
  if (!urbanHubEnabled()) {
    throw new Error(
      `generateUrbanHub: URBAN_HUB_ENABLED is not 'true' — urban hub generation is gated off ` +
        `(dormant). Set URBAN_HUB_ENABLED=true to enable the 14-hub batch.`,
    );
  }

  // Throws unless profile==='urban_hub' (guard lives in buildHubInput).
  const input = await buildHubInput(neighbourhoodSlug);
  const milton = await buildMiltonWideContext();
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");

  // Atomic claim — insert-or-flip-to-generating (mirror generateRuralHub.ts).
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

  let result: Awaited<ReturnType<typeof generateUrbanHubContent>>;
  try {
    result = await generateUrbanHubContent(neighbourhoodSlug, input, milton, opts);
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
      `[generateUrbanHub] ${neighbourhoodSlug}: FAIL-CLOSED (retry exhausted) — ` +
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
    // Calls passed individually but combined validation failed → fail closed.
    await prisma.hubGeneration.update({
      where: { neighbourhoodSlug },
      data: { status: "failed", attemptCount, tokensIn: totalInputTokens, tokensOut: totalOutputTokens, costUsd: totalCostUsd, inputHash },
    });
    await routeHubGeneration(neighbourhoodSlug, finalViolations, inputHash);
    console.log(
      `[generateUrbanHub] ${neighbourhoodSlug}: FAIL-CLOSED (combined validation) — ` +
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
  const { metaTitle, metaDescription } = buildHubMeta(
    input.neighbourhood.name,
    { typicalPrice: input.aggregates.typicalPrice, salesCount: input.aggregates.salesCount },
    "urban",
  );

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
    `[generateUrbanHub] ${neighbourhoodSlug}: PUBLISHED — ${totalWords} words, ` +
      `${attemptCount} attempt(s), $${totalCostUsd.toFixed(5)}.`,
  );
  return { neighbourhoodSlug, published: true, validatorPassed: true, attempts: attemptCount, queued: false };
}
