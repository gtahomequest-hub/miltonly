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
import { surfacedStreetWhere, publishedStreetPageCount } from "@/lib/streetSurface";
import { resolveStreetName } from "@/lib/streetName";
import type { FooterData, TrustInfo } from "@/components/home/types";

/** Same user-confirmed business facts getHomepageData() carries. */
export const HUB_BRAND: TrustInfo = {
  rating: 5.0,
  reviewCount: 235,
  credentials: ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"],
  idx: "1809031",
  vow: "1848370",
};

async function computeHubFooter(): Promise<FooterData> {
  const [publishedHubs, vipRows, streetPageCount, totalNbhd] = await Promise.all([
    prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } }),
    prisma.residentialStreet.findMany({
      where: { isVip: true, ...(await surfacedStreetWhere()) },
      orderBy: [{ recencyWeightedSold: "desc" }],
      take: 8,
      select: { name: true, slug: true },
    }),
    publishedStreetPageCount(),
    prisma.neighbourhood.count(),
  ]);

  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: publishedHubs.map((h) => h.neighbourhoodSlug) } },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  return {
    neighbourhoods: hoods.map((n) => ({ name: n.name, slug: n.slug })),
    topStreets: vipRows.map((s) => ({ name: resolveStreetName(s.slug, s.name).name, slug: s.slug })),
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
