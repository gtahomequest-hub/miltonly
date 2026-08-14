import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { HUB_STREET_LADDER_CAP } from "@/lib/streetSurface";
import { schools } from "@/lib/schools";
import { mosques } from "@/lib/mosques";

export const dynamic = "force-dynamic";

const SITE_URL = config.SITE_URL;


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/listings`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/sell`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/streets`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /condos is now a real forest directory (was a redirect) — index the
      // crawl path into the published /condos/<slug> detail pages below.
      url: `${SITE_URL}/condos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /freehold — first ownership-axis hub (freehold vs condo/POTL). Indexable
      // SEO page; opens the crawl path for "freehold homes Milton" intent.
      url: `${SITE_URL}/freehold`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /condos-guide — condo ownership-axis hub (decision page, distinct from the
      // /condos directory). Indexable SEO page for "condos in Milton" intent.
      url: `${SITE_URL}/condos-guide`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /potl — POTL (Parcel of Tied Land) ownership-axis hub. Number-free editorial
      // explainer for the "what is POTL / parcel of tied land Milton" intent.
      url: `${SITE_URL}/potl`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/rentals`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/exclusive`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      // /compare — now a real forest INDEX of comparison pages (was a thin navy
      // "coming soon" street-vs-street stub). Points the crawl at the live
      // comparisons below.
      url: `${SITE_URL}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      // /compare/freehold-vs-condo — the COMPARE flagship: grounded two-column
      // freehold-vs-condo decision page. Indexable for "freehold vs condo Milton".
      url: `${SITE_URL}/compare/freehold-vs-condo`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/sold`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // Neighbourhood hub pages — canonical slugs from the published HubContent set,
  // the SAME source getHubData() resolves. Previously these were derived by
  // munging Listing.neighbourhood, which emitted legacy slug forms
  // (1051---walker, brookvillehaltonville, rural-nassagaweya) that 404 on the
  // hub-v2 route; HubContent.neighbourhoodSlug IS the canonical 200 target, so
  // the sitemap now points only at slugs that render. (neighbourhoodSlug is
  // @unique — no duplicates.)
  const publishedHubs = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true, updatedAt: true },
  });

  const neighbourhoodPages: MetadataRoute.Sitemap = publishedHubs.map((h) => ({
    url: `${SITE_URL}/neighbourhoods/${h.neighbourhoodSlug}`,
    lastModified: h.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Published street pages from pipeline.
  //
  // PUBLISH FLOOR = ENTITY FLOOR. This list used to come from StreetContent alone, so
  // publication was keyed off "did the generator ever write a row" — which is not a
  // statement about whether the street exists. Five slugs with NO ResidentialStreet row
  // were in the sitemap with generated prose, among them wood-close-n-a-milton and
  // 15-side-road-side-road-milton, which are machine-made from an address artifact and
  // are not streets. The typo entity miltonbrock-crescent-milton was absent only
  // because no content row happened to be written for it: luck, not a control.
  //
  // A page may not be published for a street that does not exist. Content is still
  // required — this adds the entity as a second, independent condition.
  const [publishedStreets, streetEntities] = await Promise.all([
    prisma.streetContent.findMany({
      where: { status: "published" },
      select: { streetSlug: true, updatedAt: true },
    }),
    prisma.residentialStreet.findMany({ select: { slug: true } }),
  ]);
  const entitySlugs = new Set(streetEntities.map((s) => s.slug));

  const streetPages: MetadataRoute.Sitemap = publishedStreets
    .filter((s) => entitySlugs.has(s.streetSlug))
    .map((s) => ({
      url: `${SITE_URL}/streets/${s.streetSlug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // Per-street sold data lives on the street pages (/streets/<slug>) via the
  // VOW sold-records island — there is no /sold/<slug> route, so we do NOT emit
  // /sold/<slug> URLs here (they 404'd). The /sold index itself is a staticPage.

  // Published condo-building pages from the WS5 condo pipeline.
  const publishedCondos = await prisma.condoContent.findMany({
    where: { status: "published" },
    select: { buildingSlug: true, updatedAt: true },
  });

  const condoPages: MetadataRoute.Sitemap = publishedCondos.map((c) => ({
    url: `${SITE_URL}/condos/${c.buildingSlug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Neighbourhood street-OVERFLOW pages (/neighbourhoods/<slug>/streets) — ONLY where a published
  // hub has MORE published streets than the ladder cap. Below that floor the route redirects to the
  // hub (redundant + thin), so it must NOT be declared here. Count = published StreetContent joined
  // to a canonical ResidentialStreet row per neighbourhood — the SAME gate getHubData.hasStreetOverflow uses.
  const publishedHubSlugSet = new Set(publishedHubs.map((h) => h.neighbourhoodSlug));
  const rsForPublished = await prisma.residentialStreet.findMany({
    where: { slug: { in: publishedStreets.map((s) => s.streetSlug) }, neighbourhoodId: { not: null } },
    select: { neighbourhoodId: true },
  });
  const nbhdSlugById = new Map(
    (await prisma.neighbourhood.findMany({ select: { id: true, slug: true } })).map((n) => [n.id, n.slug]),
  );
  const publishedCountByHub = new Map<string, number>();
  for (const r of rsForPublished) {
    const hubSlug = r.neighbourhoodId ? nbhdSlugById.get(r.neighbourhoodId) : null;
    if (hubSlug && publishedHubSlugSet.has(hubSlug)) publishedCountByHub.set(hubSlug, (publishedCountByHub.get(hubSlug) ?? 0) + 1);
  }
  const streetOverflowPages: MetadataRoute.Sitemap = Array.from(publishedCountByHub.entries())
    .filter(([, count]) => count > HUB_STREET_LADDER_CAP)
    .map(([hubSlug]) => ({
      url: `${SITE_URL}/neighbourhoods/${hubSlug}/streets`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  // School pages
  const schoolPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/schools`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...schools.map((s) => ({
      url: `${SITE_URL}/schools/${s.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  // Mosque pages
  const mosquePages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/mosques`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...mosques.map((m) => ({
      url: `${SITE_URL}/mosques/${m.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return [...staticPages, ...neighbourhoodPages, ...streetPages, ...streetOverflowPages, ...condoPages, ...schoolPages, ...mosquePages];
}
