// src/app/mosques/page.tsx — forest-v2 via the shared PlaceDirectory template.
// RESTYLE ONLY: the hardcoded mosque data, the active-listing-count groupBy
// (permAdvertise + city), the FAQ build, and the JSON-LD (SchemaScript) are
// byte-identical to the navy page — only the render maps into PlaceDirectory.
import { generateMetadata as genMeta } from "@/lib/seo";
import { mosques } from "@/lib/mosques";
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
import type { PlaceCard } from "@/components/places/types";

export const dynamic = "force-dynamic";

export const metadata = genMeta({
  title: `Mosques in ${config.CITY_NAME} — Homes Near Masjids`,
  description: `Find homes for sale near ${config.CITY_NAME} ${config.CITY_PROVINCE}'s mosques and Islamic centres. ${mosques.length} locations with live TREB listings by neighbourhood. Updated daily.`,
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

const BADGE_TONE = { masjid: "blue", musalla: "amber", centre: "green" } as const;
const TYPE_LABEL = { masjid: "Masjid", musalla: "Musalla", centre: "Centre" } as const;

export default async function MosquesPage() {
  // ── data: byte-identical to the navy page ──
  const counts = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    where: { status: "active", permAdvertise: true, city: config.PRISMA_CITY_VALUE },
    _count: true,
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) {
    for (const hood of Array.from(new Set(mosques.map((m) => m.neighbourhood)))) {
      if (c.neighbourhood.toLowerCase().includes(hood.toLowerCase())) {
        countMap[hood] = (countMap[hood] || 0) + c._count;
      }
    }
  }
  const mosquesWithCounts = mosques.map((m) => ({ ...m, activeListings: countMap[m.neighbourhood] || 0 }));
  const totalActive = Object.values(countMap).reduce((a, b) => a + b, 0);

  const masjidCount = mosques.filter((m) => m.type === "masjid").length;
  const musallaCount = mosques.filter((m) => m.type === "musalla").length;
  const centreCount = mosques.filter((m) => m.type === "centre").length;
  const withJumah = mosques.filter((m) => m.services.includes("Jumu'ah")).length;

  const faqs = [
    {
      question: `How many mosques are there in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME} has ${mosques.length} mosques and Islamic centres, including ${masjidCount} full masjid${masjidCount !== 1 ? "s" : ""}, ${centreCount} community centre${centreCount !== 1 ? "s" : ""}, and ${musallaCount} musalla${musallaCount !== 1 ? "s" : ""}. ${withJumah} locations offer Jumu’ah prayers. The largest is the Halton Islamic Community Centre on Regional Rd 25, which offers daily prayers, an Islamic school, a Hifz program, and a food bank.`,
    },
    {
      question: `Where is the nearest mosque to ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME} has several mosques spread across the town. The Halton Islamic Community Centre at 4269 Regional Rd 25 is the largest, offering full masjid services. ICNA ${config.CITY_NAME} at 500 Laurier Ave and the ${config.CITY_NAME} Muslim Community Centre on Steeles Ave are centrally located. ${config.CITY_NAME} Musalla on Derry Rd serves the northwest area.`,
    },
    {
      question: `Which ${config.CITY_NAME} neighbourhood is best for Muslim families?`,
      answer: `${config.CITY_NAME}’s mosques and Islamic centres are distributed across the town, so most neighbourhoods offer reasonable access. The core ${config.CITY_NAME} area has the highest concentration, with the Halton Islamic Community Centre, ICNA ${config.CITY_NAME}, and the ${config.CITY_NAME} Muslim Community Centre all within a short drive. There are currently ${totalActive > 0 ? totalActive : "many"} homes for sale across these neighbourhoods.`,
    },
    {
      question: `Are there homes for sale near mosques in ${config.CITY_NAME}?`,
      answer: `Yes. There are currently ${totalActive > 0 ? totalActive : "multiple"} active listings near ${config.CITY_NAME}’s mosques and Islamic centres. Each mosque page on ${config.SITE_NAME} shows live nearby listings with prices, property types, and direct links to full details. You can also set up alerts to be notified when new homes list near your preferred location.`,
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

  // ── map to the shared template ──
  const items: PlaceCard[] = mosquesWithCounts.map((m) => ({
    slug: m.slug,
    href: `/mosques/${m.slug}`,
    name: m.name,
    badge: { label: TYPE_LABEL[m.type], tone: BADGE_TONE[m.type] },
    metaParts: [m.affiliation],
    note: m.notes,
    footer: m.activeListings > 0 ? `${m.activeListings} homes for sale nearby` : "View nearby listings",
    footerActive: m.activeListings > 0,
    filters: { type: m.type },
    searchText: `${m.name} ${m.neighbourhood} ${m.affiliation}`.toLowerCase(),
  }));

  return (
    <>
      <SchemaScript schemas={schemas} />
      <PlaceDirectory
        breadcrumbLabel="Mosques"
        eyebrow="Community & real estate"
        title={`Mosques in ${config.CITY_NAME}`}
        titleEm="& nearby homes"
        subtitle={`Find homes for sale near ${config.CITY_NAME}'s ${mosques.length} mosques and Islamic centres.${totalActive > 0 ? ` ${totalActive} active listings in surrounding neighbourhoods, updated daily from TREB.` : ""}`}
        stats={[
          { value: String(mosques.length), label: "Mosques & centres" },
          { value: String(masjidCount), label: "Full masjids" },
          { value: String(withJumah), label: "With Jumu’ah" },
          { value: totalActive > 0 ? String(totalActive) : "—", label: "Homes for sale nearby" },
        ]}
        items={items}
        filterGroups={[
          {
            key: "type",
            allLabel: "All types",
            options: [
              { value: "masjid", label: "Masjid" },
              { value: "musalla", label: "Musalla" },
              { value: "centre", label: "Centre" },
            ],
          },
        ]}
        searchPlaceholder="Search mosques by name or affiliation…"
        itemNoun="mosque"
        prose={{
          heading: `${config.CITY_NAME}'s growing Muslim community and why proximity matters`,
          paragraphs: [
            `${config.CITY_NAME}'s Muslim community has grown substantially over the past decade, mirroring the town's broader population boom. What was once a small, tight-knit group gathering for Jumu'ah in rented halls now numbers in the thousands, supported by seven mosques and Islamic centres spread across town. That growth has reshaped the local real estate landscape in meaningful ways, particularly for families who prioritize daily access to prayer, community programming, and Islamic education for their children.`,
            `For many Muslim families, proximity to a mosque is not simply a matter of convenience. Daily prayers, Jumu'ah on Fridays, Taraweeh during Ramadan, Eid celebrations, and weekend Islamic school all factor into where a family chooses to live. A home within a ten-minute drive of a full-service masjid can make the difference between attending regularly and missing out. The Halton Islamic Community Centre on Regional Rd 25 is the anchor institution here, offering not just daily salah but a full Islamic school, a Hifz program, and a community food bank.`,
            `The presence of multiple organizations serving different traditions also matters. Minhaj-ul-Quran operates the ${config.CITY_NAME} Muslim Community Centre with locations on Steeles Ave and Bronte St. ICNA ${config.CITY_NAME} runs a centre on Laurier Ave. The Sayyidah Fatemah Islamic Centre, founded by the Islamic Supreme Council of Canada, serves another segment of the community. This diversity means families can find a congregation that fits their practice without leaving ${config.CITY_NAME}.`,
            `From a real estate perspective, homes near active mosques tend to see steady demand from within the community. Buyers looking near these locations should pay attention to commute patterns as well. ${config.CITY_NAME}'s GO station provides direct access to Union Station, which means a family can live near their mosque and still commute to Toronto for work. That combination of community infrastructure and transit access continues to draw Muslim families to ${config.CITY_NAME} specifically.`,
          ],
        }}
        faqs={faqs}
        alert={{
          heading: "Get alerts for homes near your preferred mosque",
          body: "Tell us which area matters to you and we'll send you new listings the moment they hit the market.",
          form: <PlaceAlertForm source="mosque-alert" areaPlaceholder="Mosque or area (optional)" />,
        }}
      />
    </>
  );
}
