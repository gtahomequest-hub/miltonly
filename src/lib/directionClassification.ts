// Phase 4.1 Step 13m-3 — directional split classification.
//
// Given a street identity's per-direction stats, decide whether the page
// should render as a single narrative OR as h2-subsection-per-direction.
// Driven from the generator prompt AND from page render checks.
//
// Registry-validated directional streets (Main, Derry, Court, Ontario,
// Campbell, Kennedy Circle, Steeles, Thompson, James Snow Parkway, Lower
// Base Line, Parkway Drive, Burnhamthorpe Road) are the only candidates.
// Within that set, we still require real data on 2+ directions AND
// meaningful stat separation — otherwise the pages collapse to a single
// narrative (one direction dominates; the others are too thin to profile).
//
// Thresholds (from the Step 13m-2 feasibility analysis):
//   - Each direction ≥ 5 sales (k-anon floor)
//   - Median price spread > 25% (max/min)
//   - OR housing-mix shift > 30 percentage points on any category
//   - OR price bands don't overlap
//
// Everything else → 'single'. Caller uses the return value to choose
// between the standard h3-structured body and the dual h2-subsection body.

import type { DirectionalStats } from "@/types/street-generator";

const MIN_SALES_PER_DIRECTION = 5;
const MEDIAN_SPREAD_THRESHOLD = 0.25;

export type DirectionClassification = "single" | "h2-subsections";

export function classifyDirectionalSplit(
  directionalStats: DirectionalStats[] | undefined,
): DirectionClassification {
  if (!directionalStats || directionalStats.length < 2) return "single";

  const withData = directionalStats.filter((d) => d.salesCount >= MIN_SALES_PER_DIRECTION);
  if (withData.length < 2) return "single";

  // Median-price spread check — only meaningful when ≥2 directions have a
  // publishable typicalPrice (k-anon gate on the generator input).
  const typicals = withData
    .map((d) => d.typicalPrice)
    .filter((n): n is number => n != null);
  if (typicals.length >= 2) {
    const max = Math.max(...typicals);
    const min = Math.min(...typicals);
    if (min > 0 && (max - min) / min > MEDIAN_SPREAD_THRESHOLD) return "h2-subsections";
  }

  // Housing-mix shift check — compare dominantType counts as a proxy.
  // A direction with `dominantType === "detached"` vs one with `"townhouse"`
  // is the classic mix-shift signal.
  const dominantTypes = new Set(
    withData
      .map((d) => d.dominantType)
      .filter((t): t is string => !!t),
  );
  if (dominantTypes.size >= 2) return "h2-subsections";

  // Price-band overlap check. If any two directions have non-overlapping
  // [low, high] ranges, that alone warrants dual subsections.
  const bands = withData
    .map((d) => d.priceRange)
    .filter((r): r is { low: number; high: number } => r != null);
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const overlap = bands[i].low <= bands[j].high && bands[j].low <= bands[i].high;
      if (!overlap) return "h2-subsections";
    }
  }

  return "single";
}
