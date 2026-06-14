// src/app/schools/[slug]/page.tsx — forest-v2 via the shared PlaceDetail template.
// RESTYLE ONLY: the hardcoded school lookup, the nearby-listings + market-stats
// + nearby-streets queries (permAdvertise + city), the FAQ build, and the
// JSON-LD (breadcrumb / LocalBusiness / FAQ / School) are byte-identical.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSchoolBySlug, getSchoolsByNeighbourhood } from "@/lib/schools";
import { prisma } from "@/lib/prisma";
import { formatPriceFull } from "@/lib/format";
import { config } from "@/lib/config";
import SchemaScript from "@/components/SchemaScript";
import {
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import PlaceDetail from "@/components/places/PlaceDetail";
import PlaceListings from "@/components/places/PlaceListings";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const school = getSchoolBySlug(params.slug);
  if (!school) return { title: "School Not Found" };
  return {
    title: `Homes Near ${school.name} ${config.CITY_NAME} — Prices, Listings & School Zone Data`,
    description: `Find homes for sale near ${school.name} in ${school.neighbourhood}, ${config.CITY_NAME} ${config.CITY_PROVINCE}. Live TREB listings, average prices, and neighbourhood data for families. ${school.grades} · ${school.boardName}.`,
    alternates: { canonical: `${config.SITE_URL}/schools/${params.slug}` },
    keywords: [
      `homes near ${school.name}`,
      `${school.name} school zone`,
      `${school.name} ${config.CITY_NAME}`,
      `houses for sale near ${school.name}`,
      `${school.neighbourhood} ${config.CITY_NAME} homes`,
      `${config.CITY_NAME} ${school.level} schools`,
      `${school.boardName} ${config.CITY_NAME}`,
    ],
    openGraph: {
      title: `Homes Near ${school.name} — ${school.neighbourhood}, ${config.CITY_NAME}`,
      description: `Find homes for sale in the ${school.name} school zone. ${school.grades} · ${school.boardName}. Live listings updated daily.`,
    },
  };
}

export default async function SchoolDetailPage({ params }: Props) {
  const school = getSchoolBySlug(params.slug);
  if (!school) notFound();

  const listings = await prisma.listing.findMany({
    where: {
      status: "active",
      permAdvertise: true,
      city: config.PRISMA_CITY_VALUE,
      neighbourhood: { contains: school.neighbourhood, mode: "insensitive" },
    },
    orderBy: { price: "asc" },
    take: 30,
  });

  const allListings = await prisma.listing.findMany({
    where: {
      permAdvertise: true,
      city: config.PRISMA_CITY_VALUE,
      neighbourhood: { contains: school.neighbourhood, mode: "insensitive" },
    },
    select: { price: true, status: true, propertyType: true },
  });

  const active = allListings.filter((l) => l.status === "active");
  const avgPrice = active.length > 0 ? Math.round(active.reduce((s, l) => s + l.price, 0) / active.length) : 0;

  const types = ["detached", "semi", "townhouse", "condo"];
  const byType = types
    .map((t) => {
      const ofType = active.filter((l) => l.propertyType === t);
      return {
        type: t,
        count: ofType.length,
        avgPrice: ofType.length > 0 ? Math.round(ofType.reduce((s, l) => s + l.price, 0) / ofType.length) : 0,
      };
    })
    .filter((t) => t.count > 0);

  const nearbyStreets = await prisma.listing.groupBy({
    by: ["streetSlug"],
    where: {
      status: "active",
      permAdvertise: true,
      neighbourhood: { contains: school.neighbourhood, mode: "insensitive" },
    },
    _count: true,
    _avg: { price: true },
    orderBy: { _count: { streetSlug: "desc" } },
    take: 6,
  });
  const streetDetails = await Promise.all(
    nearbyStreets.map(async (s) => {
      const sample = await prisma.listing.findFirst({
        where: { streetSlug: s.streetSlug },
        select: { streetName: true },
      });
      return { slug: s.streetSlug, name: sample?.streetName || s.streetSlug, count: s._count, avgPrice: Math.round(s._avg.price || 0) };
    })
  );

  const nearbySchools = getSchoolsByNeighbourhood(school.neighbourhood).filter((s) => s.slug !== school.slug);

  const faqs = [
    {
      question: `What homes are for sale near ${school.name} in ${config.CITY_NAME}?`,
      answer: `There are currently ${active.length} active listings near ${school.name} in ${school.neighbourhood}, ${config.CITY_NAME}.${avgPrice > 0 ? ` The average asking price is ${formatPriceFull(avgPrice)}.` : ""} ${byType.length > 0 ? `Property types include ${byType.map((t) => `${t.type} (${t.count})`).join(", ")}.` : ""}`,
    },
    {
      question: `What grades does ${school.name} serve?`,
      answer: `${school.name} serves grades ${school.grades}. It is part of the ${school.boardName}.${school.notes ? ` ${school.notes}.` : ""}`,
    },
    {
      question: `What is the average home price near ${school.name}?`,
      answer: `The average asking price for homes near ${school.name} in ${school.neighbourhood} is ${formatPriceFull(avgPrice)}. ${byType.length > 0 ? byType.map((t) => `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} homes average ${formatPriceFull(t.avgPrice)}`).join(". ") + "." : ""} Register for full MLS® access to see detailed market data, including historical transaction records on individual street pages.`,
    },
    {
      question: `Is ${school.neighbourhood} a good area for families in ${config.CITY_NAME}?`,
      answer: `${school.neighbourhood} in ${config.CITY_NAME} is home to ${getSchoolsByNeighbourhood(school.neighbourhood).length} school${getSchoolsByNeighbourhood(school.neighbourhood).length > 1 ? "s" : ""}, including ${school.name}. With ${active.length} homes currently for sale, families have options across detached, semi, townhouse and condo properties. ${config.CITY_NAME}'s GO train connectivity and growing community make it popular with young families.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Schools", url: `${config.SITE_URL}/schools` },
      { name: school.name, url: `${config.SITE_URL}/schools/${params.slug}` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(faqs),
    {
      "@context": "https://schema.org",
      "@type": "School",
      name: school.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: config.CITY_NAME,
        addressRegion: config.CITY_PROVINCE,
        addressCountry: config.CITY_COUNTRY_CODE,
      },
      parentOrganization: { "@type": "Organization", name: school.boardName },
    },
  ];

  const serializedListings = JSON.parse(JSON.stringify(listings));

  return (
    <>
      <SchemaScript schemas={schemas} />
      <PlaceDetail
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Schools", href: "/schools" },
          { label: school.name },
        ]}
        badge={{
          label: `${school.board === "public" ? "Public" : "Catholic"} ${school.level}`,
          tone: school.board === "public" ? "blue" : "amber",
        }}
        heroEyebrow={`${school.neighbourhood} · ${config.CITY_NAME}`}
        title={`Homes Near ${school.name}`}
        metaLine={`${school.grades} · ${school.boardName}${school.notes ? ` · ${school.notes}` : ""}`}
        highlight={school.fraserScore ? `Fraser Institute score: ${school.fraserScore}/10` : null}
        stats={[
          { value: String(active.length), label: "Active listings nearby" },
          { value: avgPrice > 0 ? formatPriceFull(avgPrice) : "—", label: "Avg asking price" },
          { value: String(allListings.length), label: "Total listings" },
        ]}
        byType={byType.map((t) => ({ type: t.type, count: t.count, avgPrice: formatPriceFull(t.avgPrice) }))}
        listingsHeading={`Homes for sale near ${school.name}`}
        listings={<PlaceListings listings={serializedListings} placeName={school.name} />}
        streetsHeading={`Streets near ${school.name}`}
        streets={streetDetails.map((s) => ({
          name: s.name,
          href: `/streets/${s.slug}`,
          price: formatPriceFull(s.avgPrice),
          sub: `${s.count} active listings`,
        }))}
        siblingsHeading={`Other schools in ${school.neighbourhood}`}
        siblings={nearbySchools.map((s) => ({
          name: s.name,
          href: `/schools/${s.slug}`,
          badge: { label: s.board === "public" ? "Public" : "Catholic", tone: s.board === "public" ? "blue" : "amber" },
          sub: `${s.grades} · ${s.boardName}`,
        }))}
        faqs={faqs}
        cta={{
          heading: `Looking for a home near ${school.name}?`,
          body: `${config.realtor.name.split(" ")[0]} knows every street in ${school.neighbourhood}. Let him help you find the perfect family home.`,
        }}
      />
    </>
  );
}
