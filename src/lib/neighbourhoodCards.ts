// src/lib/neighbourhoodCards.ts
// THE ONE NEIGHBOURHOOD CARD. /neighbourhoods, the homepage grid and the menu read this, so the
// published hubs cannot describe two different things on two surfaces.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40). The card used to carry the hub's k-gated
// 12-month typical SOLD price and the sale count behind it (getMiltonSoldByNeighbourhood, DB2).
// Both are values derived from VOW records and both are gone from the shape, together with the
// DB2 read. What is left is public: the hub's name and slug, and the count of IDX active sale
// listings across its raw TREB strings (PUBLIC_SALE_WHERE). The cards are ordered by that count,
// ties alphabetical (ruling R9: an order by sold volume discloses relative sold volume).
import { prisma } from "@/lib/prisma";
import { publishedHubSlugs } from "@/lib/hubSets";
import { PUBLIC_SALE_WHERE } from "@/lib/listings/vow";

export interface NeighbourhoodCard {
  slug: string;
  /** the Neighbourhood (registry) name */
  name: string;
  /** IDX active sale listings across the hood's raw TREB strings, today */
  activeCount: number;
}

/**
 * Raw TREB neighbourhood string -> the canonical PUBLISHED hub it belongs to.
 *
 * A listing carries a raw string like "1035 - OM Old Milton". Slugifying that string is
 * how you build a link to a page that does not exist: /neighbourhoods/page.tsx already
 * refuses to link a raw hood with no published hub, for exactly that reason. Anything
 * linking a listing to its neighbourhood goes through this map, and a raw string absent
 * from it gets no link rather than a guessed one.
 */
export async function getRawStringHubMap(): Promise<Map<string, { slug: string; name: string }>> {
  const published = (await publishedHubSlugs()).map((neighbourhoodSlug) => ({ neighbourhoodSlug }));
  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: published.map((p) => p.neighbourhoodSlug) } },
    select: { slug: true, name: true, rawStrings: true },
  });
  const map = new Map<string, { slug: string; name: string }>();
  for (const h of hoods) for (const raw of h.rawStrings) map.set(raw, { slug: h.slug, name: h.name });
  return map;
}

/**
 * Every published hub with its count of homes for sale today, most first, ties alphabetical.
 * DB1 only.
 */
export async function getNeighbourhoodCards(): Promise<NeighbourhoodCard[]> {
  const slugs = await publishedHubSlugs();
  if (slugs.length === 0) return [];
  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true, rawStrings: true },
  });
  // rawStrings is the TREB-string pool a canonical hood owns. A raw string belongs to
  // exactly one hood, so one groupBy over the union resolves every hood in one round trip.
  const rawToSlug = new Map<string, string>();
  for (const h of hoods) for (const raw of h.rawStrings) rawToSlug.set(raw, h.slug);

  const activeRows = rawToSlug.size
    ? await prisma.listing.groupBy({
        by: ["neighbourhood"],
        _count: true,
        where: { ...PUBLIC_SALE_WHERE, neighbourhood: { in: Array.from(rawToSlug.keys()) } },
      })
    : [];
  const activeBySlug = new Map<string, number>();
  for (const r of activeRows) {
    const slug = rawToSlug.get(r.neighbourhood);
    if (!slug) continue;
    activeBySlug.set(slug, (activeBySlug.get(slug) ?? 0) + r._count);
  }

  return hoods
    .map((h) => ({ slug: h.slug, name: h.name, activeCount: activeBySlug.get(h.slug) ?? 0 }))
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));
}
