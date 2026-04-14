import { generateMetadata as genMeta } from "@/lib/seo";
import { schools, getAllNeighbourhoods } from "@/lib/schools";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SchemaScript from "@/components/SchemaScript";
import {
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import SchoolsGrid from "./SchoolsGrid";
import SchoolAlertForm from "./SchoolAlertForm";

export const metadata = genMeta({
  title: "Milton Schools — Homes Near Top Schools",
  description:
    "Find homes for sale near Milton Ontario's 28 public and Catholic schools. Live TREB listings by school zone, Fraser scores, and neighbourhood data.",
  canonical: "https://miltonly.com/schools",
  keywords: [
    "Milton Ontario schools real estate",
    "homes near Milton schools",
    "Milton school zones",
    "best school zone Milton",
    "homes near Bishop Reding Milton",
    "Milton District High School homes",
    "Milton Catholic schools real estate",
    "best neighbourhood for families Milton",
  ],
});

export default async function SchoolsPage() {
  // Get active listing counts by neighbourhood for each school
  const neighbourhoods = getAllNeighbourhoods();
  const counts = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    where: { status: "active", permAdvertise: true, city: "Milton" },
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

  const schoolsWithCounts = schools.map((s) => ({
    ...s,
    activeListings: countMap[s.neighbourhood] || 0,
  }));

  const totalActive = Object.values(countMap).reduce((a, b) => a + b, 0);

  const publicElem = schools.filter((s) => s.board === "public" && s.level === "elementary").length;
  const publicSec = schools.filter((s) => s.board === "public" && s.level === "secondary").length;
  const cathElem = schools.filter((s) => s.board === "catholic" && s.level === "elementary").length;
  const cathSec = schools.filter((s) => s.board === "catholic" && s.level === "secondary").length;

  // Neighbourhoods that have schools — for internal linking
  const hoodSlugs = neighbourhoods.map((n) => ({
    name: n,
    slug: n.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"),
    schoolCount: schools.filter((s) => s.neighbourhood === n).length,
  }));

  const faqs = [
    {
      question: "Which Milton neighbourhood has the best schools?",
      answer:
        "Bishop P.F. Reding Catholic Secondary School consistently ranks highest in Milton with a Fraser Institute score of 8.0\u20138.2 out of 10. Milton District High School scores 7.7/10. For elementary, families in Timberlea have access to E.W. Foster PS, Sam Sherratt PS, and W.I. Dick Middle School (French Immersion). Dempsey and Hawthorne Village are also popular with young families.",
    },
    {
      question: "How do I find homes near Bishop Reding in Milton?",
      answer:
        `Bishop P.F. Reding Catholic Secondary School is located in Milton\u2019s core. There are currently ${countMap["Milton"] || "multiple"} active listings in the surrounding area. You can browse all nearby homes, filter by price and property type, and set up alerts on the Bishop P.F. Reding school page on Miltonly.`,
    },
    {
      question: "What is the best school zone in Milton for families?",
      answer:
        "It depends on what matters most to your family. For Fraser scores, Bishop P.F. Reding (8.0\u20138.2) and Milton District High School (7.7) lead the secondary schools. For newer builds near good elementary schools, Hawthorne Village (Anne J. MacArthur PS) and Dempsey (Chris Hadfield PS) offer the best combination of modern housing and well-rated schools. Timberlea has three schools within walking distance and is one of Milton\u2019s most established family neighbourhoods.",
    },
    {
      question: "Are there French Immersion schools in Milton?",
      answer:
        "Yes. W.I. Dick Middle School in Timberlea offers French Immersion for grades 6\u20138 through the Halton District School Board. Several Catholic elementary schools also offer Extended French programs. Contact the school boards directly for current enrollment availability.",
    },
    {
      question: "How many schools are there in Milton Ontario?",
      answer:
        `Milton has ${schools.length} schools across two boards: the Halton District School Board (public) operates ${publicElem + publicSec} schools, and the Halton Catholic District School Board operates ${cathElem + cathSec} schools. This includes ${publicElem} public elementary, ${publicSec} public secondary, ${cathElem} Catholic elementary, and ${cathSec} Catholic secondary schools.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: "https://miltonly.com" },
      { name: "Schools", url: "https://miltonly.com/schools" },
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
          <div className="flex items-center gap-2 text-[11px] text-[#94a3b8]">
            <Link href="/" className="hover:text-[#07111f]">Home</Link>
            <span>&rsaquo;</span>
            <span className="text-[#475569] font-medium">Schools</span>
          </div>
        </div>

        {/* Hero */}
        <section className="bg-[#07111f] px-5 sm:px-11 py-10 sm:py-14">
          <div className="max-w-6xl mx-auto">
            <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-3">
              School Zone Intelligence
            </p>
            <h1 className="text-[28px] sm:text-[40px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
              Milton Ontario Schools &amp; Real Estate
            </h1>
            <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-4 max-w-2xl leading-relaxed">
              Find homes for sale near Milton&apos;s top-rated public and Catholic schools.
              {totalActive > 0 && ` ${totalActive} active listings across ${neighbourhoods.length} school neighbourhoods, updated daily from TREB.`}
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section className="bg-[#fbbf24] px-5 sm:px-11 py-5">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: String(publicElem), label: "Public elementary" },
              { value: String(publicSec), label: "Public secondary" },
              { value: String(cathElem), label: "Catholic elementary" },
              { value: String(cathSec), label: "Catholic secondary" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[22px] font-extrabold text-[#07111f]">{s.value}</p>
                <p className="text-[10px] text-[#78350f] font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* School cards grid */}
        <div className="px-5 sm:px-11 py-8">
          <SchoolsGrid schools={schoolsWithCounts} />
        </div>

        {/* Why school zones matter in Milton — prose section */}
        <section className="bg-white px-5 sm:px-11 py-12 border-t border-[#e2e8f0]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-[20px] font-extrabold text-[#07111f] mb-6">
              Why school zones matter when buying in Milton
            </h2>
            <div className="text-[14px] text-[#374151] leading-[1.85] space-y-4">
              <p>
                Milton has grown faster than almost any municipality in Canada over the past two decades, and that growth has been driven overwhelmingly by young families. The town&apos;s population skews younger than the national average, and parents moving here consistently rank school quality as one of their top three decision factors alongside commute time and home price. That makes school zones one of the most reliable indicators of neighbourhood demand and long-term property value.
              </p>
              <p>
                Two school boards serve Milton: the Halton District School Board on the public side, and the Halton Catholic District School Board. Between them, they operate {schools.length} schools ranging from JK through grade 12. The Halton public system is widely regarded as one of Ontario&apos;s strongest, and Milton&apos;s Catholic schools consistently outperform provincial averages on standardized testing. Bishop P.F. Reding Catholic Secondary, for example, holds a Fraser Institute score of 8.0&ndash;8.2 out of 10, making it one of the highest-rated high schools in the region.
              </p>
              <p>
                From a real estate perspective, the connection between school quality and home values is well documented. Homes within walking distance of highly rated schools tend to hold their value more consistently during market corrections and see stronger appreciation during growth periods. In Milton, neighbourhoods like Timberlea, Dempsey, and Hawthorne Village benefit from having multiple schools clustered together, which makes them particularly attractive to families with children at different grade levels. A family in Timberlea, for instance, can have children at E.W. Foster PS, Sam Sherratt PS, and W.I. Dick Middle School all within a short walk.
              </p>
              <p>
                For buyers who are relocating to Milton, understanding school zones can also narrow down the neighbourhood search significantly. If Catholic education is a priority, the density of Catholic elementary schools across Milton&apos;s core gives families plenty of options without being restricted to a single area. If French Immersion is the goal, W.I. Dick Middle School in Timberlea is the main pathway. And for families planning ahead for high school, proximity to Milton District High School or one of the three Catholic secondary schools often factors into which side of town makes the most sense.
              </p>
            </div>
          </div>
        </section>

        {/* Neighbourhoods with schools — internal links */}
        <section className="bg-[#f8f9fb] px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[18px] font-extrabold text-[#07111f] mb-6">
              Explore Milton neighbourhoods with schools
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
                    {h.schoolCount} school{h.schoolCount !== 1 ? "s" : ""}
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
              Get alerts for homes near your preferred school
            </h2>
            <p className="text-[14px] text-[rgba(248,249,251,0.5)] mt-3 mb-8 max-w-lg mx-auto">
              Tell us which school zone matters to you and we&apos;ll send you new listings the moment they hit the market.
            </p>
            <SchoolAlertForm />
          </div>
        </section>
      </div>
    </>
  );
}
