// src/app/market-watch/page.tsx
// The current edition. Canonical for the town-wide market query; the dated
// archive pages carry their own canonicals.
//
// This reads the STORED edition and never rebuilds one at request time. A page
// that recomputed would drift from the archived copy of the same week, and the
// whole point of the table is that /market-watch/<date> renders the same
// numbers in a year that it rendered on its Monday.
import type { Metadata } from "next";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import MarketWatchPage from "@/components/marketwatch/MarketWatchPage";
import type { EditionSections } from "@/lib/marketWatch/edition";
import SchemaScript from "@/components/SchemaScript";
import SiteNavLive from "@/components/nav/SiteNavLive";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

async function latest() {
  return prisma.marketEdition.findFirst({
    where: { status: "published" },
    orderBy: { weekOf: "desc" },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const e = await latest();
  return genMeta({
    title: e?.metaTitle ?? `${config.CITY_NAME} Market Watch`,
    description:
      e?.metaDescription ??
      `Weekly ${config.CITY_NAME} real estate figures: sales, new listings and activity by neighbourhood, with the sample size behind every number.`,
    canonical: `${config.SITE_URL}/market-watch`,
  });
}

export default async function MarketWatchIndex() {
  const e = await latest();

  if (!e) {
    return (
      <>
        <SiteNavLive variant="page" />
        <div className="market-watch">
          <header className="mw-mast">
            <div className="mw-wrap">
              <div className="mw-kicker">Market Watch</div>
              <h1>No edition has been published yet</h1>
              <p className="mw-lede">
                The first weekly edition covers the most recent complete Monday to Sunday week. Nothing is
                shown here until one exists, because an empty page with a date on it reads as a week with no
                sales.
              </p>
            </div>
          </header>
        </div>
        <FooterSection />
      </>
    );
  }

  const archive = await prisma.marketEdition.findMany({
    where: { status: "published", weekOf: { not: e.weekOf } },
    orderBy: { weekOf: "desc" },
    take: 12,
    select: { weekOf: true, sectionsJson: true },
  });

  const sections = e.sectionsJson as unknown as EditionSections;

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Market Watch", url: `${config.SITE_URL}/market-watch` },
    ]),
    generateLocalBusinessSchema(),
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
        isCurrent
        archive={archive.map((a) => ({
          weekOf: a.weekOf,
          label: (a.sectionsJson as unknown as EditionSections).weekLabel,
        }))}
      />
      <FooterSection />
    </>
  );
}
