// src/lib/hubResolve.ts
// Resolve a neighbourhood name / raw TREB string to its PUBLISHED hub slug, or null.
//
// This is the same registry resolution the street pages use (buildContextCards in
// street-data.ts): map every Neighbourhood variant — canonical slug, display name, and
// each rawStrings[] entry — to the canonical slug, then require a PUBLISHED HubContent row.
// A name that resolves to an entity WITHOUT a published hub returns null, exactly like a
// name that resolves to nothing. Callers use null to DROP a link rather than emit a
// /neighbourhoods/<slug> URL that 404s.
//
// Why this exists as a shared helper: the listing-detail breadcrumb schema (and any other
// surface that links a neighbourhood) was slugging the name inline
// (`name.toLowerCase().replace(/\s+/g,'-')`), which invents URLs the registry never blessed
// — "Rural Nassagaweya" -> /neighbourhoods/rural-nassagaweya (the hub is `nassagaweya`),
// unpublished hubs -> 404. Those were a measured chunk of the GSC "Not found (404)" bucket.

import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// One cached load of the whole registry + published-hub set (changes rarely). Returns a
// plain map/array so it survives the unstable_cache serialization boundary.
const getHubIndex = unstable_cache(
  async (): Promise<{ entries: [string, string][]; published: string[] }> => {
    const [nbs, hubs] = await Promise.all([
      prisma.neighbourhood.findMany({ select: { slug: true, name: true, rawStrings: true } }),
      prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } }),
    ]);
    const map = new Map<string, string>();
    for (const nb of nbs) {
      for (const variant of [nb.slug, nb.name, ...nb.rawStrings]) {
        const k = normKey(variant);
        if (k) map.set(k, nb.slug);
      }
    }
    return { entries: Array.from(map.entries()), published: hubs.map((h) => h.neighbourhoodSlug) };
  },
  ["hub-resolver-index"],
  { revalidate: 3600 },
);

/** Canonical published hub slug for a neighbourhood name / raw TREB string, or null when it
 *  doesn't resolve to a registry entity OR that entity has no published hub page. */
export async function resolvePublishedHubSlug(nameOrRaw: string | null | undefined): Promise<string | null> {
  const s = (nameOrRaw ?? "").trim();
  if (!s) return null;
  const { entries, published } = await getHubIndex();
  const slug = new Map(entries).get(normKey(s));
  return slug && published.includes(slug) ? slug : null;
}
