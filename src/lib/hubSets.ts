// src/lib/hubSets.ts
// The two hub sets every street render asks for, fetched once per deployment per hour (MC-018).
//
// MC-016 measured them: `Neighbourhood slug, name, rawStrings` and `HubContent neighbourhoodSlug
// WHERE published` left DB1 2,600 times each in one fifteen-minute window, 122,000 rows, because
// a street page resolves its hub link from them, the footer does, the sold options do, and each
// caller ran its own query. They change when a hub is generated or a neighbourhood is
// reassigned, which is a handful of times a day; they are read on every render of every page.
//
// Same shape as the slug sets in streetSurface.ts, and for the same reason the Data Cache and
// not Upstash (see there): `unstable_cache` under a versioned key and HUB_SET_TAG for
// HUB_SET_TTL, a request-scoped memo on top, and a tag drop on every write path (the hub
// generators through revalidateHubSurfaces, /api/revalidate for a /neighbourhoods path).

import * as React from "react";
import { revalidateTag } from "next/cache";
import { dataCached } from "@/lib/dataCache";
import { prisma } from "@/lib/prisma";

const perRequest = <T>(fn: T): T => {
  const c = (React as unknown as { cache?: (f: T) => T }).cache;
  return typeof c === "function" ? c(fn) : fn;
};

export const HUB_SET_KEYS = { neighbourhoods: "hubsets:neighbourhoods:v1", published: "hubsets:published-hubs:v1" } as const;
export const HUB_SET_TAG = "hubsets";
export const HUB_SET_TTL = 3600;

export interface NeighbourhoodRow {
  slug: string;
  name: string;
  rawStrings: string[];
}

/** Every Neighbourhood's slug, name and raw-string pool. */
export const neighbourhoodRows = perRequest(
  dataCached(
    async (): Promise<NeighbourhoodRow[]> => prisma.neighbourhood.findMany({ select: { slug: true, name: true, rawStrings: true } }),
    [HUB_SET_KEYS.neighbourhoods],
    { revalidate: HUB_SET_TTL, tags: [HUB_SET_TAG] },
  ),
);

/** The slugs of every published hub, the link universe the sitemap emits. */
export const publishedHubSlugs = perRequest(
  dataCached(
    async (): Promise<string[]> => {
      const rows = await prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } });
      return rows.map((r) => r.neighbourhoodSlug);
    },
    [HUB_SET_KEYS.published],
    { revalidate: HUB_SET_TTL, tags: [HUB_SET_TAG] },
  ),
);

/** Drop both sets. Called after a HubContent write; cheap, idempotent. */
export async function dropHubSetCache(): Promise<void> {
  try {
    revalidateTag(HUB_SET_TAG);
  } catch (e) {
    console.log(`[hubSets] tag drop skipped (no request scope): ${String((e as Error).message).slice(0, 90)}`);
  }
}
