import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { formatPriceFull } from "@/lib/format";
import { getStreetPageData } from "@/lib/street-data";
import { getOrGenerateStreetContent } from "@/lib/street-content";
import { prisma } from "@/lib/prisma";
import SchemaScript from "@/components/SchemaScript";
import { generateLocalBusinessSchema, generateBreadcrumbSchema } from "@/lib/schema";
import StreetClientSections from "@/components/street/StreetClientSections";
import StreetSoldBlock from "@/components/street/StreetSoldBlock";

interface Props { params: { slug: string }; searchParams?: { soldView?: string } }

const VIP_THRESHOLD = 5;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStreetPageData(params.slug);
  if (!data) return { title: "Street Not Found" };
  const isVip = data.activeCount >= VIP_THRESHOLD;
  return {
    title: isVip
      ? `${data.streetName} Milton — VIP Hub | ${data.activeCount} Active Listings, Prices & Market Data | Miltonly.com`
      : `${data.streetName} Milton — Homes For Sale, Sold Prices & Street Intelligence | Miltonly.com`,
    description: `See what homes are selling for on ${data.streetName} in Milton Ontario. ${data.activeCount} active listings, avg price ${formatPriceFull(data.avgListPrice || data.avgSoldPrice)}. Updated daily.`,
    alternates: { canonical: `https://miltonly.com/streets/${params.slug}` },
    openGraph: {
      title: `${data.streetName} Milton Real Estate — ${isVip ? "VIP Hub — " : ""}Live Data`,
      description: `${data.activeCount} homes for sale on ${data.streetName}, Milton. Avg ${formatPriceFull(data.avgListPrice || data.avgSoldPrice)}. Live TREB data.`,
    },
  };
}

export default async function StreetPage({ params, searchParams }: Props) {
  const data = await getStreetPageData(params.slug);
  if (!data) notFound();
  const soldView: "sales" | "rentals" = searchParams?.soldView === "rentals" ? "rentals" : "sales";

  const isVipHub = data.activeCount >= VIP_THRESHOLD;

  const content = await getOrGenerateStreetContent(params.slug, {
    streetName: data.streetName,
    avgSoldPrice: data.avgSoldPrice,
    avgListPrice: data.avgListPrice,
    avgDOM: data.avgDOM,
    soldVsAskPct: data.soldVsAskPct,
    totalSold12mo: data.totalSold12mo,
    activeCount: data.activeCount,
    neighbourhoods: data.neighbourhoods,
    byType: data.byType,
  });

  // Use pipeline-generated FAQs if available, otherwise build from data
  const pipelineContent = await prisma.streetContent.findUnique({
    where: { streetSlug: params.slug },
    select: { faqJson: true, vipFaqJson: true, vipDescription: true, isVipHub: true, status: true, publishedAt: true },
  });

  let faqs: { question: string; answer: string }[];
  if (pipelineContent?.faqJson && pipelineContent.status === "published") {
    const parsed = JSON.parse(pipelineContent.faqJson);
    faqs = parsed.map((f: { q: string; a: string }) => ({ question: f.q, answer: f.a }));
  } else {
    faqs = [
      { question: `What is the average home price on ${data.streetName} in Milton?`, answer: `The average price on ${data.streetName} in Milton is ${formatPriceFull(data.avgListPrice || data.avgSoldPrice)}, based on ${data.allListings.length} listings. ${Object.entries(data.byType).map(([t, d]) => `${t.charAt(0).toUpperCase() + t.slice(1)} homes average ${formatPriceFull(d.avgPrice)}`).join(". ")}.` },
      { question: `How many homes are for sale on ${data.streetName} Milton?`, answer: `There are currently ${data.activeCount} active listings on ${data.streetName} in Milton. Property types include ${Object.keys(data.byType).join(", ")}.` },
      { question: `What types of homes are on ${data.streetName} in Milton?`, answer: `${data.streetName} has ${Object.entries(data.byType).map(([t, d]) => `${d.count} ${t} properties`).join(", ")}. The most common type is ${Object.entries(data.byType).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || "varied"}.` },
      { question: `Is ${data.streetName} Milton a good investment?`, answer: `${data.streetName} in Milton has ${data.activeCount} active and ${data.totalSold12mo} sold listings. The average price is ${formatPriceFull(data.avgListPrice || data.avgSoldPrice)}. Milton's continued population growth and GO train connectivity support long-term value.` },
    ];
  }

  // VIP Hub enhanced FAQs
  let vipFaqs: { question: string; answer: string }[] = [];
  if (isVipHub && pipelineContent?.vipFaqJson) {
    const parsed = JSON.parse(pipelineContent.vipFaqJson);
    vipFaqs = parsed.map((f: { q: string; a: string }) => ({ question: f.q, answer: f.a }));
  } else if (isVipHub) {
    vipFaqs = [
      {
        question: `Why does ${data.streetName} have so many homes for sale?`,
        answer: `${data.streetName} currently has ${data.activeCount} active listings, making it one of Milton's most active streets. This volume reflects strong turnover and gives buyers multiple options across price points and home types.`,
      },
      {
        question: `What's the best strategy for buying on ${data.streetName} right now?`,
        answer: `With ${data.activeCount} active listings, buyers have leverage on ${data.streetName}. The average list price is ${formatPriceFull(data.avgListPrice)} with homes selling at ${data.soldVsAskPct}% of asking. Properties sit for ${data.avgDOM} days on average, giving room for negotiation.`,
      },
      {
        question: `Is ${data.streetName} a buyer's or seller's market?`,
        answer: `With ${data.activeCount} active listings and homes selling at ${data.soldVsAskPct}% of asking, ${data.streetName} ${data.soldVsAskPct >= 100 ? "leans toward sellers — but high inventory gives buyers options" : "favours buyers — properties are selling below asking with good inventory levels"}.`,
      },
    ];
  }

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: "https://miltonly.com" },
      { name: "Streets", url: "https://miltonly.com/streets" },
      { name: `${data.streetName}, Milton`, url: `https://miltonly.com/streets/${params.slug}` },
    ]),
    generateLocalBusinessSchema(),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [...faqs, ...vipFaqs].map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${data.streetName} Milton Real Estate Guide — Prices, Schools & Market Data`,
      description: `${data.totalSold12mo} homes sold on ${data.streetName} in the last 12 months. Average price ${formatPriceFull(data.avgSoldPrice)}.`,
      url: `https://miltonly.com/streets/${params.slug}`,
      datePublished: pipelineContent?.publishedAt?.toISOString() || new Date().toISOString(),
      dateModified: new Date().toISOString(),
      author: { "@type": "Person", name: "Miltonly Real Estate Team", url: "https://miltonly.com/about" },
      publisher: { "@type": "Organization", name: "Miltonly", url: "https://miltonly.com", logo: { "@type": "ImageObject", url: "https://miltonly.com/logo.png" } },
      mainEntityOfPage: { "@type": "WebPage", "@id": `https://miltonly.com/streets/${params.slug}` },
    },
  ];

  // Serialize data for client components
  const serialized = JSON.parse(JSON.stringify(data));

  return (
    <>
      <SchemaScript schemas={schemas} />
      <div className="min-h-screen">
        {/* SECTION 2 — Breadcrumb */}
        <div className="bg-white border-b border-[#f1f5f9] px-5 sm:px-11 py-3">
          <div className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
            <Link href="/" className="hover:text-[#07111f]">Home</Link>
            <span>&rsaquo;</span>
            <Link href="/streets" className="hover:text-[#07111f]">Streets</Link>
            <span>&rsaquo;</span>
            <span className="text-[#475569] font-medium">{data.streetName}, Milton</span>
          </div>
        </div>

        {/* VIP Hub Banner */}
        {isVipHub && (
          <section className="bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#f59e0b] px-5 sm:px-11 py-3">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-3">
              <span className="text-[13px] font-extrabold text-[#07111f] tracking-wide">
                VIP HUB STREET
              </span>
              <span className="text-[11px] font-bold text-[#78350f] bg-[rgba(7,17,31,0.1)] px-2 py-0.5 rounded-full">
                {data.activeCount} active listings
              </span>
              <span className="text-[11px] text-[#78350f]">
                One of Milton&apos;s most active streets right now
              </span>
            </div>
          </section>
        )}

        {/* SECTION 3 — Hero */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-10 sm:py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em]">
                    {data.streetName} &middot; Milton &middot; Ontario
                  </p>
                  {isVipHub && (
                    <span className="text-[9px] font-extrabold text-[#07111f] bg-[#f59e0b] px-2 py-0.5 rounded-full uppercase tracking-wider">
                      VIP Hub
                    </span>
                  )}
                </div>
                <h1 className="text-[32px] sm:text-[40px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
                  {data.streetName}, Milton
                </h1>
                <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-3 max-w-lg leading-relaxed">
                  {data.allListings.length} listings &middot; Average {formatPriceFull(data.avgListPrice || data.avgSoldPrice)} &middot; {data.activeCount} active right now
                </p>
                <span className="inline-block mt-4 text-[10px] font-bold text-[#f59e0b] bg-[rgba(245,158,11,0.15)] px-3 py-1 rounded-full">
                  Data updated {data.lastUpdated}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0 lg:w-[340px]">
                {[
                  { value: formatPriceFull(data.avgListPrice || data.avgSoldPrice), label: "Avg price" },
                  { value: String(data.activeCount), label: "Active listings" },
                  { value: data.avgDOM ? data.avgDOM + " days" : "\u2014", label: "Avg days on market" },
                  { value: data.soldVsAskPct + "%", label: "Sold vs asking" },
                ].map((s) => (
                  <div key={s.label} className={`${isVipHub ? "bg-gradient-to-br from-[#0c1e35] to-[#1a2e4a]" : "bg-[#0c1e35]"} border border-[#1e3a5f] rounded-xl p-[14px_16px]`}>
                    <p className="text-[20px] font-extrabold text-[#f8f9fb]">{s.value}</p>
                    <p className="text-[10px] text-[rgba(248,249,251,0.5)] mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 — Market snapshot bar */}
        <section className="bg-[#fbbf24] px-5 sm:px-11 py-5">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { value: formatPriceFull(data.avgListPrice), label: "Avg list price" },
              { value: formatPriceFull(data.avgSoldPrice), label: "Avg sold price" },
              { value: formatPriceFull(data.medianPrice), label: "Median price" },
              { value: String(data.totalSold12mo), label: "Sold this year" },
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

        {/* VIP Hub — Market Intelligence Section */}
        {isVipHub && (
          <section className="bg-[#07111f] px-5 sm:px-11 py-10 border-t border-[#1e3a5f]">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[9px] font-extrabold text-[#07111f] bg-[#f59e0b] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  VIP Hub Intel
                </span>
                <h2 className="text-[20px] font-extrabold text-[#f8f9fb]">Why {data.streetName} is a hot street</h2>
              </div>
              {pipelineContent?.vipDescription ? (
                <div className="text-[14px] text-[rgba(248,249,251,0.7)] leading-relaxed max-w-3xl whitespace-pre-line">
                  {pipelineContent.vipDescription}
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-5">
                    <p className="text-[28px] font-extrabold text-[#f59e0b]">{data.activeCount}</p>
                    <p className="text-[12px] text-[rgba(248,249,251,0.6)] mt-1 font-medium">Active listings right now</p>
                    <p className="text-[11px] text-[rgba(248,249,251,0.4)] mt-2">
                      {data.activeCount >= 10
                        ? "Exceptional inventory — one of Milton's busiest streets"
                        : "High inventory — more options than most Milton streets"}
                    </p>
                  </div>
                  <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-5">
                    <p className="text-[28px] font-extrabold text-[#f59e0b]">{data.soldVsAskPct}%</p>
                    <p className="text-[12px] text-[rgba(248,249,251,0.6)] mt-1 font-medium">Selling vs asking price</p>
                    <p className="text-[11px] text-[rgba(248,249,251,0.4)] mt-2">
                      {data.soldVsAskPct >= 100
                        ? "Strong demand — homes selling at or above asking"
                        : "Room to negotiate — homes selling below asking"}
                    </p>
                  </div>
                  <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-5">
                    <p className="text-[28px] font-extrabold text-[#f59e0b]">{data.avgDOM || "\u2014"}</p>
                    <p className="text-[12px] text-[rgba(248,249,251,0.6)] mt-1 font-medium">Avg days on market</p>
                    <p className="text-[11px] text-[rgba(248,249,251,0.4)] mt-2">
                      {data.avgDOM <= 14
                        ? "Fast-moving — homes selling quickly"
                        : data.avgDOM <= 30
                        ? "Moderate pace — typical for Milton"
                        : "Slower pace — take your time to decide"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECTION 5 — Price by type */}
        <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">What type of home are you looking for?</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(["detached", "semi", "townhouse", "condo"] as const).map((type) => {
                const d = data.byType[type];
                return (
                  <div key={type} className="bg-white rounded-xl border border-[#e2e8f0] p-5">
                    <p className="text-[14px] font-bold text-[#07111f] capitalize mb-3">{type}</p>
                    {d ? (
                      <>
                        <p className="text-[22px] font-extrabold text-[#07111f]">{formatPriceFull(d.avgPrice)}</p>
                        <p className="text-[11px] text-[#94a3b8] mt-1">{d.count} listings &middot; {d.activeCount} active</p>
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

        {/* Sold / Rentals intelligence section (VOW-gated) */}
        <StreetSoldBlock
          streetSlug={params.slug}
          streetName={data.streetName}
          currentPath={`/streets/${params.slug}`}
          view={soldView}
        />

        {/* Client sections: listings, sold history, charts, seller form, FAQ, etc. */}
        <StreetClientSections
          data={serialized}
          description={content.description}
          faqs={[...faqs, ...vipFaqs]}
        />

        {/* SECTION 15 — Nearby streets */}
        {data.nearbyStreets.length > 0 && (
          <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">Explore streets near {data.streetName}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.nearbyStreets.map((s) => (
                  <Link key={s.slug} href={`/streets/${s.slug}`} className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow">
                    <p className="text-[14px] font-bold text-[#07111f]">{s.name}</p>
                    <p className="text-[16px] font-extrabold text-[#07111f] mt-1">{formatPriceFull(s.avgPrice)}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">{s.count} listings</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* VIP Hub — CTA Section */}
        {isVipHub && (
          <section className="bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#f59e0b] px-5 sm:px-11 py-10">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-[10px] font-extrabold text-[#78350f] uppercase tracking-wider mb-2">VIP Hub Street</p>
              <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#07111f] mb-3">
                {data.activeCount} homes for sale on {data.streetName} right now
              </h2>
              <p className="text-[14px] text-[#78350f] mb-6 max-w-lg mx-auto">
                This is one of Milton&apos;s most active streets. Let Aamir help you find the right one &mdash; or sell yours while demand is high.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="tel:+16478399090"
                  className="bg-[#07111f] text-[#f59e0b] text-[14px] font-bold px-8 py-3.5 rounded-xl hover:bg-[#0c1e35] transition-colors"
                >
                  Call Aamir now
                </a>
                <Link
                  href="/book"
                  className="bg-white text-[#07111f] text-[14px] font-bold px-8 py-3.5 rounded-xl border-2 border-[#07111f] hover:bg-[#f8f9fb] transition-colors"
                >
                  Book a showing
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 16 — Final CTA */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#f8f9fb]">
              Ready to make your move on {data.streetName}?
            </h2>
            <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3 mb-8">
              Whether you&apos;re buying, selling or watching the market &mdash; we&apos;ve got you covered.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-2">Find your home</p>
                <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-4">Get instant alerts for new listings</p>
                <Link href="/listings" className="block w-full bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2.5 text-center">Set listing alert</Link>
              </div>
              <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-2">Get your home value</p>
                <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-4">Based on real {data.streetName} sales</p>
                <Link href="/sell" className="block w-full bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2.5 text-center">Get my estimate</Link>
              </div>
              <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6">
                <p className="text-[14px] font-bold text-[#f8f9fb] mb-2">Stay informed</p>
                <p className="text-[11px] text-[rgba(248,249,251,0.5)] mb-4">Monthly price updates for this street</p>
                <Link href="/signin" className="block w-full bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2.5 text-center">Subscribe free</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
