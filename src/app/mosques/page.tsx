import { generateMetadata as genMeta } from "@/lib/seo";
import { mosques, getAllMosqueNeighbourhoods } from "@/lib/mosques";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import Link from "next/link";
import SchemaScript from "@/components/SchemaScript";
import {
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import MosquesGrid from "./MosquesGrid";
import MosqueAlertForm from "./MosqueAlertForm";

export const metadata = genMeta({
  title: `Mosques in ${config.CITY_NAME} — Homes Near Masjids`,
  description: `Find homes for sale near ${config.CITY_NAME} ${config.CITY_PROVINCE}'s mosques and Islamic centres. 7 locations with live TREB listings by neighbourhood. Updated daily.`,
  canonical: `${config.SITE_URL}/mosques`,
  keywords: [
    `mosques near ${config.CITY_NAME} ${config.CITY_PROVINCE}`,
    `homes near mosque ${config.CITY_NAME}`,
    `${config.CITY_NAME} masjid`,
    `${config.CITY_NAME} Islamic centre`,
    `Muslim community ${config.CITY_NAME} ${config.CITY_PROVINCE}`,
    "homes near Halton Islamic Centre",
    `${config.CITY_NAME} ${config.CITY_PROVINCE} Muslim`,
    `buy home near mosque ${config.CITY_NAME}`,
  ],
});

export default async function MosquesPage() {
  const neighbourhoods = getAllMosqueNeighbourhoods();
  const counts = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    where: { status: "active", permAdvertise: true, city: config.PRISMA_CITY_VALUE },
    _count: true,
  });

  const countMap: Record<string, number> = {};
  for (const c of counts) {
    for (const hood of neighbourhoods) {
      if (c.neighbourhood.toLowerCase().includes(hood.toLowerCase())) {
        countMap[hood] = (countMap[hood] || 0) + c._count;
      }
    }
  }

  const mosquesWithCounts = mosques.map((m) => ({
    ...m,
    activeListings: countMap[m.neighbourhood] || 0,
  }));

  const totalActive = Object.values(countMap).reduce((a, b) => a + b, 0);

  const masjidCount = mosques.filter((m) => m.type === "masjid").length;
  const musallaCount = mosques.filter((m) => m.type === "musalla").length;
  const centreCount = mosques.filter((m) => m.type === "centre").length;
  const withJumah = mosques.filter((m) => m.services.includes("Jumu'ah")).length;

  const hoodSlugs = neighbourhoods.map((n) => ({
    name: n,
    slug: n.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"),
    mosqueCount: mosques.filter((m) => m.neighbourhood === n).length,
  }));

  const faqs = [
    {
      question: `How many mosques are there in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME} has ${mosques.length} mosques and Islamic centres, including ${masjidCount} full masjid${masjidCount !== 1 ? "s" : ""}, ${centreCount} community centre${centreCount !== 1 ? "s" : ""}, and ${musallaCount} musalla${musallaCount !== 1 ? "s" : ""}. ${withJumah} locations offer Jumu\u2019ah prayers. The largest is the Halton Islamic Community Centre on Regional Rd 25, which offers daily prayers, an Islamic school, a Hifz program, and a food bank.`,
    },
    {
      question: `Where is the nearest mosque to ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME} has several mosques spread across the town. The Halton Islamic Community Centre at 4269 Regional Rd 25 is the largest, offering full masjid services. ICNA ${config.CITY_NAME} at 500 Laurier Ave and the ${config.CITY_NAME} Muslim Community Centre on Steeles Ave are centrally located. ${config.CITY_NAME} Musalla on Derry Rd serves the northwest area.`,
    },
    {
      question: `Which ${config.CITY_NAME} neighbourhood is best for Muslim families?`,
      answer: `${config.CITY_NAME}\u2019s mosques and Islamic centres are distributed across the town, so most neighbourhoods offer reasonable access. The core ${config.CITY_NAME} area has the highest concentration, with the Halton Islamic Community Centre, ICNA ${config.CITY_NAME}, and the ${config.CITY_NAME} Muslim Community Centre all within a short drive. There are currently ${totalActive > 0 ? totalActive : "many"} homes for sale across these neighbourhoods.`,
    },
    {
      question: `Are there homes for sale near mosques in ${config.CITY_NAME}?`,
      answer: `Yes. There are currently ${totalActive > 0 ? totalActive : "multiple"} active listings near ${config.CITY_NAME}\u2019s mosques and Islamic centres. Each mosque page on ${config.SITE_NAME} shows live nearby listings with prices, property types, and direct links to full details. You can also set up alerts to be notified when new homes list near your preferred location.`,
    },
    {
      question: `Does ${config.CITY_NAME} have an Islamic school?`,
      answer: `Yes. The Halton Islamic Community Centre at 4269 Regional Rd 25 operates an Islamic school and a Hifz program. It is run by the Muslim Association of ${config.CITY_NAME} and serves families across the Halton Region.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Mosques", url: `${config.SITE_URL}/mosques` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(faqs),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <div className="min-h-screen bg-[#f8f9fb]">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-[#f1f5f9] px-5 sm:px-11 py-3">
          <div className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
            <Link href="/" className="hover:text-[#07111f]">Home</Link>
            <span>&rsaquo;</span>
            <span className="text-[#475569] font-medium">Mosques</span>
          </div>
        </div>

        {/* Hero */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-10 sm:py-14">
          <div className="max-w-6xl mx-auto">
            <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-3">
              Community &amp; Real Estate
            </p>
            <h1 className="text-[28px] sm:text-[40px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
              Mosques in {config.CITY_NAME} &amp; Nearby Homes
            </h1>
            <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-4 max-w-2xl leading-relaxed">
              Find homes for sale near {config.CITY_NAME}&apos;s {mosques.length} mosques and Islamic centres.
              {totalActive > 0 && ` ${totalActive} active listings in surrounding neighbourhoods, updated daily from TREB.`}
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section className="bg-[#fbbf24] px-5 sm:px-11 py-5">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: String(mosques.length), label: "Mosques & centres" },
              { value: String(masjidCount), label: "Full masjids" },
              { value: String(withJumah), label: "With Jumu\u2019ah" },
              { value: totalActive > 0 ? String(totalActive) : "\u2014", label: "Homes for sale nearby" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[22px] font-extrabold text-[#07111f]">{s.value}</p>
                <p className="text-[10px] text-[#78350f] font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Grid */}
        <div className="px-5 sm:px-11 py-8">
          <MosquesGrid mosques={mosquesWithCounts} />
        </div>

        {/* Prose section — Muslim community */}
        <section className="bg-white px-5 sm:px-11 py-12 border-t border-[#e2e8f0]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-[20px] font-extrabold text-[#07111f] mb-6">
              {config.CITY_NAME}&apos;s growing Muslim community and why proximity matters
            </h2>
            <div className="text-[14px] text-[#374151] leading-[1.85] space-y-4">
              <p>
                {config.CITY_NAME}&apos;s Muslim community has grown substantially over the past decade, mirroring the town&apos;s broader population boom. What was once a small, tight-knit group gathering for Jumu&apos;ah in rented halls now numbers in the thousands, supported by seven mosques and Islamic centres spread across town. That growth has reshaped the local real estate landscape in meaningful ways, particularly for families who prioritize daily access to prayer, community programming, and Islamic education for their children.
              </p>
              <p>
                For many Muslim families, proximity to a mosque is not simply a matter of convenience. Daily prayers, Jumu&apos;ah on Fridays, Taraweeh during Ramadan, Eid celebrations, and weekend Islamic school all factor into where a family chooses to live. A home within a ten-minute drive of a full-service masjid can make the difference between attending regularly and missing out. The Halton Islamic Community Centre on Regional Rd 25 is the anchor institution here, offering not just daily salah but a full Islamic school, a Hifz program, and a community food bank. Families who rely on these services naturally gravitate toward the surrounding neighbourhoods.
              </p>
              <p>
                The presence of multiple organizations serving different traditions also matters. Minhaj-ul-Quran operates the {config.CITY_NAME} Muslim Community Centre with locations on Steeles Ave and Bronte St. ICNA {config.CITY_NAME} runs a centre on Laurier Ave. The Sayyidah Fatemah Islamic Centre, founded by the Islamic Supreme Council of Canada, serves another segment of the community. This diversity means families can find a congregation that fits their practice without leaving {config.CITY_NAME}, and each centre creates its own radius of demand in the housing market.
              </p>
              <p>
                From a real estate perspective, homes near active mosques tend to see steady demand from within the community, particularly during periods when national-level demand softens. Buyers looking near these locations should pay attention to commute patterns as well. {config.CITY_NAME}&apos;s GO station provides direct access to Union Station, which means a family can live near their mosque and still commute to Toronto for work. That combination of community infrastructure and transit access is difficult to replicate in other Halton municipalities, and it continues to draw Muslim families to {config.CITY_NAME} specifically.
              </p>
            </div>
          </div>
        </section>

        {/* Neighbourhood internal links */}
        <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
              Explore {config.CITY_NAME} neighbourhoods with mosques
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {hoodSlugs.map((h) => (
                <Link
                  key={h.slug}
                  href={`/neighbourhoods/${h.slug}`}
                  className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow"
                >
                  <p className="text-[14px] font-bold text-[#07111f]">{h.name}</p>
                  <p className="text-[11px] text-[#94a3b8] mt-1">
                    {h.mosqueCount} mosque{h.mosqueCount !== 1 ? "s" : ""}
                    {countMap[h.name] ? ` \u00B7 ${countMap[h.name]} homes for sale` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white px-5 sm:px-11 py-12 border-t border-[#e2e8f0]">
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

        {/* Lead capture CTA */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-14">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#f8f9fb]">
              Get alerts for homes near your preferred mosque
            </h2>
            <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3 mb-8 max-w-lg mx-auto">
              Tell us which area matters to you and we&apos;ll send you new listings the moment they hit the market.
            </p>
            <MosqueAlertForm />
          </div>
        </section>
      </div>
    </>
  );
}
