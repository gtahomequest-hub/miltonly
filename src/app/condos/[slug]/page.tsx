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
import { composeCondoBrief } from "@/lib/ai/condoBrief";
import { toCondoView } from "@/lib/ai/condoView";
import BuildingAttributesPage from "@/components/condo/BuildingAttributesPage";
import { isCondoPilot } from "@/lib/condoPilots";
import { resolveCondoName } from "@/lib/condoName";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Build B pilots: metadata from the building entity (no CondoContent required).
  if (isCondoPilot(params.slug)) {
    const b = await prisma.condoBuilding.findUnique({
      where: { slug: params.slug },
      select: { displayName: true, buildingAddress: true, streetNumber: true, streetSlug: true },
    });
    // DEC-CONDO-NAME: resolved, never the stored string.
    const nm = b
      ? resolveCondoName({ slug: params.slug, streetNumber: b.streetNumber, streetSlug: b.streetSlug, buildingAddress: b.buildingAddress }).name
      : params.slug;
    const description = `Sales, leases, gross yield and amenities for ${nm} in ${config.CITY_NAME} — every figure from the building's own recorded trades.`;
    const title = `${nm} — ${config.CITY_NAME} Condo Building`;
    return {
      title,
      description,
      alternates: { canonical: `${config.SITE_URL}/condos/${params.slug}` },
      openGraph: { title, description, url: `${config.SITE_URL}/condos/${params.slug}`, type: "article" },
      twitter: { card: "summary_large_image", title, description },
    };
  }
  const [content, b] = await Promise.all([
    prisma.condoContent.findUnique({
      where: { buildingSlug: params.slug },
      select: { status: true, metaTitle: true, metaDescription: true, buildingName: true },
    }),
    prisma.condoBuilding.findUnique({
      where: { slug: params.slug },
      select: { buildingAddress: true, streetNumber: true, streetSlug: true },
    }),
  ]);
  if (!content || content.status !== "published") return { title: "Condo Not Found" };
  // DEC-CONDO-NAME. The stored metaTitle and metaDescription carry the abbreviation on 57 of 59
  // rows, so the resolved name REPLACES it inside them rather than being appended: a title that
  // says "1005 Nadalin Hts" beside an H1 that says "1005 Nadalin Heights" is worse than either.
  // The backfill rewrites the columns; this holds whether or not it has run.
  const resolved = b
    ? resolveCondoName({ slug: params.slug, streetNumber: b.streetNumber, streetSlug: b.streetSlug, buildingAddress: b.buildingAddress })
    : null;
  const nm = resolved?.name ?? content.buildingName;
  const stored = content.buildingName;
  const swap = (v: string | null): string | null =>
    v && stored && nm !== stored ? v.split(stored).join(nm) : v;
  const title = swap(content.metaTitle) ?? `${nm} | ${config.CITY_NAME} Condo Building Guide`;
  const description = swap(content.metaDescription) ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `${config.SITE_URL}/condos/${params.slug}` },
    openGraph: { title, description, url: `${config.SITE_URL}/condos/${params.slug}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CondoBuildingPage({ params }: Props) {
  // Build B pilots render ONLY the buildBuildingAttributes payload (no CondoContent/LLM prose).
  if (isCondoPilot(params.slug)) {
    const attrs = await buildBuildingAttributes(params.slug).catch(() => null);
    if (!attrs) notFound();
    const { _debug, ...safe } = attrs; // eslint-disable-line @typescript-eslint/no-unused-vars
    // Template-composed brief (deterministic, no model call; assertPromptSafe belt, fail-closed).
    const { text: brief } = composeCondoBrief(safe);
    // Sanitize to a display-safe view — ONLY this crosses to the client (serialized into the HTML).
    const view = toCondoView(safe, brief);
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
