import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSchoolBySlug, getSchoolsByNeighbourhood } from "@/lib/schools";
import { prisma } from "@/lib/prisma";
import { formatPriceFull } from "@/lib/format";
import SchemaScript from "@/components/SchemaScript";
import {
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import SchoolListings from "./SchoolListings";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const school = getSchoolBySlug(params.slug);
  if (!school) return { title: "School Not Found" };

  return {
    title: `Homes Near ${school.name} Milton — Prices, Listings & School Zone Data`,
    description: `Find homes for sale near ${school.name} in ${school.neighbourhood}, Milton Ontario. Live TREB listings, average prices, and neighbourhood data for families. ${school.grades} · ${school.boardName}.`,
    alternates: { canonical: `https://miltonly.com/schools/${params.slug}` },
    keywords: [
      `homes near ${school.name}`,
      `${school.name} school zone`,
      `${school.name} Milton`,
      `houses for sale near ${school.name}`,
      `${school.neighbourhood} Milton homes`,
      `Milton ${school.level} schools`,
      `${school.boardName} Milton`,
    ],
    openGraph: {
      title: `Homes Near ${school.name} — ${school.neighbourhood}, Milton`,
      description: `Find homes for sale in the ${school.name} school zone. ${school.grades} · ${school.boardName}. Live listings updated daily.`,
    },
  };
}

export default async function SchoolDetailPage({ params }: Props) {
  const school = getSchoolBySlug(params.slug);
  if (!school) notFound();

  // Fetch nearby active listings (by neighbourhood match)
  const listings = await prisma.listing.findMany({
    where: {
      status: "active",
      permAdvertise: true,
      city: "Milton",
      neighbourhood: { contains: school.neighbourhood, mode: "insensitive" },
    },
    orderBy: { price: "asc" },
    take: 30,
  });

  // Market stats for this neighbourhood
  const allListings = await prisma.listing.findMany({
    where: {
      permAdvertise: true,
      city: "Milton",
      neighbourhood: { contains: school.neighbourhood, mode: "insensitive" },
    },
    select: { price: true, status: true, propertyType: true, soldPrice: true },
  });

  const active = allListings.filter((l) => l.status === "active");
  const sold = allListings.filter((l) => l.status === "sold");
  const avgPrice =
    active.length > 0
      ? Math.round(active.reduce((s, l) => s + l.price, 0) / active.length)
      : allListings.length > 0
      ? Math.round(allListings.reduce((s, l) => s + l.price, 0) / allListings.length)
      : 0;
  const avgSoldPrice =
    sold.length > 0
      ? Math.round(
          sold.reduce((s, l) => s + (l.soldPrice || l.price), 0) / sold.length
        )
      : 0;

  // By type breakdown
  const types = ["detached", "semi", "townhouse", "condo"];
  const byType = types
    .map((t) => {
      const ofType = active.filter((l) => l.propertyType === t);
      return {
        type: t,
        count: ofType.length,
        avgPrice:
          ofType.length > 0
            ? Math.round(ofType.reduce((s, l) => s + l.price, 0) / ofType.length)
            : 0,
      };
    })
    .filter((t) => t.count > 0);

  // Nearby streets
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
      return {
        slug: s.streetSlug,
        name: sample?.streetName || s.streetSlug,
        count: s._count,
        avgPrice: Math.round(s._avg.price || 0),
      };
    })
  );

  // Other schools in same neighbourhood
  const nearbySchools = getSchoolsByNeighbourhood(school.neighbourhood).filter(
    (s) => s.slug !== school.slug
  );

  // FAQs
  const faqs = [
    {
      question: `What homes are for sale near ${school.name} in Milton?`,
      answer: `There are currently ${active.length} active listings near ${school.name} in ${school.neighbourhood}, Milton.${avgPrice > 0 ? ` The average asking price is ${formatPriceFull(avgPrice)}.` : ""} ${byType.length > 0 ? `Property types include ${byType.map((t) => `${t.type} (${t.count})`).join(", ")}.` : ""}`,
    },
    {
      question: `What grades does ${school.name} serve?`,
      answer: `${school.name} serves grades ${school.grades}. It is part of the ${school.boardName}.${school.notes ? ` ${school.notes}.` : ""}`,
    },
    {
      question: `What is the average home price near ${school.name}?`,
      answer: `The average asking price for homes near ${school.name} in ${school.neighbourhood} is ${formatPriceFull(avgPrice)}.${avgSoldPrice > 0 ? ` Recent sold prices average ${formatPriceFull(avgSoldPrice)}.` : ""} ${byType.length > 0 ? byType.map((t) => `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} homes average ${formatPriceFull(t.avgPrice)}`).join(". ") + "." : ""}`,
    },
    {
      question: `Is ${school.neighbourhood} a good area for families in Milton?`,
      answer: `${school.neighbourhood} in Milton is home to ${getSchoolsByNeighbourhood(school.neighbourhood).length} school${getSchoolsByNeighbourhood(school.neighbourhood).length > 1 ? "s" : ""}, including ${school.name}. With ${active.length} homes currently for sale, families have options across detached, semi, townhouse and condo properties. Milton's GO train connectivity and growing community make it popular with young families.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: "https://miltonly.com" },
      { name: "Schools", url: "https://miltonly.com/schools" },
      { name: school.name, url: `https://miltonly.com/schools/${params.slug}` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(faqs),
    {
      "@context": "https://schema.org",
      "@type": "School",
      name: school.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Milton",
        addressRegion: "Ontario",
        addressCountry: "CA",
      },
      parentOrganization: {
        "@type": "Organization",
        name: school.boardName,
      },
    },
  ];

  const serializedListings = JSON.parse(JSON.stringify(listings));

  return (
    <>
      <SchemaScript schemas={schemas} />
      <div className="min-h-screen">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-[#f1f5f9] px-5 sm:px-11 py-3">
          <div className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
            <Link href="/" className="hover:text-[#07111f]">Home</Link>
            <span>&rsaquo;</span>
            <Link href="/schools" className="hover:text-[#07111f]">Schools</Link>
            <span>&rsaquo;</span>
            <span className="text-[#475569] font-medium">{school.name}</span>
          </div>
        </div>

        {/* Hero */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-10 sm:py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      school.board === "public"
                        ? "bg-[#dbeafe] text-[#1e40af]"
                        : "bg-[#fef3c7] text-[#92400e]"
                    }`}
                  >
                    {school.board === "public" ? "Public" : "Catholic"} {school.level}
                  </span>
                  <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em]">
                    {school.neighbourhood} &middot; Milton
                  </p>
                </div>
                <h1 className="text-[28px] sm:text-[36px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
                  Homes Near {school.name}
                </h1>
                <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-3 max-w-lg leading-relaxed">
                  {school.grades} &middot; {school.boardName}
                  {school.notes && <> &middot; {school.notes}</>}
                </p>
                {school.fraserScore && (
                  <span className="inline-block mt-3 text-[11px] font-bold text-[#15803d] bg-[#f0fdf4] px-3 py-1 rounded-full">
                    Fraser Institute score: {school.fraserScore}/10
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0 lg:w-[340px]">
                {[
                  { value: String(active.length), label: "Active listings nearby" },
                  { value: avgPrice > 0 ? formatPriceFull(avgPrice) : "\u2014", label: "Avg asking price" },
                  { value: avgSoldPrice > 0 ? formatPriceFull(avgSoldPrice) : "\u2014", label: "Avg sold price" },
                  { value: String(allListings.length), label: "Total listings" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-[14px_16px]">
                    <p className="text-[20px] font-extrabold text-[#f8f9fb]">{s.value}</p>
                    <p className="text-[10px] text-[rgba(248,249,251,0.5)] mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Price by type */}
        {byType.length > 0 && (
          <section className="bg-[#fbbf24] px-5 sm:px-11 py-5">
            <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
              {byType.map((t) => (
                <div key={t.type} className="text-center">
                  <p className="text-[20px] font-extrabold text-[#07111f]">{formatPriceFull(t.avgPrice)}</p>
                  <p className="text-[10px] text-[#78350f] font-semibold mt-0.5 capitalize">
                    {t.type} ({t.count} active)
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Listings */}
        <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
              Homes for sale near {school.name}
            </h2>
            <SchoolListings listings={serializedListings} schoolName={school.name} />
          </div>
        </section>

        {/* Nearby streets */}
        {streetDetails.length > 0 && (
          <section className="bg-white px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
                Streets near {school.name}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {streetDetails.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/streets/${s.slug}`}
                    className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow"
                  >
                    <p className="text-[14px] font-bold text-[#07111f]">{s.name}</p>
                    <p className="text-[16px] font-extrabold text-[#07111f] mt-1">
                      {formatPriceFull(s.avgPrice)}
                    </p>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">
                      {s.count} active listings
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Other schools in the area */}
        {nearbySchools.length > 0 && (
          <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
                Other schools in {school.neighbourhood}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nearbySchools.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/schools/${s.slug}`}
                    className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[14px] font-bold text-[#07111f]">{s.name}</p>
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          s.board === "public"
                            ? "bg-[#dbeafe] text-[#1e40af]"
                            : "bg-[#fef3c7] text-[#92400e]"
                        }`}
                      >
                        {s.board === "public" ? "PUB" : "CATH"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8]">{s.grades} &middot; {s.boardName}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="bg-white px-5 sm:px-11 py-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-[#e2e8f0] rounded-xl p-5">
                  <h3 className="text-[14px] font-bold text-[#07111f] mb-2">{faq.question}</h3>
                  <p className="text-[13px] text-[#64748b] leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#f8f9fb]">
              Looking for a home near {school.name}?
            </h2>
            <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3 mb-8">
              Aamir knows every street in {school.neighbourhood}. Let him help you find the perfect family home.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="tel:+16478399090"
                className="bg-[#f59e0b] text-[#07111f] text-[14px] font-bold px-8 py-3.5 rounded-xl hover:bg-[#fbbf24] transition-colors"
              >
                Call Aamir
              </a>
              <Link
                href="/book"
                className="bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] text-[14px] font-bold px-8 py-3.5 rounded-xl hover:bg-[#1e3a5f] transition-colors"
              >
                Book a showing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
