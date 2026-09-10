// src/lib/hubFooter.ts
// The homepage's footer, on the hub pages.
//
// A hub used to end in FooterSection, the legacy navy footer: three neighbourhoods, two
// streets, and no relation to the link graph the homepage now carries. The hub is the second
// most linked-to page type on the site, so ending it in a thinner footer than its own parent
// wastes the crawl the hub earns.
//
// This is deliberately a SMALL query, not getHomepageData(). A hub needs the link graph, not
// the homepage's figures, its video strip or its listing cards.
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

export async function getHubFooter(): Promise<FooterData> {
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
