// src/app/potl/page.tsx
// LIVE /potl — the POTL (Parcel of Tied Land) ownership-axis hub. The LAST of the
// three tenure hubs (freehold / condo / POTL). NULL-STATS: POTL has sub-k active
// listings, so this page is a number-free editorial explainer — POTL_CONFIG sets
// nullStats:true and the shared composer hides every stat-bearing section. Same
// TenureHubPage composer + getTenureHubData seam as /freehold and /condos-guide.
import { config } from "@/lib/config";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getTenureHubData, POTL_CONFIG } from "@/lib/tenureHubData";
import TenureHubPage from "@/components/tenure/TenureHubPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema, generateFAQSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Shared SEO helper (like /freehold + /condos-guide) -> POTL-specific OG/Twitter + canonical.
export const metadata = genMeta({
  title: `POTL Homes in ${config.CITY_NAME} — Parcel of Tied Land Explained`,
  description: `What "Parcel of Tied Land" (POTL) means in ${config.CITY_NAME}, ${config.CITY_PROVINCE}: you own your townhome and lot freehold but pay a modest monthly fee for shared roads and common elements. POTL vs freehold vs condo, and what to check before you make an offer.`,
  canonical: `${config.SITE_URL}/potl`,
});

export default async function PotlPage() {
  const data = await getTenureHubData(POTL_CONFIG);

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Buy", url: `${config.SITE_URL}/listings` },
      { name: `POTL in ${config.CITY_NAME}`, url: `${config.SITE_URL}/potl` },
    ]),
    generateLocalBusinessSchema(),
    ...(data && data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      {data && <TenureHubPage data={data} eyebrow={POTL_CONFIG.eyebrow} />}
      <FooterSection />
    </>
  );
}
