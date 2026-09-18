// src/lib/hubDataHash.ts
// The hub tier's tolerance rule (MC-027), the twin of calcMarketDataHash for streets: the
// figures a hub's prose can state, at the precision it states them, folded into one short hash.
// Pure, no React, no database, so the generators, the drift check and the prebuild test share it.

import { createHash } from "crypto";
import type { HubGeneratorInput } from "@/types/hub-generator";

export function calcHubDataHash(input: Pick<HubGeneratorInput, "aggregates" | "activeListingsCount">): string {
  const a = input.aggregates;
  const parts = [
    a.typicalPrice == null ? "null" : String(Math.round(a.typicalPrice / 10000)),
    String(a.salesCount ?? 0),
    a.daysOnMarket == null ? "null" : String(Math.round(a.daysOnMarket)),
    String(input.activeListingsCount ?? 0),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}
