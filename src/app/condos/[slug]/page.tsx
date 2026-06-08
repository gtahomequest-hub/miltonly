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

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
