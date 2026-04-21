// Shared error classes for the Phase 4.1 generator pipeline.
// Kept in one place so the backfill script (Step 4.1.9) can do targeted
// catch-by-class handling per failure mode and write the right shape into
// the StreetGenerationReview row.

import type { ValidatorViolation } from "@/types/street-generator";

/**
 * The street's listings and sold_records had no coordinates on file AND no
 * neighbourhood mapping to a hardcoded centroid. Thrown by buildGeneratorInput.
 * Backfill script catches this specifically and logs "no_centroid" as the
 * review reason — distinct from a generation-pipeline failure.
 */
export class NoCentroidError extends Error {
  readonly slug: string;
  readonly reason: string;
  constructor(slug: string, reason: string) {
    super(`NoCentroidError(${slug}): ${reason}`);
    this.name = "NoCentroidError";
    this.slug = slug;
    this.reason = reason;
  }
}

/** Raw model response couldn't be parsed as JSON. Raw text attached. */
export class StreetGenerationParseFailure extends Error {
  readonly rawText: string;
  constructor(message: string, rawText: string) {
    super(message);
    this.name = "StreetGenerationParseFailure";
    this.rawText = rawText;
  }
}

/** Parsed JSON didn't match the StreetGeneratorOutput structural contract. */
export class StreetGenerationShapeFailure extends Error {
  readonly fragment: unknown;
  constructor(message: string, fragment: unknown) {
    super(message);
    this.name = "StreetGenerationShapeFailure";
    this.fragment = fragment;
  }
}

/** The retry wrapper exhausted 3 attempts with validation violations each time. */
export class StreetGenerationFailure extends Error {
  readonly slug: string;
  readonly violations: ValidatorViolation[];
  constructor(slug: string, violations: ValidatorViolation[]) {
    super(`Street generation failed after 3 attempts for ${slug}. ${violations.length} violations.`);
    this.name = "StreetGenerationFailure";
    this.slug = slug;
    this.violations = violations;
  }
}
