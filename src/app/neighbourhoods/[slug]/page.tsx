import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getHubData } from "@/lib/hubData";
import HubPage from "@/components/hub/HubPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import {
  generateNeighbourhoodSchema,
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import { buildHubInput, buildRuralHubInput } from "@/lib/ai/buildHubInput";
import { projectHubSchema } from "@/lib/ai/hub/projectHubEntities";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const content = await prisma.hubContent.findUnique({
    where: { neighbourhoodSlug: params.slug },
    select: { status: true, metaTitle: true, metaDescription: true, neighbourhoodName: true },
  });
  if (!content || content.status !== "published") return { title: "Neighbourhood Not Found" };

  // SERP override (GSC 2026-07-18 keyword report): the Timberlea hub carries
  // 60 impressions at ~pos 19 with zero clicks across three query variants.
  // Slug-scoped rewrite leading with the searcher's words + a live-data hook;
  // the DB metaTitle template for every other hub is unchanged.
  if (params.slug === "timberlea") {
    let hook = "";
    try {
      const input = await buildHubInput("timberlea");
      const p = input.aggregates.typicalPrice;
      const n = input.aggregates.salesCount;
      if (p != null && p > 0) {
        const rounded = Math.round(p / 5000) * 5000;
        hook = ` — typically $${rounded.toLocaleString("en-CA")}${n > 0 ? `, ${n} sales in the last 12 months` : ""}`;
      }
    } catch {
      /* fail-soft: description reads fine without the live numbers */
    }
    return {
      title: `Timberlea, ${config.CITY_NAME} — Homes, Prices & Street Guide`,
      description:
        `Timberlea homes for sale and what they really sell for${hook}. ` +
        `Street-by-street guide, live listings, and a straight market read on Milton's established central pocket.`,
      alternates: { canonical: `${config.SITE_URL}/neighbourhoods/${params.slug}` },
    };
  }

  return {
    title: content.metaTitle ?? `${content.neighbourhoodName} ${config.CITY_NAME} — Neighbourhood Guide`,
    description: content.metaDescription ?? undefined,
    alternates: { canonical: `${config.SITE_URL}/neighbourhoods/${params.slug}` },
  };
}

export default async function NeighbourhoodPage({ params }: Props) {
  const data = await getHubData(params.slug);
  if (!data) notFound();

  // Projected hub Place/ItemList schema (DEC-WS4-2) — rebuilt best-effort so the SEO
  // the WS5 page carried is preserved; falls back to the neighbourhood schema if it throws.
  let hubSchema: Record<string, unknown> | null = null;
  try {
    const input = data.profile === "urban" ? await buildHubInput(params.slug) : await buildRuralHubInput(params.slug);
    hubSchema = projectHubSchema(input) as unknown as Record<string, unknown>;
  } catch {
    hubSchema = null;
  }

  const schemas: Array<Record<string, unknown>> = [
    ...(hubSchema ? [hubSchema] : []),
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Neighbourhoods", url: `${config.SITE_URL}/neighbourhoods` },
      { name: `${data.name}, ${config.CITY_NAME}`, url: `${config.SITE_URL}/neighbourhoods/${data.slug}` },
    ]),
    generateLocalBusinessSchema(),
    generateNeighbourhoodSchema({
      name: data.name,
      slug: data.slug,
      description: data.character || `Real estate data for ${data.name}, ${config.CITY_NAME}.`,
    }),
    ...(data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <HubPage data={data} />
      <FooterSection />
    </>
  );
}
