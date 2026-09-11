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
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema } from "@/lib/schema";
import { GUIDE_DEFS } from "@/lib/guides/guides";

export const dynamic = "force-dynamic";

export const metadata: Metadata = genMeta({
  title: `${config.CITY_NAME} Real Estate Guides`,
  description: `Guides to buying, selling and living in ${config.CITY_NAME}, ${config.CITY_PROVINCE}, built on this site's own sold data. Every figure carries its window and its sample size.`,
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
      hasPart: GUIDE_DEFS.map((g) => ({
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
      <FooterSection />
    </>
  );
}
