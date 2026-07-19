// Street-tier metaTitle/metaDescription composition (batch-001 triage fix,
// 2026-07-19). Single source of truth shared by generateStreet.ts and
// scripts/backfill-street-meta.ts so the DB field can be rewritten
// deterministically without an LLM pass.
//
// Rules (locked with the triage remediation):
//   - Figures come from the SAME live For-Sale aggregates the generated body
//     uses (sold.sold_records, 12mo window, k-anon gated) — never from
//     active-listing stats, which zero-default and contradict the body.
//   - A missing stat's clause is OMITTED entirely. Zero is never rendered as
//     a statistic.
//   - No superlatives. Factual, per-street phrasing only.

import { config } from "@/lib/config";
import { roundPriceForProse } from "@/lib/format";
import { formatCADShort } from "@/lib/charts/theme";

export interface StreetMetaStats {
  /** For-Sale trades in the trailing 12 months (live sold.sold_records count). */
  salesCount: number;
  /** Typical (avg) sold price — null when k-anon suppressed (salesCount < 5). */
  typicalPrice: number | null;
  /** Average days on market across the same sale pool — null when unknown. */
  daysOnMarket: number | null;
}

export function buildStreetMetaTitle(streetName: string): string {
  return `${streetName} ${config.CITY_NAME} Real Estate | Homes, Prices & Market Data`;
}

export function buildStreetMetaDescription(
  streetName: string,
  stats: StreetMetaStats
): string {
  const parts: string[] = [];

  if (stats.salesCount > 0) {
    parts.push(
      `${stats.salesCount} home${stats.salesCount === 1 ? "" : "s"} sold on ${streetName} in the past year.`
    );
  }
  if (stats.typicalPrice !== null && stats.typicalPrice > 0) {
    parts.push(
      `Homes typically trade around ${formatCADShort(roundPriceForProse(stats.typicalPrice))}.`
    );
  }
  if (stats.daysOnMarket !== null && stats.daysOnMarket > 0) {
    parts.push(`Typical time to sell: about ${stats.daysOnMarket} days.`);
  }

  parts.push(
    `${streetName} street guide: homes, prices, and sales history in ${config.CITY_NAME}.`
  );

  return parts.join(" ");
}
