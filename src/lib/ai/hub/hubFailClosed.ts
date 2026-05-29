// src/lib/ai/hub/hubFailClosed.ts
// WS4 (DEC-WS4, ADR 0002) — fail-closed routing for hub-tier generation.
//
// Mirrors the street-tier retry-then-fail-closed orchestration in
// src/lib/generateStreet.ts (DEC-GROUNDING-GATE). WS4 reuses the SAME failure
// queue with no schema change (the "DO NOT TOUCH the two-table failure queue"
// constraint): a hub whose validator produces hard violations does NOT publish
// — the failure is recorded in StreetGenerationReview (the queue payload) under
// a `hub:<slug>` key, and no hub content row is written. StreetContent
// (street tier) is never touched by a hub failure.
//
// Hub CONTENT generation + the actual publish path are WS5; this module is the
// fail-closed GATE that WS5 will call after validateHubSectionsSubset. It is
// also exercised directly by scripts/test-hub-fail-closed.ts (gate d).

import { prisma } from "@/lib/prisma";
import type { ValidatorViolation } from "@/types/street-generator";

// The review queue is keyed by streetSlug @id. Hub failures use a reserved
// `hub:` prefix so they never collide with a real street slug, while reusing
// the existing StreetGenerationReview table unchanged.
export function hubReviewKey(neighbourhoodSlug: string): string {
  return `hub:${neighbourhoodSlug}`;
}

export interface HubRouteResult {
  neighbourhoodSlug: string;
  published: boolean;
  queued: boolean;
  violationCount: number;
}

/**
 * Route a hub generation result. If the validator produced any hard violation,
 * fail closed: write the StreetGenerationReview queue row and DO NOT publish.
 * On a clean result, the caller (WS5) proceeds to publish; this gate returns
 * published=true and clears any prior review row.
 *
 * Never writes StreetContent — hub content lives in a WS5 surface; a hub
 * failure must leave the street tier exactly as it found it.
 */
export async function routeHubGeneration(
  neighbourhoodSlug: string,
  violations: ValidatorViolation[],
  inputHash: string,
): Promise<HubRouteResult> {
  const key = hubReviewKey(neighbourhoodSlug);
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
      `[routeHubGeneration] ${neighbourhoodSlug}: FAIL-CLOSED — ${hardViolations.length} hard ` +
        `violation(s) queued in StreetGenerationReview (key=${key}). Hub not published. ` +
        `StreetContent untouched.`,
    );
    return {
      neighbourhoodSlug,
      published: false,
      queued: true,
      violationCount: hardViolations.length,
    };
  }

  // Clean — clear any stale review row; WS5 proceeds to publish.
  await prisma.streetGenerationReview.delete({ where: { streetSlug: key } }).catch(() => undefined);
  return { neighbourhoodSlug, published: true, queued: false, violationCount: 0 };
}
