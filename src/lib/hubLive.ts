// src/lib/hubLive.ts
// THE ONE LIVE READ per hub request.
//
// History: a hub page once derived its numbers from two unrelated places, the body recomputing
// them from DB2 through buildHubInput while the SERP description served a string frozen at
// generation time; they disagreed on 21 of 22 hubs (measured 2026-08-15). This module made the
// meta live, and the React cache() wrapper made "one source" literal: Next calls
// generateMetadata and the page body as two invocations of one request, and both read one
// memoised computation.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40). The hub PAGE and its META no longer read
// the sold aggregate at all. They read getHubPublicCached below: DB1 only, the Neighbourhood
// row, the hub's streets and which of them have a published page, and the count of IDX active
// sale listings. The DB2 aggregate (getHubInputCached) moved to src/lib/hubDrift.ts, its only
// reader, so no module a visitor's render imports can reach the VOW door.
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { buildHubMeta } from "@/lib/ai/hub/hubMeta";
import { PUBLIC_SALE_WHERE } from "@/lib/listings/vow";

/** Per-hub SERP closers. Everything else about the description is shared. */
const HUB_META_CLOSER: Record<string, string> = {
  // GSC 2026-07-18 keyword report: the Timberlea hub carried 60 impressions at ~pos 19 with zero
  // clicks. The clause keeps that rewrite's place description, without the market claim.
  timberlea: "a straight read on Milton's established central pocket",
};

/** The Neighbourhood row, memoised for the request. */
export const getNeighbourhoodCached = cache((slug: string) =>
  prisma.neighbourhood.findUnique({ where: { slug } }),
);

export interface HubPublicStreet {
  slug: string;
  /** the ResidentialStreet name; callers resolve the display name through resolveStreetName */
  name: string;
  isVip: boolean;
  isResidential: boolean;
}

export interface HubPublicInput {
  slug: string;
  /** the Neighbourhood (registry) name */
  name: string;
  profile: "urban" | "rural";
  rawStrings: string[];
  /** IDX active sale listings across the hub's raw TREB strings, today */
  activeCount: number;
  /** every ResidentialStreet in the hub that has a published StreetContent page */
  publishedStreets: HubPublicStreet[];
}

/**
 * Everything the visitor view of a hub is built from, memoised for the request so the metadata
 * and the body read one computation. DB1 only: no sold, leased, expired or terminated record is
 * read, and no column derived from one.
 */
export const getHubPublicCached = cache(async (slug: string): Promise<HubPublicInput | null> => {
  const nbhd = await getNeighbourhoodCached(slug);
  if (!nbhd) return null;
  const [streets, activeCount] = await Promise.all([
    prisma.residentialStreet.findMany({
      where: { neighbourhoodId: nbhd.id },
      select: { slug: true, name: true, isVip: true, isResidential: true },
    }),
    nbhd.rawStrings.length
      ? prisma.listing.count({ where: { ...PUBLIC_SALE_WHERE, neighbourhood: { in: nbhd.rawStrings } } })
      : Promise.resolve(0),
  ]);
  const published = new Set(
    streets.length
      ? (
          await prisma.streetContent.findMany({
            where: { status: "published", streetSlug: { in: streets.map((s) => s.slug) } },
            select: { streetSlug: true },
          })
        ).map((r) => r.streetSlug)
      : [],
  );
  return {
    slug,
    name: nbhd.name,
    profile: nbhd.profile === "rural_hub" ? "rural" : "urban",
    rawStrings: nbhd.rawStrings,
    activeCount,
    publishedStreets: streets.filter((s) => published.has(s.slug)),
  };
});

/**
 * Title + description for a published hub. Returns null when the hub is not published; the
 * caller renders "not found". Figure-free by construction (hubMeta.ts): the only counts it may
 * state are homes for sale today and published street guides.
 */
export const getHubMetaLive = cache(async (
  slug: string,
): Promise<{ title: string; description: string } | null> => {
  const content = await prisma.hubContent.findUnique({
    where: { neighbourhoodSlug: slug },
    select: { status: true, neighbourhoodName: true },
  });
  if (!content || content.status !== "published") return null;

  // Profile comes from the RECORD: a rural hub reads "Road-by-road" whatever else fails.
  const nbhd = await getNeighbourhoodCached(slug);
  const pub = await getHubPublicCached(slug).catch(() => null);
  const profile = nbhd?.profile === "rural_hub" ? "rural" : "urban";

  const { metaTitle, metaDescription } = buildHubMeta(
    content.neighbourhoodName,
    { activeCount: pub?.activeCount ?? null, streetCount: pub?.publishedStreets.length ?? null },
    profile,
    HUB_META_CLOSER[slug],
  );

  return {
    title: metaTitle,
    description: metaDescription,
  };
});

export const hubCanonical = (slug: string) => `${config.SITE_URL}/neighbourhoods/${slug}`;
