import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
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
      url: `${SITE_URL}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
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

  // Published street pages from pipeline
  const publishedStreets = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true, updatedAt: true },
  });

  const streetPages: MetadataRoute.Sitemap = publishedStreets.map((s) => ({
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

  return [...staticPages, ...neighbourhoodPages, ...streetPages, ...condoPages, ...schoolPages, ...mosquePages];
}
