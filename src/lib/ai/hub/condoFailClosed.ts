// src/lib/ai/hub/condoFailClosed.ts
// WS4 patch 2 (DEC-WS4-5, ADR 0002) — fail-closed routing for condo-building
// generation. Mirrors src/lib/ai/hub/hubFailClosed.ts verbatim in shape: a
// building whose validator produces hard violations does NOT publish — the
// failure is recorded in the EXISTING StreetGenerationReview queue (no schema
// change) under a reserved `condo:<slug>` key, and no condo content row is
// written. StreetContent (street tier) is never touched.
//
// Condo CONTENT generation + the publish path are WS5; this is the fail-closed
// GATE WS5 calls after validateCondoSectionsSubset, and is exercised directly by
// scripts/test-condo-txn-split.ts (gate e).

import { prisma } from "@/lib/prisma";
import type { ValidatorViolation } from "@/types/street-generator";

// Reserved `condo:` prefix — never collides with a real street slug or the
// hub `hub:` prefix, while reusing StreetGenerationReview unchanged.
export function condoReviewKey(buildingSlug: string): string {
  return `condo:${buildingSlug}`;
}

export interface CondoRouteResult {
  buildingSlug: string;
  published: boolean;
  queued: boolean;
  violationCount: number;
}

/**
 * Route a condo generation result. Any hard violation → fail closed: write the
 * StreetGenerationReview row and DO NOT publish. Clean → published=true and any
 * prior review row is cleared. Never writes StreetContent.
 */
export async function routeCondoGeneration(
  buildingSlug: string,
  violations: ValidatorViolation[],
  inputHash: string,
): Promise<CondoRouteResult> {
  const key = condoReviewKey(buildingSlug);
  const hardViolations = violations.filter((v) => v.severity === "hard");

  if (hardViolations.length > 0) {
    await prisma.streetGenerationReview.upsert({
      where: { streetSlug: key },
      update: {
        violations: hardViolations as unknown as object,
        lastAttemptAt: new Date(),
        lastInputHash: inputHash,
      },
      create: {
        streetSlug: key,
        violations: hardViolations as unknown as object,
        lastAttemptAt: new Date(),
        lastInputHash: inputHash,
      },
    });
    console.log(
      `[routeCondoGeneration] ${buildingSlug}: FAIL-CLOSED — ${hardViolations.length} hard ` +
        `violation(s) queued in StreetGenerationReview (key=${key}). Condo not published. ` +
        `StreetContent untouched.`,
    );
    return { buildingSlug, published: false, queued: true, violationCount: hardViolations.length };
  }

  await prisma.streetGenerationReview.delete({ where: { streetSlug: key } }).catch(() => undefined);
  return { buildingSlug, published: true, queued: false, violationCount: 0 };
}
