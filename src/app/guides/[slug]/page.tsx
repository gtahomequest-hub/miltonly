// src/app/guides/[slug]/page.tsx
// One guide, rendered live. An unknown slug 404s rather than rendering an
// empty shell.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import "@/components/guides/guides-theme.css";
import {
  GuideHero,
  GuideTakeaways,
  GuideBody,
  GuideFaqs,
  GuideRelated,
  GuidesDualCta,
} from "@/components/guides/sections";
import SoldHistoryLine from "@/components/vow/SoldHistoryLine";
import { getGuideArticleFull } from "@/lib/guides";
import { GUIDE_DEFS, GUIDES_UPDATED } from "@/lib/guides/guides";
import SchemaScript from "@/components/SchemaScript";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";
import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/schema";

// generateStaticParams returns NOTHING, deliberately. A guide's figures are read
// live (active listings, condo fees as stated), so a build-time prerender would
// freeze them. Since MC-046 Stage 1 no guide reads a sold aggregate. The
// first build did prerender these (● in the route table). The sitemap still lists
// every slug from GUIDE_SLUGS, and an unknown slug 404s through notFound() below.
//
// MC-017 (2026-09-13): ISR, not a render per request. The function must exist,
// empty: without it Next 14 renders a dynamic route on every request and never
// fills the route cache. A guide renders on its first visit and serves until its
// Neon reads' hour or a purge: its DB2 reads carry the db2 tag and its DB3 reads
// the db3 tag (src/lib/db.ts), dropped by the sold sync and the analytics jobs
// the moment the rows change, so the figures move with /sold.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const def = GUIDE_DEFS.find((d) => d.slug === params.slug);
  if (!def) return genMeta({ title: "Guide not found", noIndex: true });
  const meta = genMeta({
    title: def.metaTitle,
    description: def.metaDescription,
    canonical: `${config.SITE_URL}/guides/${def.slug}`,
  });
  // MC-046 Stage 1 (R6): a guide that lost a whole H2 section with its sold figures is
  // `noindex, follow` (and out of the sitemap) until Stage 2.
  return def.noindex ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function GuidePage({ params }: { params: { slug: string } }) {
  const full = await getGuideArticleFull(params.slug);
  if (!full) notFound();
  const { data, def } = full;

  // A source-grounded guide names its sources in the Article node too. Unique URLs, in the
  // order they first appear on the page; a guide with no cited sentence emits no citation key.
  const citations = Array.from(
    new Set(
      data.sections.flatMap((s) => [...(s.cited ?? []).map((c) => c.source.url), ...(s.table?.source ? [s.table.source.url] : [])]),
    ),
  );

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
      ...(citations.length ? { citation: citations } : {}),
    },
    ...(data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <SiteNavLive variant="page" />
      {/* GuideArticlePage's order, composed here so a guide whose sold block left carries the
          neutral line under its hero, and a guide with no section left renders no empty body. */}
      <div className="guides-v2">
        <GuideHero data={data} />
        {def.soldHistoryLine && (
          <div className="g-wrap g-narrow" style={{ paddingBlock: "20px 4px" }}>
            <SoldHistoryLine subject="Milton" soldViewHref="/sold" />
          </div>
        )}
        <GuideTakeaways data={data} />
        {data.sections.length > 0 && <GuideBody data={data} />}
        <GuideFaqs data={data} />
        <GuideRelated data={data} />
        <GuidesDualCta eyebrow="Ready when you are" buyer={data.ctaBuyer} seller={data.ctaSeller} />
      </div>
      <SiteFooter />
    </>
  );
}
