import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getCondoData } from "@/lib/condoData";
import CondoPage from "@/components/condo/CondoPage";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import {
  generateCondoSchema,
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import { buildBuildingAttributes } from "@/lib/ai/buildBuildingAttributes";
import { generateCondoNarrative } from "@/lib/ai/condoNarrative";
import { toCondoView } from "@/lib/ai/condoView";
import BuildingAttributesPage from "@/components/condo/BuildingAttributesPage";
import { isCondoPilot } from "@/lib/condoPilots";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Build B pilots: metadata from the building entity (no CondoContent required).
  if (isCondoPilot(params.slug)) {
    const b = await prisma.condoBuilding.findUnique({
      where: { slug: params.slug },
      select: { displayName: true, buildingAddress: true },
    });
    const nm = b?.displayName ?? b?.buildingAddress ?? params.slug;
    return {
      title: `${nm} — ${config.CITY_NAME} Condo Building`,
      description: `Sales, leases, gross yield and amenities for ${nm} in ${config.CITY_NAME} — every figure from the building's own recorded trades.`,
      alternates: { canonical: `${config.SITE_URL}/condos/${params.slug}` },
    };
  }
  const content = await prisma.condoContent.findUnique({
    where: { buildingSlug: params.slug },
    select: { status: true, metaTitle: true, metaDescription: true, buildingName: true },
  });
  if (!content || content.status !== "published") return { title: "Condo Not Found" };
  return {
    title: content.metaTitle ?? `${content.buildingName} | ${config.CITY_NAME} Condo Building Guide`,
    description: content.metaDescription ?? undefined,
    alternates: { canonical: `${config.SITE_URL}/condos/${params.slug}` },
  };
}

export default async function CondoBuildingPage({ params }: Props) {
  // Build B pilots render ONLY the buildBuildingAttributes payload (no CondoContent/LLM prose).
  if (isCondoPilot(params.slug)) {
    const attrs = await buildBuildingAttributes(params.slug).catch(() => null);
    if (!attrs) notFound();
    const { _debug, ...safe } = attrs; // eslint-disable-line @typescript-eslint/no-unused-vars
    // Grounded, fail-closed narrative (routes through callDeepSeek's assertPromptSafe choke).
    const { prose: narrative } = await generateCondoNarrative(safe).catch(() => ({ prose: null }));
    // Sanitize to a display-safe view — ONLY this crosses to the client (serialized into the HTML).
    const view = toCondoView(safe, narrative);
    const schemas: Array<Record<string, unknown>> = [
      generateCondoSchema({ name: safe.buildingName.name, slug: safe.slug, address: safe.displayName, latitude: 0, longitude: 0 }),
      generateBreadcrumbSchema([
        { name: "Home", url: config.SITE_URL },
        { name: "Condos", url: `${config.SITE_URL}/condos` },
        { name: safe.buildingName.name, url: `${config.SITE_URL}/condos/${safe.slug}` },
      ]),
      generateLocalBusinessSchema(),
    ];
    return (
      <>
        <SchemaScript schemas={schemas} />
        <BuildingAttributesPage view={view} />
        <FooterSection />
      </>
    );
  }

  const data = await getCondoData(params.slug);
  if (!data) notFound();

  // Geo/year/units for the ApartmentComplex schema (building-level, may be null).
  const building = await prisma.condoBuilding.findUnique({
    where: { slug: params.slug },
    select: { latitude: true, longitude: true, yearBuilt: true, totalUnits: true },
  });

  const schemas: Array<Record<string, unknown>> = [
    generateCondoSchema({
      name: data.name,
      slug: data.slug,
      address: data.address,
      yearBuilt: building?.yearBuilt,
      totalUnits: building?.totalUnits,
      latitude: building?.latitude ?? 0,
      longitude: building?.longitude ?? 0,
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Condos", url: `${config.SITE_URL}/condos` },
      { name: data.name, url: `${config.SITE_URL}/condos/${data.slug}` },
    ]),
    generateLocalBusinessSchema(),
    ...(data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <CondoPage data={data} />
      <FooterSection />
    </>
  );
}
