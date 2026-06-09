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
