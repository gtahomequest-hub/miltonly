import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getCondoData } from "@/lib/condoData";
import CondoPage from "@/components/condo/CondoPage";
import SchemaScript from "@/components/SchemaScript";
import SiteFooter from "@/components/nav/SiteFooter";
import {
  generateCondoSchema,
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import { resolveCondoName } from "@/lib/condoName";
import { mentionsVowTopic } from "@/lib/prose/vowTopic";

// MC-046 Stage 1 (PropTx VOW Best Practices item 40).
//   · R3: the four Build B pilot slugs (src/lib/condoPilots.ts) serve the STANDARD template
//     until Stage 2. BuildingAttributesPage is not rendered and nothing from
//     buildBuildingAttributes (sale and lease medians, yields, mix, velocity, the DB3 area
//     typical) is read for them. A pilot with no published CondoContent answers 404, as any
//     unpublished building does.
//   · R4: the stored metaTitle / metaDescription are served only when they carry no figure and
//     no VOW topic (headFieldIsSafe below); otherwise a figure-free template stands in.

/** A stored head string may carry the building's civic number and nothing else numeric. */
function headFieldIsSafe(v: string | null | undefined, civic: string | null | undefined): v is string {
  if (!v) return false;
  const withoutCivic = civic ? v.split(civic).join(" ") : v;
  if (/\d|[$%]/.test(withoutCivic)) return false;
  return !mentionsVowTopic(v);
}

// MC-017 (2026-09-13): ISR, not a render per request. A visit past the day, or a purge, renders
// once and the copy serves until the next. Every DB2 read carries the db2 tag and every DB3 read
// the db3 tag (src/lib/db.ts), dropped by the sold sync and the analytics jobs; the DB1 rows are
// dropped by path from the write paths (src/lib/revalidateSurfaces.ts). generateStaticParams
// returns nothing, and it must exist: without it Next 14 treats a dynamic route as dynamic on
// every request and never fills the route cache (the first MC-017 preview served every page
// MISS, private, no-store). With it, nothing is prerendered at build and every page renders on
// its first visit, then serves from the cache. A page whose Neon reads carry their own hour
// revalidates on the hour: Next takes the smaller of the route's and a fetch's.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
  // MC-046 R4: a stored head field that carries a figure or a VOW topic is not served.
  const civic = b?.streetNumber ?? null;
  const storedTitle = swap(content.metaTitle);
  const storedDescription = swap(content.metaDescription);
  const title = headFieldIsSafe(storedTitle, civic) ? storedTitle : `${nm} | ${config.CITY_NAME} Condo Building Guide`;
  const description = headFieldIsSafe(storedDescription, civic)
    ? storedDescription
    : `${nm} in ${config.CITY_NAME}: the building guide, its amenities and rules, and the units listed in it today.`;
  return {
    title,
    description,
    alternates: { canonical: `${config.SITE_URL}/condos/${params.slug}` },
    openGraph: { title, description, url: `${config.SITE_URL}/condos/${params.slug}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CondoBuildingPage({ params }: Props) {
  // Every building, the four pilots included, renders the standard template (MC-046 R3).
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
    // FAQPage follows EXACTLY the rendered FAQ set: getCondoData filters the stored answers for
    // figures and VOW topics (MC-046 R2), whatever the generation's age.
    ...(data.faqs.length ? [generateFAQSchema(data.faqs)] : []),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <CondoPage data={data} />
      <SiteFooter />
    </>
  );
}
