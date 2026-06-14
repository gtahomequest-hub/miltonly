// src/app/schools/page.tsx — forest-v2 via the shared PlaceDirectory template.
// RESTYLE ONLY: the hardcoded school data, the active-listing-count groupBy
// (permAdvertise + city), the FAQ build, and the JSON-LD are byte-identical.
// QUIRK FIX: the "28 schools" SEO copy now derives from schools.length (29) so
// it can't drift again. Hood-links point at /listings?neighbourhood=<n> (always
// 200) rather than a toSlug() hub guess that could 404.
import { generateMetadata as genMeta } from "@/lib/seo";
import { schools, getAllNeighbourhoods } from "@/lib/schools";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import SchemaScript from "@/components/SchemaScript";
import {
  generateBreadcrumbSchema,
  generateLocalBusinessSchema,
  generateFAQSchema,
} from "@/lib/schema";
import PlaceDirectory from "@/components/places/PlaceDirectory";
import PlaceAlertForm from "@/components/places/PlaceAlertForm";
import type { PlaceCard, PlaceLink } from "@/components/places/types";

export const dynamic = "force-dynamic";

export const metadata = genMeta({
  title: `${config.CITY_NAME} Schools — Homes Near Top Schools`,
  description: `Find homes for sale near ${config.CITY_NAME} ${config.CITY_PROVINCE}'s ${schools.length} public and Catholic schools. Live TREB listings by school zone, Fraser scores, and neighbourhood data.`,
  canonical: `${config.SITE_URL}/schools`,
  keywords: [
    `${config.CITY_NAME} ${config.CITY_PROVINCE} schools real estate`,
    `homes near ${config.CITY_NAME} schools`,
    `${config.CITY_NAME} school zones`,
    `best school zone ${config.CITY_NAME}`,
    `homes near Bishop Reding ${config.CITY_NAME}`,
    `${config.CITY_NAME} District High School homes`,
    `${config.CITY_NAME} Catholic schools real estate`,
    `best neighbourhood for families ${config.CITY_NAME}`,
  ],
});

export default async function SchoolsPage() {
  // ── data: byte-identical to the navy page ──
  const neighbourhoods = getAllNeighbourhoods();
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
  const schoolsWithCounts = schools.map((s) => ({ ...s, activeListings: countMap[s.neighbourhood] || 0 }));
  const totalActive = Object.values(countMap).reduce((a, b) => a + b, 0);

  const publicElem = schools.filter((s) => s.board === "public" && s.level === "elementary").length;
  const publicSec = schools.filter((s) => s.board === "public" && s.level === "secondary").length;
  const cathElem = schools.filter((s) => s.board === "catholic" && s.level === "elementary").length;
  const cathSec = schools.filter((s) => s.board === "catholic" && s.level === "secondary").length;

  const hoodSlugs = neighbourhoods.map((n) => ({
    name: n,
    schoolCount: schools.filter((s) => s.neighbourhood === n).length,
  }));

  const faqs = [
    {
      question: `Which ${config.CITY_NAME} neighbourhood has the best schools?`,
      answer: `Bishop P.F. Reding Catholic Secondary School consistently ranks highest in ${config.CITY_NAME} with a Fraser Institute score of 8.0–8.2 out of 10. ${config.CITY_NAME} District High School scores 7.7/10. For elementary, families in Timberlea have access to E.W. Foster PS, Sam Sherratt PS, and W.I. Dick Middle School (French Immersion). Dempsey and Hawthorne Village are also popular with young families.`,
    },
    {
      question: `How do I find homes near Bishop Reding in ${config.CITY_NAME}?`,
      answer: `Bishop P.F. Reding Catholic Secondary School is located in ${config.CITY_NAME}'s core. There are currently ${countMap[config.CITY_NAME] || "multiple"} active listings in the surrounding area. You can browse all nearby homes, filter by price and property type, and set up alerts on the Bishop P.F. Reding school page on ${config.SITE_NAME}.`,
    },
    {
      question: `What is the best school zone in ${config.CITY_NAME} for families?`,
      answer: `It depends on what matters most to your family. For Fraser scores, Bishop P.F. Reding (8.0–8.2) and ${config.CITY_NAME} District High School (7.7) lead the secondary schools. For newer builds near good elementary schools, Hawthorne Village (Anne J. MacArthur PS) and Dempsey (Chris Hadfield PS) offer the best combination of modern housing and well-rated schools. Timberlea has three schools within walking distance and is one of ${config.CITY_NAME}'s most established family neighbourhoods.`,
    },
    {
      question: `Are there French Immersion schools in ${config.CITY_NAME}?`,
      answer: "Yes. W.I. Dick Middle School in Timberlea offers French Immersion for grades 6–8 through the Halton District School Board. Several Catholic elementary schools also offer Extended French programs. Contact the school boards directly for current enrollment availability.",
    },
    {
      question: `How many schools are there in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME} has ${schools.length} schools across two boards: the Halton District School Board (public) operates ${publicElem + publicSec} schools, and the Halton Catholic District School Board operates ${cathElem + cathSec} schools. This includes ${publicElem} public elementary, ${publicSec} public secondary, ${cathElem} Catholic elementary, and ${cathSec} Catholic secondary schools.`,
    },
  ];

  const schemas = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Schools", url: `${config.SITE_URL}/schools` },
    ]),
    generateLocalBusinessSchema(),
    generateFAQSchema(faqs),
  ];

  const items: PlaceCard[] = schoolsWithCounts.map((s) => ({
    slug: s.slug,
    href: `/schools/${s.slug}`,
    name: s.name,
    badge: { label: s.board === "public" ? "Public" : "Catholic", tone: s.board === "public" ? "blue" : "amber" },
    metaParts: [s.grades, s.neighbourhood],
    fraser: s.fraserScore,
    note: s.notes,
    footer: s.activeListings > 0 ? `${s.activeListings} homes for sale nearby` : "View nearby listings",
    footerActive: s.activeListings > 0,
    filters: { board: s.board, level: s.level },
    searchText: `${s.name} ${s.neighbourhood}`.toLowerCase(),
  }));

  const hoodLinks: PlaceLink[] = hoodSlugs.map((h) => ({
    name: h.name,
    href: `/listings?neighbourhood=${encodeURIComponent(h.name)}`,
    sub: `${h.schoolCount} school${h.schoolCount !== 1 ? "s" : ""}`,
  }));

  return (
    <>
      <SchemaScript schemas={schemas} />
      <PlaceDirectory
        breadcrumbLabel="Schools"
        eyebrow="School zone intelligence"
        title={`${config.CITY_NAME} schools`}
        titleEm="& real estate"
        subtitle={`Find homes for sale near ${config.CITY_NAME}'s ${schools.length} public and Catholic schools.${totalActive > 0 ? ` ${totalActive} active listings across ${neighbourhoods.length} school neighbourhoods, updated daily from TREB.` : ""}`}
        stats={[
          { value: String(publicElem), label: "Public elementary" },
          { value: String(publicSec), label: "Public secondary" },
          { value: String(cathElem), label: "Catholic elementary" },
          { value: String(cathSec), label: "Catholic secondary" },
        ]}
        items={items}
        filterGroups={[
          {
            key: "board",
            allLabel: "All boards",
            options: [
              { value: "public", label: "Public (HDSB)" },
              { value: "catholic", label: "Catholic (HCDSB)" },
            ],
          },
          {
            key: "level",
            allLabel: "All levels",
            options: [
              { value: "elementary", label: "Elementary" },
              { value: "secondary", label: "Secondary" },
            ],
          },
        ]}
        searchPlaceholder="Search schools by name or neighbourhood…"
        itemNoun="school"
        prose={{
          heading: `Why school zones matter when buying in ${config.CITY_NAME}`,
          paragraphs: [
            `${config.CITY_NAME} has grown faster than almost any municipality in Canada over the past two decades, and that growth has been driven overwhelmingly by young families. The town's population skews younger than the national average, and parents moving here consistently rank school quality as one of their top three decision factors alongside commute time and home price. That makes school zones one of the most reliable indicators of neighbourhood demand and long-term property value.`,
            `Two school boards serve ${config.CITY_NAME}: the Halton District School Board on the public side, and the Halton Catholic District School Board. Between them, they operate ${schools.length} schools ranging from JK through grade 12. The Halton public system is widely regarded as one of ${config.CITY_PROVINCE}'s strongest, and ${config.CITY_NAME}'s Catholic schools consistently outperform provincial averages. Bishop P.F. Reding Catholic Secondary holds a Fraser Institute score of 8.0–8.2 out of 10, one of the highest-rated high schools in the region.`,
            `From a real estate perspective, the connection between school quality and home values is well documented. Homes within walking distance of highly rated schools tend to hold their value more consistently during corrections and see stronger appreciation during growth periods. In ${config.CITY_NAME}, neighbourhoods like Timberlea, Dempsey, and Hawthorne Village benefit from having multiple schools clustered together, which makes them particularly attractive to families with children at different grade levels.`,
            `For buyers relocating to ${config.CITY_NAME}, understanding school zones narrows the neighbourhood search significantly. If Catholic education is a priority, the density of Catholic elementary schools across ${config.CITY_NAME}'s core gives families plenty of options. If French Immersion is the goal, W.I. Dick Middle School in Timberlea is the main pathway. And for families planning ahead for high school, proximity to ${config.CITY_NAME} District High School or one of the Catholic secondary schools often factors into which side of town makes the most sense.`,
          ],
        }}
        hoodLinks={{ heading: `Explore ${config.CITY_NAME} neighbourhoods with schools`, links: hoodLinks }}
        faqs={faqs}
        alert={{
          heading: "Get alerts for homes near your preferred school",
          body: "Tell us which school zone matters to you and we'll send you new listings the moment they hit the market.",
          form: <PlaceAlertForm source="school-alert" areaPlaceholder="School or area (optional)" />,
        }}
      />
    </>
  );
}
