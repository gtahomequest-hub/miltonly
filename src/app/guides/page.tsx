// src/app/guides/page.tsx
// The guides index. /guides-preview has rendered this layout on fixtures since
// the component landed; this is the same layout on the real data window.
import type { Metadata } from "next";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import GuidesIndexPage from "@/components/guides/GuidesIndexPage";
import { getGuidesIndexData } from "@/lib/guides";
import SchemaScript from "@/components/SchemaScript";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";
import { generateBreadcrumbSchema, generateLocalBusinessSchema } from "@/lib/schema";
import { GUIDE_DEFS } from "@/lib/guides/guides";

// MC-017 (2026-09-13): ISR, not a render per request; see the detail page for the tags and the
// write paths that drop it.
export const revalidate = 86400;

export const metadata: Metadata = genMeta({
  title: `${config.CITY_NAME} Real Estate Guides`,
  description: `Guides to buying, selling and living in ${config.CITY_NAME}, ${config.CITY_PROVINCE}: condo fees, first-home costs, schools, parking and the GO train, from this site's own data, the Town's rules and GO Transit's timetable.`,
  canonical: `${config.SITE_URL}/guides`,
});

export default async function GuidesPage() {
  const data = await getGuidesIndexData();

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Guides", url: `${config.SITE_URL}/guides` },
    ]),
    generateLocalBusinessSchema(),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${config.CITY_NAME} Real Estate Guides`,
      url: `${config.SITE_URL}/guides`,
      // A noindex guide (MC-046 Stage 1) is not named as a part of the indexed collection.
      hasPart: GUIDE_DEFS.filter((g) => !g.noindex).map((g) => ({
        "@type": "Article",
        headline: g.title,
        url: `${config.SITE_URL}/guides/${g.slug}`,
      })),
    },
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <SiteNavLive variant="page" />
      <GuidesIndexPage data={data} />
      <SiteFooter />
    </>
  );
}
