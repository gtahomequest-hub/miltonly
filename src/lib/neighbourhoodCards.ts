// src/lib/neighbourhoodCards.ts
// THE ONE NEIGHBOURHOOD CARD. Both /neighbourhoods and the homepage grid read this,
// so the 22 published hubs cannot describe two different markets on two surfaces.
//
// WHY THIS EXISTS. /neighbourhoods built its cards inline and priced them with an
// ACTIVE LIST-PRICE AVERAGE — `_avg: { price }` over `status: "active"` sale listings.
// That is a different statistic from the one the hub page itself publishes (the
// k-gated 12-month typical SOLD price), computed over a different population (what
// is asking today, not what traded), with no k-anon floor of any kind. Two figures
// under one word is the defect hub-meta.mjs was written to catch on the SERP side,
// and the card grid was quietly committing it on the browse side.
//
// SO THE PRICE HERE IS THE HUB'S OWN. getMiltonSoldByNeighbourhood() already runs
// the hub page's EXACT sale query (saleAggQuery over Neighbourhood.rawStrings) through
// the hub page's EXACT assembly (assembleAggregates, which applies K_ANON_PRICE and
// returns null below it) and rounds it the way the hub rounds it (round5k). This module
// adds the one thing it lacks — a live active-listing count — and nothing else. A card
// whose hub suppresses its price shows no price, on both surfaces, at the same time.
//
// ACTIVE COUNT is deliberately NOT k-gated: a count of listings currently advertised on
// the public MLS is public by construction. It is the sold-side aggregate that carries
// the VOW obligation, and that is the figure this module gates.
import { prisma } from "@/lib/prisma";
import { getMiltonSoldByNeighbourhood } from "@/lib/soldAggregates";

export interface NeighbourhoodCard {
  slug: string;
  name: string;
  /** live active listings across the hood's raw TREB strings, any transaction type */
  activeCount: number;
  /** the hub's published k-gated 12-month typical sold price, round5k. null = suppressed */
  typicalSoldPrice: number | null;
  /** the pool the price was computed over; drives the suppression note */
  salesCount: number;
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
  const published = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true },
  });
  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: published.map((p) => p.neighbourhoodSlug) } },
    select: { slug: true, name: true, rawStrings: true },
  });
  const map = new Map<string, { slug: string; name: string }>();
  for (const h of hoods) for (const raw of h.rawStrings) map.set(raw, { slug: h.slug, name: h.name });
  return map;
}

/**
 * Every published hub, busiest first, with its live active count and the price its own
 * page publishes. Cards whose price is suppressed still render and still link — the hub
 * page is the point, the figure is the garnish.
 */
export async function getNeighbourhoodCards(): Promise<NeighbourhoodCard[]> {
  // Sold side: published hubs only, hub-identical query + assembly + rounding + k-gate.
  const sold = await getMiltonSoldByNeighbourhood();
  if (sold.length === 0) return [];

  const slugs = sold.map((s) => s.slug);
  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, rawStrings: true },
  });
  // rawStrings is the TREB-string pool a canonical hood owns. A raw string belongs to
  // exactly one hood, so one groupBy over the union resolves every hood in one round trip.
  const rawToSlug = new Map<string, string>();
  for (const h of hoods) for (const raw of h.rawStrings) rawToSlug.set(raw, h.slug);

  const activeRows = rawToSlug.size
    ? await prisma.listing.groupBy({
        by: ["neighbourhood"],
        _count: true,
        where: {
          neighbourhood: { in: Array.from(rawToSlug.keys()) },
          status: "active",
          permAdvertise: true,
        },
      })
    : [];
  const activeBySlug = new Map<string, number>();
  for (const r of activeRows) {
    const slug = rawToSlug.get(r.neighbourhood);
    if (!slug) continue;
    activeBySlug.set(slug, (activeBySlug.get(slug) ?? 0) + r._count);
  }

  return sold.map((s) => ({
    slug: s.slug,
    name: s.name,
    activeCount: activeBySlug.get(s.slug) ?? 0,
    typicalSoldPrice: s.typicalPrice,
    salesCount: s.count,
  }));
}
