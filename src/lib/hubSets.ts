// src/lib/hubSets.ts
// The two hub sets every street render asks for, fetched once per fifteen minutes (MC-018).
//
// MC-016 measured them: `Neighbourhood slug, name, rawStrings` and `HubContent neighbourhoodSlug
// WHERE published` left DB1 2,600 times each in one fifteen-minute window, 122,000 rows, because
// a street page resolves its hub link from them, the footer does, the sold options do, and each
// caller ran its own query. They change when a hub is generated or a neighbourhood is
// reassigned, which is a handful of times a day; they are read on every render of every page.
//
// Same shape as the slug sets in streetSurface.ts: Upstash under a versioned key for HUB_TTL,
// a request-scoped memo on top, and a drop on every write path (the hub generators through
// revalidateHubSurfaces, /api/revalidate for a /neighbourhoods path). `cached()` bypasses Redis
// under a static render (MC-017), which is one render per page per day on the ISR pages.

import * as React from "react";
import { prisma } from "@/lib/prisma";
import { cached, invalidateMany } from "@/lib/cache";

const perRequest = <T>(fn: T): T => {
  const c = (React as unknown as { cache?: (f: T) => T }).cache;
  return typeof c === "function" ? c(fn) : fn;
};

export const HUB_SET_KEYS = { neighbourhoods: "hubsets:neighbourhoods:v1", published: "hubsets:published-hubs:v1" } as const;
export const HUB_SET_TTL = 900;

export interface NeighbourhoodRow {
  slug: string;
  name: string;
  rawStrings: string[];
}

/** Every Neighbourhood's slug, name and raw-string pool. */
export const neighbourhoodRows = perRequest(async (): Promise<NeighbourhoodRow[]> =>
  cached(HUB_SET_KEYS.neighbourhoods, HUB_SET_TTL, () =>
    prisma.neighbourhood.findMany({ select: { slug: true, name: true, rawStrings: true } }),
  ),
);

/** The slugs of every published hub, the link universe the sitemap emits. */
export const publishedHubSlugs = perRequest(async (): Promise<string[]> =>
  cached(HUB_SET_KEYS.published, HUB_SET_TTL, async () => {
    const rows = await prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } });
    return rows.map((r) => r.neighbourhoodSlug);
  }),
);

/** Drop both sets. Called after a HubContent write; cheap, idempotent. */
export async function dropHubSetCache(): Promise<void> {
  await invalidateMany([HUB_SET_KEYS.neighbourhoods, HUB_SET_KEYS.published]);
}
