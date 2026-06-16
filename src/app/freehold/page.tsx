// src/app/freehold/page.tsx
// LIVE /freehold — the first ownership-axis hub. Flat route, mirrors /condos.
// Renders the SHARED TenureHubPage (reuses .hub-v2) fed by getTenureHubData
// (FREEHOLD_CONFIG): static editorial + LIVE grounded stats (active LIST from
// DB1, sold from the VOW analytics DB, k-anon gated). condo + POTL plug in later
// as configs against the same seam + template.
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getTenureHubData, FREEHOLD_CONFIG } from "@/lib/tenureHubData";
import TenureHubPage from "@/components/tenure/TenureHubPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema, generateFAQSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Freehold Homes in ${config.CITY_NAME} — Detached, Semi & Freehold Townhomes`,
  description: `Freehold homes for sale in ${config.CITY_NAME}, ${config.CITY_PROVINCE}: own the home and the land with no condo fee. Live prices for detached, semi, and freehold townhomes, plus how freehold compares to condo and POTL ownership.`,
  alternates: { canonical: `${config.SITE_URL}/freehold` },
};

export default async function FreeholdPage() {
  const data = await getTenureHubData(FREEHOLD_CONFIG);

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
      {data && <TenureHubPage data={data} eyebrow={FREEHOLD_CONFIG.eyebrow} />}
      <FooterSection />
    </>
  );
}
