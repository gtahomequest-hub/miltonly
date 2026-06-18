// src/app/freehold/page.tsx
// LIVE /freehold — the first ownership-axis hub. Flat route, mirrors /condos.
// Renders the SHARED TenureHubPage (reuses .hub-v2) fed by getTenureHubData
// (FREEHOLD_CONFIG): static editorial + LIVE grounded stats (active LIST from
// DB1, sold from the VOW analytics DB, k-anon gated). condo + POTL plug in later
// as configs against the same seam + template.
import { config } from "@/lib/config";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getTenureHubData, FREEHOLD_CONFIG } from "@/lib/tenureHubData";
import { COMPARE_TEASER, getCompareContrast, FREEHOLD_VS_CONDO_CONFIG } from "@/lib/comparisonData";
import TenureHubPage from "@/components/tenure/TenureHubPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema, generateFAQSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Use the shared SEO helper (like /condos) so openGraph + twitter tags are
// freehold-specific instead of falling back to the homepage defaults. The
// helper sets og:url + og:title + og:description + canonical from these values.
export const metadata = genMeta({
  title: `Freehold Homes in ${config.CITY_NAME} — Detached, Semi & Freehold Townhomes`,
  description: `Freehold homes for sale in ${config.CITY_NAME}, ${config.CITY_PROVINCE}: own the home and the land with no condo fee. Live prices for detached, semi, and freehold townhomes, plus how freehold compares to condo and POTL ownership.`,
  canonical: `${config.SITE_URL}/freehold`,
});

export default async function FreeholdPage() {
  const data = await getTenureHubData(FREEHOLD_CONFIG);
  // Live freehold-vs-condo median contrast for the teaser (sourced from the same
  // k-anon compareFacts as the flagship); freehold leads the line. null if sub-k.
  const compareContrast = await getCompareContrast(FREEHOLD_VS_CONDO_CONFIG, "A");

  // Defensive: the seam returns a valid HubData even with no stats (editorial-
  // only). If the DB is wholly unreachable it still returns a shell; render it.
  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Buy", url: `${config.SITE_URL}/listings` },
      { name: `Freehold Homes in ${config.CITY_NAME}`, url: `${config.SITE_URL}/freehold` },
    ]),
    generateLocalBusinessSchema(),
    ...(data && data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      {data && (
        <TenureHubPage
          data={data}
          eyebrow={FREEHOLD_CONFIG.eyebrow}
          compareLink={{ ...COMPARE_TEASER.freehold, contrast: compareContrast }}
        />
      )}
      <FooterSection />
    </>
  );
}
