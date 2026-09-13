// src/app/market-watch/[weekOf]/page.tsx
// One archived edition, addressed by the Monday its week commences.
//
// Renders the STORED row and nothing else. No figure on this page is
// recomputed, because a recomputed figure would change as DB2 takes late
// reports and the archive would quietly rewrite itself.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import MarketWatchPage from "@/components/marketwatch/MarketWatchPage";
import type { EditionSections } from "@/lib/marketWatch/edition";
import SchemaScript from "@/components/SchemaScript";
import SiteNavLive from "@/components/nav/SiteNavLive";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

async function get(weekOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) return null;
  return prisma.marketEdition.findFirst({ where: { weekOf, status: "published" } });
}

export async function generateMetadata({
  params,
}: {
  params: { weekOf: string };
}): Promise<Metadata> {
  const e = await get(params.weekOf);
  if (!e) return genMeta({ title: "Edition not found", noIndex: true });
  return genMeta({
    title: e.metaTitle ?? `${config.CITY_NAME} Market Watch`,
    description: e.metaDescription ?? undefined,
    canonical: `${config.SITE_URL}/market-watch/${e.weekOf}`,
  });
}

export default async function EditionPage({ params }: { params: { weekOf: string } }) {
  const e = await get(params.weekOf);
  if (!e) notFound();

  const sections = e.sectionsJson as unknown as EditionSections;

  const archive = await prisma.marketEdition.findMany({
    where: { status: "published", weekOf: { not: e.weekOf } },
    orderBy: { weekOf: "desc" },
    take: 12,
    select: { weekOf: true, sectionsJson: true },
  });

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Market Watch", url: `${config.SITE_URL}/market-watch` },
      { name: sections.weekLabel, url: `${config.SITE_URL}/market-watch/${e.weekOf}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: e.metaTitle ?? `${config.CITY_NAME} Market Watch`,
      description: e.metaDescription ?? undefined,
      url: `${config.SITE_URL}/market-watch/${e.weekOf}`,
      datePublished: (e.publishedAt ?? e.createdAt).toISOString(),
      // updatedAt, not publishedAt. A corrected edition keeps its original
      // publication date and carries the rewrite in dateModified; reading
      // publishedAt here would have hidden the correction from crawlers.
      dateModified: e.updatedAt.toISOString(),
      isAccessibleForFree: true,
      publisher: { "@type": "Organization", name: config.SITE_NAME, url: config.SITE_URL },
      about: { "@type": "Place", name: `${config.CITY_NAME}, ${config.CITY_PROVINCE}` },
    },
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <SiteNavLive variant="page" />
      <MarketWatchPage
        s={sections}
        summarySentence={e.summarySentence}
        interpretation={e.interpretation}
        isCurrent={false}
        archive={archive.map((a) => ({
          weekOf: a.weekOf,
          label: (a.sectionsJson as unknown as EditionSections).weekLabel,
        }))}
      />
      <FooterSection />
    </>
  );
}
