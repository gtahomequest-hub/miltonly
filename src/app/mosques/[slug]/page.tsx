import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getMosqueBySlug, getMosquesByNeighbourhood } from "@/lib/mosques";
import { prisma } from "@/lib/prisma";
import { formatPriceFull } from "@/lib/format";
import SchemaScript from "@/components/SchemaScript";
import {
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import MosqueListings from "./MosqueListings";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mosque = getMosqueBySlug(params.slug);
  if (!mosque) return { title: "Mosque Not Found" };

  return {
    title: `Homes Near ${mosque.name} Milton — Listings & Prices`,
    description: `Find homes for sale near ${mosque.name} in Milton Ontario. ${mosque.address}. Live TREB listings, prices, and neighbourhood data. ${mosque.affiliation}.`,
    alternates: { canonical: `https://miltonly.com/mosques/${params.slug}` },
    keywords: [
      `homes near ${mosque.name}`,
      `${mosque.name} Milton`,
      `houses for sale near ${mosque.name}`,
      `Milton mosque real estate`,
      `${mosque.neighbourhood} Milton homes`,
      `Muslim community Milton`,
    ],
    openGraph: {
      title: `Homes Near ${mosque.name} — Milton, Ontario`,
      description: `Find homes for sale near ${mosque.name}. ${mosque.address}. Live listings updated daily.`,
    },
  };
}

export default async function MosqueDetailPage({ params }: Props) {
  const mosque = getMosqueBySlug(params.slug);
  if (!mosque) notFound();

  // Fetch nearby active listings
  const listings = await prisma.listing.findMany({
    where: {
      status: "active",
      permAdvertise: true,
      city: "Milton",
      neighbourhood: { contains: mosque.neighbourhood, mode: "insensitive" },
    },
    orderBy: { price: "asc" },
    take: 30,
  });

  // Market stats — active listings only. DB1 sold fields are no longer
  // populated (Phase 2.6 migration 2026-04-17); avg sold is now surfaced
  // via the gated DB2 pipeline on street/neighbourhood pages, not here.
  const allListings = await prisma.listing.findMany({
    where: {
      permAdvertise: true,
      city: "Milton",
      neighbourhood: { contains: mosque.neighbourhood, mode: "insensitive" },
    },
    select: { price: true, status: true, propertyType: true },
  });

  const active = allListings.filter((l) => l.status === "active");
  const avgPrice =
    active.length > 0
      ? Math.round(active.reduce((s, l) => s + l.price, 0) / active.length)
      : 0;

  // By type
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

  // Nearby streets
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
      return {
        slug: s.streetSlug,
        name: sample?.streetName || s.streetSlug,
        count: s._count,
        avgPrice: Math.round(s._avg.price || 0),
      };
    })
  );

  // Other mosques in same neighbourhood
  const nearbyMosques = getMosquesByNeighbourhood(mosque.neighbourhood).filter(
    (m) => m.slug !== mosque.slug
  );

  const typeLabel = mosque.type === "masjid" ? "masjid" : mosque.type === "musalla" ? "musalla" : "community centre";

  const faqs = [
    {
      question: `What homes are for sale near ${mosque.name}?`,
      answer: `There are currently ${active.length} active listings near ${mosque.name} in ${mosque.neighbourhood}, Milton.${avgPrice > 0 ? ` The average asking price is ${formatPriceFull(avgPrice)}.` : ""} ${byType.length > 0 ? `Property types include ${byType.map((t) => `${t.type} (${t.count})`).join(", ")}.` : ""}`,
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
      question: `Is ${mosque.neighbourhood} a good area for Muslim families in Milton?`,
      answer: `${mosque.neighbourhood} in Milton is home to ${getMosquesByNeighbourhood(mosque.neighbourhood).length} mosque${getMosquesByNeighbourhood(mosque.neighbourhood).length > 1 ? "s and Islamic centres" : ""}, including ${mosque.name}. With ${active.length} homes currently for sale, families have options across property types. Milton's GO train connectivity and growing Muslim community make it a popular choice.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: "https://miltonly.com" },
      { name: "Mosques", url: "https://miltonly.com/mosques" },
      { name: mosque.name, url: `https://miltonly.com/mosques/${params.slug}` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(faqs),
    {
      "@context": "https://schema.org",
      "@type": "Mosque",
      name: mosque.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: mosque.address.replace(", Milton", ""),
        addressLocality: "Milton",
        addressRegion: "Ontario",
        addressCountry: "CA",
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
            <Link href="/mosques" className="hover:text-[#07111f]">Mosques</Link>
            <span>&rsaquo;</span>
            <span className="text-[#475569] font-medium">{mosque.name}</span>
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
                      mosque.type === "masjid"
                        ? "bg-[#dbeafe] text-[#1e40af]"
                        : mosque.type === "musalla"
                        ? "bg-[#fef3c7] text-[#92400e]"
                        : "bg-[#f0fdf4] text-[#15803d]"
                    }`}
                  >
                    {typeLabel}
                  </span>
                  <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em]">
                    {mosque.neighbourhood} &middot; Milton
                  </p>
                </div>
                <h1 className="text-[28px] sm:text-[36px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
                  Homes Near {mosque.name}
                </h1>
                <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-3 max-w-lg leading-relaxed">
                  {mosque.address} &middot; {mosque.affiliation}
                </p>
                {mosque.notes && (
                  <p className="text-[13px] text-[rgba(248,249,251,0.4)] mt-2 max-w-lg leading-relaxed">
                    {mosque.notes}
                  </p>
                )}
                {mosque.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {mosque.services.map((s) => (
                      <span key={s} className="text-[10px] font-semibold text-[#f59e0b] bg-[rgba(245,158,11,0.15)] px-2 py-0.5 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0 lg:w-[340px]">
                {[
                  { value: String(active.length), label: "Active listings nearby" },
                  { value: avgPrice > 0 ? formatPriceFull(avgPrice) : "\u2014", label: "Avg asking price" },
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
              Homes for sale near {mosque.name}
            </h2>
            <MosqueListings listings={serializedListings} mosqueName={mosque.name} />
          </div>
        </section>

        {/* Nearby streets */}
        {streetDetails.length > 0 && (
          <section className="bg-white px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
                Streets near {mosque.name}
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

        {/* Other mosques nearby */}
        {nearbyMosques.length > 0 && (
          <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
                Other mosques in {mosque.neighbourhood}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nearbyMosques.map((m) => (
                  <Link
                    key={m.slug}
                    href={`/mosques/${m.slug}`}
                    className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[14px] font-bold text-[#07111f]">{m.name}</p>
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          m.type === "masjid"
                            ? "bg-[#dbeafe] text-[#1e40af]"
                            : m.type === "musalla"
                            ? "bg-[#fef3c7] text-[#92400e]"
                            : "bg-[#f0fdf4] text-[#15803d]"
                        }`}
                      >
                        {m.type === "masjid" ? "MASJID" : m.type === "musalla" ? "MUSALLA" : "CENTRE"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8]">{m.address}</p>
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
              Looking for a home near {mosque.name}?
            </h2>
            <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3 mb-8">
              Aamir knows Milton inside out. Let him help you find the right home for your family.
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
