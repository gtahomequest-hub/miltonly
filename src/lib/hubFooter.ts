// src/lib/hubFooter.ts
// The site footer's data, on every page that is not the homepage.
//
// A hub used to end in FooterSection, the legacy navy footer: three neighbourhoods, two
// streets, and no relation to the link graph the homepage now carries. The hub is the second
// most linked-to page type on the site, so ending it in a thinner footer than its own parent
// wasted the crawl the hub earns. MH-006 took the same footer to every page (SiteFooter), so
// this read now runs on every render of every non-homepage route.
//
// This is deliberately a SMALL query, not getHomepageData(). A page needs the link graph, not
// the homepage's figures, its video strip or its listing cards. And it is MEMOISED for five
// minutes per instance, the same TTL and the same shape as getMegaLive(), for the same reason:
// a page render must not pay for the footer's queries when the footer has not changed. A
// rejected promise is dropped rather than cached, so one database blip cannot empty every
// footer on the site for the length of the TTL.
import { prisma } from "@/lib/prisma";
import { publishedStreetPageCount, publishedStreetPageSlugs } from "@/lib/streetSurface";
import { publishedHubSlugs } from "@/lib/hubSets";
import { resolveStreetName } from "@/lib/streetName";
import { GUIDE_DEFS } from "@/lib/guides/guides";
import { schools } from "@/lib/schools";
import { mosques } from "@/lib/mosques";
import { PUBLIC_SALE_WHERE } from "@/lib/listings/vow";
import type { FooterData, FooterMap, TrustInfo } from "@/components/home/types";

/** Same user-confirmed business facts getHomepageData() carries. */
export const HUB_BRAND: TrustInfo = {
  rating: 5.0,
  reviewCount: 235,
  credentials: ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"],
  idx: "1809031",
  vow: "1848370",
};

/** THE MAP (MA-004 change 9). The eight guides and the school and mosque counts are the
 *  registries' own. The homepage's footer and every other page's share this read, so the two
 *  footers cannot list different guides. MC-046 R6: Market Watch left the menu and the footer
 *  (it is sold statistics, noindex until it returns gated), so the map no longer reads an edition. */
export async function getFooterMap(): Promise<FooterMap> {
  return {
    guides: GUIDE_DEFS.filter((g) => !g.noindex).map((g) => ({ slug: g.slug, title: g.title })), // MC-046: indexed guides only
    schoolCount: schools.length,
    mosqueCount: mosques.length,
  };
}

/** THE FOOTER'S STREET COLUMN (MC-046 R9). It was the VIP streets ranked by recency-weighted
 *  sales, under "Busiest streets, recent sales": a rank by sold volume, which item 40 keeps
 *  from a signed-out reader whether or not a figure is printed. It is now the published street
 *  pages with the most homes for sale today, public IDX rows only, ties alphabetical, and a
 *  street with none for sale is not listed. The homepage's footer reads the same function. */
export async function getMostForSaleStreets(limit = 8): Promise<{ name: string; slug: string }[]> {
  const published = await publishedStreetPageSlugs();
  const rows = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: { _all: true },
    where: { ...PUBLIC_SALE_WHERE, streetSlug: { in: published } },
  });
  const counts = new Map(rows.map((r) => [r.streetSlug, r._count._all]));
  const streets = await prisma.residentialStreet.findMany({
    where: { slug: { in: Array.from(counts.keys()) } },
    select: { slug: true, name: true },
  });
  return streets
    .map((s) => ({ slug: s.slug, name: resolveStreetName(s.slug, s.name).name, n: counts.get(s.slug) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, slug }) => ({ name, slug }));
}

async function computeHubFooter(): Promise<FooterData> {
  const [publishedHubs, topStreets, streetPageCount, totalNbhd, map] = await Promise.all([
    publishedHubSlugs().then((slugs) => slugs.map((neighbourhoodSlug) => ({ neighbourhoodSlug }))),
    getMostForSaleStreets(8),
    publishedStreetPageCount(),
    prisma.neighbourhood.count(),
    getFooterMap(),
  ]);

  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: publishedHubs.map((h) => h.neighbourhoodSlug) } },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  return {
    ...map,
    neighbourhoods: hoods.map((n) => ({ name: n.name, slug: n.slug })),
    topStreets,
    neighbourhoodCount: totalNbhd,
    streetPageCount,
    streetCount: streetPageCount,
  };
}

const FOOTER_TTL_MS = 5 * 60 * 1000;
let _cache: Promise<FooterData> | null = null;
let _cachedAt = 0;

export function resetHubFooterCache(): void {
  _cache = null;
  _cachedAt = 0;
}

export function getHubFooter(): Promise<FooterData> {
  if (_cache && Date.now() - _cachedAt < FOOTER_TTL_MS) return _cache;
  const p = computeHubFooter();
  _cache = p;
  _cachedAt = Date.now();
  p.catch(() => {
    if (_cache === p) resetHubFooterCache();
  });
  return p;
}
