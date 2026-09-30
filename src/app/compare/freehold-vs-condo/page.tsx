// src/app/compare/freehold-vs-condo/page.tsx
// THE COMPARE FLAGSHIP — /compare/freehold-vs-condo. A net-new two-column
// ComparePage composer fed by getComparisonData(FREEHOLD_VS_CONDO_CONFIG), which
// sources BOTH columns live from the SAME getTenureHubData seam (FREEHOLD_CONFIG +
// CONDO_CONFIG) — two HubData objects -> two grounded, k-anon-gated stat columns.
// No new data layer. Forest .hub-v2 theme, single SiteNav, zero navy.
import { config } from "@/lib/config";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getComparisonData, compareFaqs, FREEHOLD_VS_CONDO_CONFIG } from "@/lib/comparisonData";
import ComparePage from "@/components/compare/ComparePage";
import SchemaScript from "@/components/SchemaScript";
import SiteFooter from "@/components/nav/SiteFooter";
import { generateBreadcrumbSchema, generateLocalBusinessSchema, generateFAQSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Shared SEO helper (like /freehold + /condos-guide) -> comparison-specific
// OG/Twitter + canonical instead of the homepage defaults.
export const metadata = genMeta({
  title: FREEHOLD_VS_CONDO_CONFIG.metaTitle,
  description: FREEHOLD_VS_CONDO_CONFIG.metaDescription,
  canonical: `${config.SITE_URL}/compare/${FREEHOLD_VS_CONDO_CONFIG.slug}`,
});

export default async function FreeholdVsCondoPage() {
  const data = await getComparisonData(FREEHOLD_VS_CONDO_CONFIG);
  // Source label comes off the live seam (the freehold side's market source);
  // falls back to a static label if the seam returns a shell.
  const source =
    data.sideA?.commentary.source ?? "PropTx MLS® active listings, today · Milton";

  // The {GAP} token resolved by the SAME function the page renders with (compareFaqs), so the
  // FAQPage JSON-LD is the visible text, and both say "typical asking" (MC-046).
  const schemaFaqs = compareFaqs(data);

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Compare", url: `${config.SITE_URL}/compare` },
      { name: FREEHOLD_VS_CONDO_CONFIG.breadcrumbLabel, url: `${config.SITE_URL}/compare/${FREEHOLD_VS_CONDO_CONFIG.slug}` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(schemaFaqs),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <ComparePage data={data} source={source} />
      <SiteFooter />
    </>
  );
}
