import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { schools } from "@/lib/schools";
import { mosques } from "@/lib/mosques";

export const dynamic = "force-dynamic";

const SITE_URL = "https://miltonly.com";


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
  ];

  // Neighbourhood pages (dynamic from database)
  const hoodGroups = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    _count: true,
    where: { city: "Milton", permAdvertise: true },
  });

  const neighbourhoodPages: MetadataRoute.Sitemap = hoodGroups
    .filter((h) => h._count >= 5)
    .map((h) => {
      const name = h.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
      const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
      return {
        url: `${SITE_URL}/neighbourhoods/${slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });

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

  return [...staticPages, ...neighbourhoodPages, ...streetPages, ...schoolPages, ...mosquePages];
}
