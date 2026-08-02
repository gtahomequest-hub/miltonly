// src/lib/neighbourhoodStreets.ts
// Data for /neighbourhoods/[slug]/streets — the per-neighbourhood street INDEX (the
// overflow the hub ladder caps at 12). PUBLISHED-ONLY: lists exactly the streets whose
// StreetContent.status="published" AND that have a canonical ResidentialStreet row in the
// neighbourhood. This deliberately EXCLUDES:
//   - surfaced-but-unpublished streets (recencyWeightedSold>0 with no published content) —
//     linking those ~300 thin pages would worsen crawl-budget dilution (the whole point).
//   - the duplicate/stale-slug published pages (wood-close-n-a, clitherow-drive, …) — they
//     carry NO ResidentialStreet row, so a query keyed on ResidentialStreet can't surface them.
// Per-street figure = soldCount12mo (the SAME stored column the hub street-cards already
// render), not a parallel price query. Neighbourhood-level stats reuse getHubData (the hub's
// own helper) — no parallel aggregate.
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getHubData } from "@/lib/hubData";
import { expandStreetName } from "@/lib/street-data";

export interface NbStreetRow {
  slug: string;
  name: string;
  soldCount: number;
  isVip: boolean;
}
export interface NeighbourhoodStreetIndex {
  slug: string;
  name: string;
  profile: "urban" | "rural";
  typicalPrice: number | null; // hub's k-gated typical (null when suppressed)
  sold12mo: number | null;
  dom: number | null;
  publishedCount: number;
  streets: NbStreetRow[]; // sorted most-traded first, then A–Z (deterministic)
}

const round5k = (n: number) => Math.round(n / 5000) * 5000;

export const getNeighbourhoodStreetIndex = cache(async (slug: string): Promise<NeighbourhoodStreetIndex | null> => {
  // getHubData returns null unless this is a PUBLISHED hub — reuse it as the gate + stats source.
  const hub = await getHubData(slug);
  if (!hub) return null;
  const nbhd = await prisma.neighbourhood.findUnique({ where: { slug }, select: { id: true } });
  if (!nbhd) return null;

  const pubSlugs = (
    await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })
  ).map((s) => s.streetSlug);

  const rows = await prisma.residentialStreet.findMany({
    where: { neighbourhoodId: nbhd.id, slug: { in: pubSlugs } },
    select: { slug: true, name: true, soldCount12mo: true, isVip: true },
    orderBy: [{ soldCount12mo: "desc" }, { name: "asc" }],
  });

  const streets: NbStreetRow[] = rows.map((r) => ({
    slug: r.slug,
    name: expandStreetName(r.name),
    soldCount: r.soldCount12mo,
    isVip: r.isVip,
  }));

  return {
    slug,
    name: hub.name,
    profile: hub.profile,
    typicalPrice: hub.stats.typicalPrice != null ? round5k(hub.stats.typicalPrice) : null,
    sold12mo: hub.stats.sold12mo,
    dom: hub.stats.dom,
    publishedCount: streets.length,
    streets,
  };
});
