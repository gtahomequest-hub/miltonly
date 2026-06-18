// src/app/condos-guide/page.tsx
// LIVE /condos-guide — the CONDO ownership-axis hub (decision/guide page). This is
// DISTINCT from /condos (the building directory): /condos = "browse buildings",
// /condos-guide = "should I buy a condo, and how do I do it safely". Renders through
// the SAME shared TenureHubPage composer + getTenureHubData seam as /freehold, fed
// by CONDO_CONFIG. No template work — config only.
import { config } from "@/lib/config";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getTenureHubData, CONDO_CONFIG } from "@/lib/tenureHubData";
import { COMPARE_TEASER, getCompareContrast, FREEHOLD_VS_CONDO_CONFIG } from "@/lib/comparisonData";
import TenureHubPage from "@/components/tenure/TenureHubPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema, generateFAQSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Shared SEO helper (like /freehold) -> condo-specific OG/Twitter + canonical.
export const metadata = genMeta({
  title: `Condos in ${config.CITY_NAME} — Prices, Fees & Condo vs Freehold`,
  description: `Buying a condo in ${config.CITY_NAME}, ${config.CITY_PROVINCE}? Live condo prices, typical monthly fees, condo-vs-freehold trade-offs, and the status-certificate checks that make or break a condo purchase.`,
  canonical: `${config.SITE_URL}/condos-guide`,
});

export default async function CondosGuidePage() {
  const data = await getTenureHubData(CONDO_CONFIG);
  // Live contrast for the teaser; condo leads the line to match this hub's framing.
  const compareContrast = await getCompareContrast(FREEHOLD_VS_CONDO_CONFIG, "B");

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Buy", url: `${config.SITE_URL}/listings` },
      { name: `Condos in ${config.CITY_NAME}`, url: `${config.SITE_URL}/condos-guide` },
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
          eyebrow={CONDO_CONFIG.eyebrow}
          compareLink={{ ...COMPARE_TEASER.condo, contrast: compareContrast }}
        />
      )}
      <FooterSection />
    </>
  );
}
