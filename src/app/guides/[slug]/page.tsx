// src/app/guides/[slug]/page.tsx
// One guide, rendered live. An unknown slug 404s rather than rendering an
// empty shell.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import GuideArticlePage from "@/components/guides/GuideArticlePage";
import { getGuideArticleFull } from "@/lib/guides";
import { GUIDE_DEFS, GUIDES_UPDATED } from "@/lib/guides/guides";
import SchemaScript from "@/components/SchemaScript";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

// NO generateStaticParams, deliberately. Every figure on a guide is read live
// from the sold aggregates, so a prerendered guide would freeze its numbers at
// build time and quietly diverge from /sold and from the hub pages it links
// to. The first build did prerender these (● in the route table) and the
// figures would have been stale from the moment the deploy finished. The
// sitemap still lists all six from GUIDE_SLUGS, and an unknown slug 404s
// through notFound() below.

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const def = GUIDE_DEFS.find((d) => d.slug === params.slug);
  if (!def) return genMeta({ title: "Guide not found", noIndex: true });
  return genMeta({
    title: def.metaTitle,
    description: def.metaDescription,
    canonical: `${config.SITE_URL}/guides/${def.slug}`,
  });
}

export default async function GuidePage({ params }: { params: { slug: string } }) {
  const full = await getGuideArticleFull(params.slug);
  if (!full) notFound();
  const { data, def } = full;

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Guides", url: `${config.SITE_URL}/guides` },
      { name: def.title, url: `${config.SITE_URL}/guides/${def.slug}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: def.title,
      description: def.metaDescription,
      url: `${config.SITE_URL}/guides/${def.slug}`,
      // The month the templates were authored. Not a fabricated timestamp:
      // the figures inside refresh on every request, the prose does not.
      dateModified: GUIDES_UPDATED,
      isAccessibleForFree: true,
      publisher: { "@type": "Organization", name: config.SITE_NAME, url: config.SITE_URL },
      about: { "@type": "Place", name: `${config.CITY_NAME}, ${config.CITY_PROVINCE}` },
    },
    ...(data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <SiteNav variant="page" />
      <GuideArticlePage data={data} />
      <FooterSection />
    </>
  );
}
