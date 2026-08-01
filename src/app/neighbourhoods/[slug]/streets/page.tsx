import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getNeighbourhoodStreetIndex } from "@/lib/neighbourhoodStreets";
import { generateBreadcrumbSchema } from "@/lib/schema";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import SchemaScript from "@/components/SchemaScript";
import NeighbourhoodStreets from "@/components/neighbourhood/NeighbourhoodStreets";
import "./nbst-theme.css";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getNeighbourhoodStreetIndex(params.slug).catch(() => null);
  if (!data) return { title: "Neighbourhood Not Found" };
  const hook =
    data.typicalPrice != null
      ? ` — typically ${money(data.typicalPrice)}${data.sold12mo ? `, ${data.sold12mo} sold in the last 12 months` : ""}`
      : "";
  return {
    title: `Streets in ${data.name}, ${config.CITY_NAME} — Every Street & Its Sales`,
    description: `Every street in ${data.name}, ${config.CITY_NAME} we publish a full guide for — all ${data.publishedCount}, each with its own recorded sales history${hook}. Ranked by activity, indexed A–Z.`,
    alternates: { canonical: `${config.SITE_URL}/neighbourhoods/${params.slug}/streets` },
    keywords: [
      `streets in ${data.name} ${config.CITY_NAME}`,
      `${data.name} ${config.CITY_NAME} streets`,
      `${data.name} street directory`,
      `${data.name} ${config.CITY_NAME} homes by street`,
    ],
  };
}

export default async function NeighbourhoodStreetsPage({ params }: Props) {
  const data = await getNeighbourhoodStreetIndex(params.slug);
  if (!data) notFound();

  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Neighbourhoods", url: `${config.SITE_URL}/neighbourhoods` },
      { name: `${data.name}, ${config.CITY_NAME}`, url: `${config.SITE_URL}/neighbourhoods/${data.slug}` },
      { name: "Streets", url: `${config.SITE_URL}/neighbourhoods/${data.slug}/streets` },
    ]),
    // A REAL ItemList — every item carries a resolvable url (unlike the inert street-page
    // "alternative streets" node). Only published streets are listed, so every url is a 200.
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Streets in ${data.name}, ${config.CITY_NAME}`,
      numberOfItems: data.streets.length,
      itemListElement: data.streets.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: s.name,
        url: `${config.SITE_URL}/streets/${s.slug}`,
      })),
    },
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <SiteNav variant="page" />
      <NeighbourhoodStreets data={data} />
      <FooterSection />
    </>
  );
}
