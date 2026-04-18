import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPriceFull } from "@/lib/format";
import SchemaScript from "@/components/SchemaScript";
import {
  generateLocalBusinessSchema,
  generateBreadcrumbSchema,
  generateNeighbourhoodSchema,
} from "@/lib/schema";
import FooterSection from "@/components/sections/FooterSection";
import NeighbourhoodSoldBlock from "@/components/street/NeighbourhoodSoldBlock";

interface Props {
  params: { slug: string };
}

function cleanHoodName(raw: string): string {
  return raw.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function getNeighbourhoodData(slug: string) {
  // Find the raw neighbourhood name that matches this slug
  const allHoods = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    _count: true,
    where: { city: "Milton", permAdvertise: true },
  });

  const match = allHoods.find(
    (h) => toSlug(cleanHoodName(h.neighbourhood)) === slug
  );
  if (!match) return null;

  const rawName = match.neighbourhood;
  const name = cleanHoodName(rawName);
  const where = { neighbourhood: rawName, permAdvertise: true as const };

  // Sold listings are no longer fetched here — sold data surfaces only
  // through the gated NeighbourhoodSoldBlock fed from DB2 with VowGate.
  const [allListings, activeListings, rentedListings] =
    await Promise.all([
      prisma.listing.findMany({ where, orderBy: { listedAt: "desc" } }),
      prisma.listing.findMany({
        where: { ...where, status: "active" },
        orderBy: { listedAt: "desc" },
        take: 12,
      }),
      prisma.listing.count({ where: { ...where, status: "rented" } }),
    ]);

  if (allListings.length === 0) return null;

  // Active-listing aggregates only (Phase 2.6 — DB1 sold-derived fields
  // removed from the public render tree; sold data surfaces only through
  // the gated NeighbourhoodSoldBlock fed from DB2 with VowGate + k=10).
  const active = allListings.filter((l) => l.status === "active");
  const sold = allListings.filter((l) => l.status === "sold");
  const activePrices = active.map((l) => l.price).sort((a, b) => a - b);
  const avgPrice = activePrices.length > 0
    ? Math.round(activePrices.reduce((s, p) => s + p, 0) / activePrices.length)
    : 0;
  const medianPrice = activePrices.length > 0
    ? activePrices[Math.floor(activePrices.length / 2)]
    : 0;
  const avgListPrice = avgPrice; // alias — both are active-only avg list price

  // DOM — active listings only
  const activeWithDOM = active.filter(
    (l) => l.daysOnMarket && l.daysOnMarket > 0
  );
  const avgDOM = activeWithDOM.length > 0
    ? Math.round(
        activeWithDOM.reduce((s, l) => s + (l.daysOnMarket || 0), 0) /
          activeWithDOM.length
      )
    : 0;

  // By type — active listings only
  const types = ["detached", "semi", "townhouse", "condo", "other"];
  const byType: Record<
    string,
    { count: number; avgPrice: number; activeCount: number }
  > = {};
  for (const t of types) {
    const activeOfType = active.filter((l) => l.propertyType === t);
    if (activeOfType.length > 0) {
      byType[t] = {
        count: activeOfType.length,
        avgPrice: Math.round(
          activeOfType.reduce((s, l) => s + l.price, 0) / activeOfType.length
        ),
        activeCount: activeOfType.length,
      };
    }
  }

  // Top streets
  const streetGroups = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    _avg: { price: true },
    where: { ...where },
    orderBy: { _count: { streetSlug: "desc" } },
    take: 12,
  });

  const topStreets = await Promise.all(
    streetGroups.map(async (s) => {
      const sample = await prisma.listing.findFirst({
        where: { streetSlug: s.streetSlug, streetName: { not: null } },
        select: { streetName: true },
      });
      const streetActive = await prisma.listing.count({
        where: {
          streetSlug: s.streetSlug,
          status: "active",
          permAdvertise: true,
        },
      });
      return {
        slug: s.streetSlug,
        name: sample?.streetName || s.streetSlug,
        count: s._count,
        activeCount: streetActive,
        avgPrice: Math.round(s._avg.price || 0),
      };
    })
  );

  return {
    name,
    slug,
    rawName,
    totalListings: allListings.length,
    activeCount: active.length,
    soldCount: sold.length,          // safe count only
    rentedCount: rentedListings,
    avgPrice,                        // active-only avg list price
    avgListPrice,                    // alias for avgPrice
    medianPrice,                     // active-only median
    avgDOM,                          // active-only
    byType,                          // active-only
    topStreets,
    activeListings: activeListings.map((l) =>
      JSON.parse(JSON.stringify(l))
    ),
    // soldListings removed — sold records reach the render tree only via
    // the gated NeighbourhoodSoldBlock below.
    lastUpdated: new Date().toISOString().split("T")[0],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getNeighbourhoodData(params.slug);
  if (!data) return { title: "Neighbourhood Not Found" };
  return {
    title: `${data.name} Milton — Homes For Sale, Prices & Neighbourhood Guide`,
    description: `Explore ${data.name} in Milton Ontario. ${data.activeCount} active listings, avg price ${formatPriceFull(data.avgPrice)}. Streets, schools, market data. Updated daily.`,
    alternates: {
      canonical: `https://miltonly.com/neighbourhoods/${params.slug}`,
    },
    openGraph: {
      title: `${data.name} Milton Real Estate — Live Data`,
      description: `${data.activeCount} homes for sale in ${data.name}, Milton. Avg ${formatPriceFull(data.avgPrice)}.`,
    },
  };
}

export default async function NeighbourhoodPage({ params }: Props) {
  const data = await getNeighbourhoodData(params.slug);
  if (!data) notFound();

  const faqs = [
    {
      question: `What is the average home price in ${data.name}, Milton?`,
      answer: `The average home price in ${data.name}, Milton is ${formatPriceFull(data.avgPrice)} based on ${data.totalListings} listings. ${Object.entries(data.byType).map(([t, d]) => `${t.charAt(0).toUpperCase() + t.slice(1)} homes average ${formatPriceFull(d.avgPrice)}`).join(". ")}.`,
    },
    {
      question: `How many homes are for sale in ${data.name} Milton?`,
      answer: `There are currently ${data.activeCount} active listings in ${data.name}, Milton. Property types include ${Object.keys(data.byType).join(", ")}.`,
    },
    {
      question: `What streets are in ${data.name}, Milton?`,
      answer: `Popular streets in ${data.name} include ${data.topStreets.slice(0, 5).map((s) => s.name).join(", ")}. These streets have the most listings and transaction activity in the neighbourhood.`,
    },
    {
      question: `How fast do homes sell in ${data.name} Milton?`,
      answer: `Active listings in ${data.name}, Milton average ${data.avgDOM || "—"} days on market. Register for full MLS® access to see detailed market data, including historical transaction records for this neighbourhood.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: "https://miltonly.com" },
      {
        name: "Neighbourhoods",
        url: "https://miltonly.com/neighbourhoods",
      },
      {
        name: `${data.name}, Milton`,
        url: `https://miltonly.com/neighbourhoods/${params.slug}`,
      },
    ]),
    generateLocalBusinessSchema(),
    generateNeighbourhoodSchema({
      name: data.name,
      slug: data.slug,
      description: `Real estate data for ${data.name} neighbourhood in Milton Ontario. ${data.activeCount} active listings, average price ${formatPriceFull(data.avgPrice)}.`,
    }),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <div className="min-h-screen">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-[#f1f5f9] px-5 sm:px-11 py-3">
          <div className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
            <Link href="/" className="hover:text-[#07111f]">Home</Link>
            <span>&rsaquo;</span>
            <Link href="/neighbourhoods" className="hover:text-[#07111f]">Neighbourhoods</Link>
            <span>&rsaquo;</span>
            <span className="text-[#475569] font-medium">{data.name}, Milton</span>
          </div>
        </div>

        {/* Hero */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-10 sm:py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
              <div>
                <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-3">
                  {data.name} &middot; Milton &middot; Ontario
                </p>
                <h1 className="text-[32px] sm:text-[40px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
                  {data.name}, Milton
                </h1>
                <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-3 max-w-lg leading-relaxed">
                  {data.totalListings} listings &middot; Average {formatPriceFull(data.avgPrice)} &middot; {data.activeCount} active right now
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold text-[#f59e0b] bg-[rgba(245,158,11,0.15)] px-3 py-1 rounded-full">
                  Data updated {data.lastUpdated}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0 lg:w-[340px]">
                {[
                  { value: formatPriceFull(data.avgPrice), label: "Avg list price" },
                  { value: String(data.activeCount), label: "Active listings" },
                  { value: data.avgDOM ? data.avgDOM + " days" : "—", label: "Avg days on market" },
                  { value: String(data.soldCount), label: "Sold this year" },
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

        {/* Market snapshot bar — active-listing aggregates only.
           Sold-price intel surfaces in the gated NeighbourhoodSoldBlock below. */}
        <section className="bg-[#fbbf24] px-5 sm:px-11 py-5">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { value: formatPriceFull(data.avgListPrice), label: "Avg list price" },
              { value: formatPriceFull(data.medianPrice), label: "Median list price" },
              { value: String(data.soldCount), label: "Sold this year" },
              { value: String(data.activeCount), label: "Active now" },
              { value: String(data.rentedCount), label: "Rented" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[18px] sm:text-[22px] font-extrabold text-[#07111f]">{s.value}</p>
                <p className="text-[10px] text-[#78350f] font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Price by type */}
        <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
              Property types in {data.name}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(["detached", "semi", "townhouse", "condo"] as const).map((type) => {
                const d = data.byType[type];
                return (
                  <div key={type} className="bg-white rounded-xl border border-[#e2e8f0] p-5">
                    <p className="text-[14px] font-bold text-[#07111f] capitalize mb-3">{type}</p>
                    {d ? (
                      <>
                        <p className="text-[22px] font-extrabold text-[#07111f]">
                          {formatPriceFull(d.avgPrice)}
                        </p>
                        <p className="text-[11px] text-[#94a3b8] mt-1">
                          {d.count} listings &middot; {d.activeCount} active
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] text-[#94a3b8]">No recent data</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Top streets */}
        {data.topStreets.length > 0 && (
          <section className="bg-white px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
                Streets in {data.name}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.topStreets.map((s) => (
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
                      {s.count} listings &middot; {s.activeCount} active
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Active listings preview */}
        {data.activeListings.length > 0 && (
          <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-[18px] font-extrabold text-[#07111f]">
                  Homes for sale in {data.name}
                </h2>
                <Link
                  href={`/listings?neighbourhood=${encodeURIComponent(data.name)}`}
                  className="text-[12px] text-[#f59e0b] font-semibold hover:underline"
                >
                  View all {data.activeCount}
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.activeListings.slice(0, 6).map((l: Record<string, unknown>) => (
                  <Link
                    key={l.mlsNumber as string}
                    href={`/listings/${l.mlsNumber}`}
                    className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all"
                  >
                    <div className="aspect-[3/2] bg-[#f1f5f9]">
                      {(l.photos as string[])?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(l.photos as string[])[0]}
                          alt={l.address as string}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#cbd5e1] text-[32px]">
                          🏠
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[18px] font-extrabold text-[#07111f]">
                        {formatPriceFull(l.price as number)}
                      </p>
                      <p className="text-[12px] text-[#475569] mt-0.5">
                        {l.bedrooms as number} bd &middot; {l.bathrooms as number} ba
                        {l.sqft ? ` · ${(l.sqft as number).toLocaleString()} sqft` : ""}
                      </p>
                      <p className="text-[11px] text-[#94a3b8] mt-1 truncate">
                        {l.address as string}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="bg-white px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
              Frequently asked about {data.name}
            </h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] overflow-hidden group"
                >
                  <summary className="px-5 py-4 text-[14px] font-bold text-[#07111f] cursor-pointer list-none flex items-center justify-between">
                    {faq.question}
                    <span className="text-[#94a3b8] group-open:rotate-180 transition-transform">
                      &#9662;
                    </span>
                  </summary>
                  <div className="px-5 pb-4 text-[13px] text-[#64748b] leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#f8f9fb]">
              Ready to explore {data.name}?
            </h2>
            <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3 mb-8">
              Whether you&apos;re buying, selling or watching the market — we&apos;ve got you covered.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-2">Find your home</p>
                <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-4">
                  Browse {data.activeCount} active listings
                </p>
                <Link
                  href={`/listings?neighbourhood=${encodeURIComponent(data.name)}`}
                  className="block w-full bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2.5 text-center"
                >
                  View listings
                </Link>
              </div>
              <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-2">Get your home value</p>
                <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-4">
                  Based on real {data.name} sales
                </p>
                <Link
                  href="/sell"
                  className="block w-full bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2.5 text-center"
                >
                  Get my estimate
                </Link>
              </div>
              <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-2">Talk to an expert</p>
                <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-4">
                  14 years of Milton experience
                </p>
                <a
                  href="tel:+16478399090"
                  className="block w-full bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2.5 text-center"
                >
                  Call Aamir
                </a>
              </div>
            </div>
          </div>
        </section>
        <NeighbourhoodSoldBlock
          neighbourhood={data.rawName}
          displayName={data.name}
          currentPath={`/neighbourhoods/${params.slug}`}
        />
      </div>
      <FooterSection />
    </>
  );
}
