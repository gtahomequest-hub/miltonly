// src/lib/hubDrift.ts
// Has a hub's stored generation fallen behind its live aggregate? (MC-027, MA-005 defect 1)
//
// The 22 hubs were generated in June and their prose said "102 sales" under a tile that said
// 95. The street tier has had an answer for this since July: calcMarketDataHash folds the
// figures a page's prose can state into one short hash, the row keeps the hash it was written
// under, and the regenerate-on-drift cron compares. The hub tier now uses the same rule with the
// hub's figures: the typical to the nearest $10,000, the 12-month sale count, days on market to
// the day, and the active listing count. A change in any of them is drift; a change smaller
// than that is rounding the prose never states.
//
// HubGeneration.inputHash carries this hash from the first regeneration on. The 22 rows written
// before it carry a 64-character sha256 of the whole input JSON, which no current input can
// ever equal: they read as drifted, which they are, until each is regenerated.
//
// TWO CONSUMERS. The hub page drops its FAQPage JSON-LD while the hub is drifted (Google was
// being handed the June answers), and /api/sync/regenerate-hubs regenerates drifted hubs, a few
// per run, from the same getHubInputCached the page renders from.

import { prisma } from "@/lib/prisma";
import { getHubInputCached } from "@/lib/hubLive";
import { calcHubDataHash } from "@/lib/hubDataHash";

export { calcHubDataHash };

export interface HubDrift {
  drifted: boolean;
  reason: "no-generation" | "not-succeeded" | "pre-rule-hash" | "figures-moved" | "current" | "no-input";
  storedHash: string | null;
  currentHash: string | null;
}

/** Whether `slug`'s stored generation predates its current aggregate. Reads the same cached
 *  input the page renders from, so the page and the cron agree about the aggregate. */
export async function hubDrift(slug: string): Promise<HubDrift> {
  const [generation, input] = await Promise.all([
    prisma.hubGeneration.findUnique({ where: { neighbourhoodSlug: slug }, select: { inputHash: true, status: true } }),
    getHubInputCached(slug),
  ]);
  if (!input) return { drifted: true, reason: "no-input", storedHash: generation?.inputHash ?? null, currentHash: null };
  const currentHash = calcHubDataHash(input);
  if (!generation) return { drifted: true, reason: "no-generation", storedHash: null, currentHash };
  if (generation.status !== "succeeded") return { drifted: true, reason: "not-succeeded", storedHash: generation.inputHash, currentHash };
  if (generation.inputHash.length !== 16) return { drifted: true, reason: "pre-rule-hash", storedHash: generation.inputHash, currentHash };
  if (generation.inputHash !== currentHash) return { drifted: true, reason: "figures-moved", storedHash: generation.inputHash, currentHash };
  return { drifted: false, reason: "current", storedHash: generation.inputHash, currentHash };
}
