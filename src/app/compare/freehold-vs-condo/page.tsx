// src/app/compare/freehold-vs-condo/page.tsx
// THE COMPARE FLAGSHIP — /compare/freehold-vs-condo. A net-new two-column
// ComparePage composer fed by getComparisonData(FREEHOLD_VS_CONDO_CONFIG), which
// sources BOTH columns live from the SAME getTenureHubData seam (FREEHOLD_CONFIG +
// CONDO_CONFIG) — two HubData objects -> two grounded, k-anon-gated stat columns.
// No new data layer. Forest .hub-v2 theme, single SiteNav, zero navy.
import { config } from "@/lib/config";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getComparisonData, FREEHOLD_VS_CONDO_CONFIG } from "@/lib/comparisonData";
import ComparePage from "@/components/compare/ComparePage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
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
    data.sideA?.commentary.source ?? "TREB / PropTx MLS® sold data, last 12 months · Milton";

  // Resolve the {GAP} token in the FAQ answers so the FAQPage JSON-LD matches the
  // rendered page (Google rejects structured data that diverges from visible text).
  const mA = data.sideA?.compareFacts?.medianList;
  const mB = data.sideB?.compareFacts?.medianList;
  const faqGap =
    mA && mB
      ? `In Milton today, the median is $${mA.toLocaleString("en-CA")} for ${FREEHOLD_VS_CONDO_CONFIG.sideA.label.toLowerCase()} versus $${mB.toLocaleString("en-CA")} for a ${FREEHOLD_VS_CONDO_CONFIG.sideB.label.toLowerCase()}.`
      : "";
  const schemaFaqs = FREEHOLD_VS_CONDO_CONFIG.faqs.map((f) => ({
    question: f.question,
    answer: f.answer.replace("{GAP}", faqGap).replace(/\s{2,}/g, " ").trim(),
  }));

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
      <FooterSection />
    </>
  );
}
