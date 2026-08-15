import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getHubData } from "@/lib/hubData";
import { getHubMetaLive, getHubInputCached, hubCanonical } from "@/lib/hubLive";
import HubPage from "@/components/hub/HubPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import {
  generateNeighbourhoodSchema,
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import { projectHubSchema } from "@/lib/ai/hub/projectHubEntities";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

// Every hub meta reads the LIVE builder — the Timberlea patch, generalised.
// The stored HubContent.metaDescription is no longer served to anyone: it was a
// snapshot of a market that has since moved under it on 21 of 22 hubs, and on
// two of them it published a price the page itself suppresses. See lib/hubLive.ts
// for the measurements and lib/ai/hub/hubMeta.ts for the one shared formula.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = await getHubMetaLive(params.slug);
  if (!meta) return { title: "Neighbourhood Not Found" };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: hubCanonical(params.slug) },
  };
}

export default async function NeighbourhoodPage({ params }: Props) {
  const data = await getHubData(params.slug);
  if (!data) notFound();

  // Projected hub Place/ItemList schema (DEC-WS4-2) — rebuilt best-effort so the SEO
  // the WS5 page carried is preserved; falls back to the neighbourhood schema if it throws.
  let hubSchema: Record<string, unknown> | null = null;
  try {
    // Same request-cached input the metadata and the body read — one computation,
    // so the JSON-LD cannot describe a different aggregate than the rendered page.
    const input = await getHubInputCached(params.slug);
    if (!input) throw new Error("no hub input");
    // The hub JSON-LD ItemList mirrors exactly what the page renders: the published-only,
    // capped ladder (data.streets) plus any VIP-strip street not already in it. data.streets /
    // data.vipStreets are already published-only + capped by getHubData, so the schema declares
    // no /streets/ URL that isn't visible on the page (and none that DEC-SEO-1 will 404). The full
    // per-neighbourhood published list is declared separately by the /streets overflow page.
    const ladderSlugs = new Set(data.streets.map((s) => s.slug));
    const renderedStreets = [
      ...data.streets.map((s) => ({ name: s.name, slug: s.slug })),
      ...data.vipStreets.filter((v) => !ladderSlugs.has(v.slug)).map((v) => ({ name: v.name, slug: v.slug })),
    ];
    hubSchema = projectHubSchema(input, renderedStreets) as unknown as Record<string, unknown>;
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
