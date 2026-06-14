// src/app/mosques/[slug]/page.tsx — forest-v2 via the shared PlaceDetail template.
// RESTYLE ONLY: the hardcoded mosque lookup, the nearby-listings + market-stats
// + nearby-streets queries (permAdvertise + city), the FAQ build, and the
// JSON-LD (breadcrumb / LocalBusiness / FAQ / Mosque) are byte-identical.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMosqueBySlug, getMosquesByNeighbourhood } from "@/lib/mosques";
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
import type { BadgeTone } from "@/components/places/types";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

const BADGE_TONE: Record<string, BadgeTone> = { masjid: "blue", musalla: "amber", centre: "green" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mosque = getMosqueBySlug(params.slug);
  if (!mosque) return { title: "Mosque Not Found" };
  return {
    title: `Homes Near ${mosque.name} ${config.CITY_NAME} — Listings & Prices`,
    description: `Find homes for sale near ${mosque.name} in ${config.CITY_NAME} ${config.CITY_PROVINCE}. ${mosque.address}. Live TREB listings, prices, and neighbourhood data. ${mosque.affiliation}.`,
    alternates: { canonical: `${config.SITE_URL}/mosques/${params.slug}` },
    keywords: [
      `homes near ${mosque.name}`,
      `${mosque.name} ${config.CITY_NAME}`,
      `houses for sale near ${mosque.name}`,
      `${config.CITY_NAME} mosque real estate`,
      `${mosque.neighbourhood} ${config.CITY_NAME} homes`,
      `Muslim community ${config.CITY_NAME}`,
    ],
    openGraph: {
      title: `Homes Near ${mosque.name} — ${config.CITY_NAME}, ${config.CITY_PROVINCE}`,
      description: `Find homes for sale near ${mosque.name}. ${mosque.address}. Live listings updated daily.`,
    },
  };
}

export default async function MosqueDetailPage({ params }: Props) {
  const mosque = getMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const listings = await prisma.listing.findMany({
    where: {
      status: "active",
      permAdvertise: true,
      city: config.PRISMA_CITY_VALUE,
      neighbourhood: { contains: mosque.neighbourhood, mode: "insensitive" },
    },
    orderBy: { price: "asc" },
    take: 30,
  });

  const allListings = await prisma.listing.findMany({
    where: {
      permAdvertise: true,
      city: config.PRISMA_CITY_VALUE,
      neighbourhood: { contains: mosque.neighbourhood, mode: "insensitive" },
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
      neighbourhood: { contains: mosque.neighbourhood, mode: "insensitive" },
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

  const nearbyMosques = getMosquesByNeighbourhood(mosque.neighbourhood).filter((m) => m.slug !== mosque.slug);
  const typeLabel = mosque.type === "masjid" ? "masjid" : mosque.type === "musalla" ? "musalla" : "community centre";

  const faqs = [
    {
      question: `What homes are for sale near ${mosque.name}?`,
      answer: `There are currently ${active.length} active listings near ${mosque.name} in ${mosque.neighbourhood}, ${config.CITY_NAME}.${avgPrice > 0 ? ` The average asking price is ${formatPriceFull(avgPrice)}.` : ""} ${byType.length > 0 ? `Property types include ${byType.map((t) => `${t.type} (${t.count})`).join(", ")}.` : ""}`,
    },
    {
      question: `What services does ${mosque.name} offer?`,
      answer: `${mosque.name} is a ${typeLabel} located at ${mosque.address}. It is affiliated with ${mosque.affiliation} and offers: ${mosque.services.join(", ")}.${mosque.notes ? ` ${mosque.notes}.` : ""}`,
    },
    {
      question: `What is the average home price near ${mosque.name}?`,
      answer: `The average asking price for homes near ${mosque.name} in ${mosque.neighbourhood} is ${formatPriceFull(avgPrice)}. ${byType.length > 0 ? byType.map((t) => `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} homes average ${formatPriceFull(t.avgPrice)}`).join(". ") + "." : ""} Register for full MLS® access to see detailed market data, including historical transaction records on individual street pages.`,
    },
    {
      question: `Is ${mosque.neighbourhood} a good area for Muslim families in ${config.CITY_NAME}?`,
      answer: `${mosque.neighbourhood} in ${config.CITY_NAME} is home to ${getMosquesByNeighbourhood(mosque.neighbourhood).length} mosque${getMosquesByNeighbourhood(mosque.neighbourhood).length > 1 ? "s and Islamic centres" : ""}, including ${mosque.name}. With ${active.length} homes currently for sale, families have options across property types. ${config.CITY_NAME}'s GO train connectivity and growing Muslim community make it a popular choice.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Mosques", url: `${config.SITE_URL}/mosques` },
      { name: mosque.name, url: `${config.SITE_URL}/mosques/${params.slug}` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(faqs),
    {
      "@context": "https://schema.org",
      "@type": "Mosque",
      name: mosque.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: mosque.address.replace(`, ${config.CITY_NAME}`, ""),
        addressLocality: config.CITY_NAME,
        addressRegion: config.CITY_PROVINCE,
        addressCountry: config.CITY_COUNTRY_CODE,
      },
    },
  ];

  const serializedListings = JSON.parse(JSON.stringify(listings));

  return (
    <>
      <SchemaScript schemas={schemas} />
      <PlaceDetail
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Mosques", href: "/mosques" },
          { label: mosque.name },
        ]}
        badge={{ label: typeLabel, tone: BADGE_TONE[mosque.type] }}
        heroEyebrow={`${mosque.neighbourhood} · ${config.CITY_NAME}`}
        title={`Homes Near ${mosque.name}`}
        metaLine={`${mosque.address} · ${mosque.affiliation}${mosque.notes ? ` · ${mosque.notes}` : ""}`}
        serviceChips={mosque.services}
        stats={[
          { value: String(active.length), label: "Active listings nearby" },
          { value: avgPrice > 0 ? formatPriceFull(avgPrice) : "—", label: "Avg asking price" },
          { value: String(allListings.length), label: "Total listings" },
        ]}
        byType={byType.map((t) => ({ type: t.type, count: t.count, avgPrice: formatPriceFull(t.avgPrice) }))}
        listingsHeading={`Homes for sale near ${mosque.name}`}
        listings={<PlaceListings listings={serializedListings} placeName={mosque.name} />}
        streetsHeading={`Streets near ${mosque.name}`}
        streets={streetDetails.map((s) => ({
          name: s.name,
          href: `/streets/${s.slug}`,
          price: formatPriceFull(s.avgPrice),
          sub: `${s.count} active listings`,
        }))}
        siblingsHeading={`Other mosques in ${mosque.neighbourhood}`}
        siblings={nearbyMosques.map((m) => ({
          name: m.name,
          href: `/mosques/${m.slug}`,
          badge: { label: m.type === "masjid" ? "Masjid" : m.type === "musalla" ? "Musalla" : "Centre", tone: BADGE_TONE[m.type] },
          sub: m.address,
        }))}
        faqs={faqs}
        cta={{
          heading: `Looking for a home near ${mosque.name}?`,
          body: `${config.realtor.name.split(" ")[0]} knows ${config.CITY_NAME} inside out. Let him help you find the right home for your family.`,
        }}
      />
    </>
  );
}
