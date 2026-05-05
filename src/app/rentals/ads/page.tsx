import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import AdsClient from "./AdsClient";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `${config.CITY_NAME} Rentals â€” Get Matched by a Local Expert`,
  description: `Live TREB rental listings in ${config.CITY_NAME} ${config.CITY_PROVINCE}, matched to your needs by RE/MAX Hall-of-Fame Realtor ${config.realtor.name}. Same-day showings when available.`,
  canonical: `${config.SITE_URL}/rentals/ads`,
  noIndex: true,
});

export const revalidate = 600;

type SP = Record<string, string | string[] | undefined>;
const str = (sp: SP, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

// Always-applied lead-page rentals filter â€” never relaxed.
const ALWAYS_WHERE = {
  transactionType: "For Lease" as const,
  city: config.PRISMA_CITY_VALUE,
  permAdvertise: true,
};

export default async function RentalsAdsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const qType = (str(sp, "type") || "").toLowerCase();
  const qBeds = parseInt(str(sp, "beds") || "0", 10) || 0;
  const qMax = parseInt(str(sp, "max") || "0", 10) || 0;

  // Phase 2 â€” fetch a meaningful pool unfiltered, let the client filter chips
  // against the pool. URL params seed initial chip state, not server filter.
  const [listings, totalRentals, allListed, latest, renterCountRaw] = await Promise.all([
    prisma.listing.findMany({
      where: ALWAYS_WHERE,
      orderBy: { listedAt: "desc" },
      take: 60,
    }),
    prisma.listing.count({ where: ALWAYS_WHERE }),
    prisma.listing.findMany({
      where: ALWAYS_WHERE,
      select: { listedAt: true },
      take: 300,
    }),
    prisma.listing.findFirst({
      where: ALWAYS_WHERE,
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    }),
    prisma.lead.count({
      where: {
        source: "ads-rentals-lp",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newThisWeek = allListed.filter((l) => new Date(l.listedAt) > weekAgo).length;
  const serialized = JSON.parse(JSON.stringify(listings));

  // "Updated X min ago" â€” clamp to "RECENTLY" if unknown or > 60 minutes.
  let updatedMinAgo: number | null = null;
  if (latest?.syncedAt) {
    const minutes = Math.floor((Date.now() - new Date(latest.syncedAt).getTime()) / 60000);
    if (minutes >= 0 && minutes <= 60) updatedMinAgo = minutes;
  }

  // TODO: remove this floor after week 4 of paid traffic â€” early-launch
  // safeguard so the urgency line doesn't read "0 ${CITY_NAME} renters got matched".
  const renterCount = renterCountRaw < 5 ? 12 : renterCountRaw;

  // Hero image selection â€” condo â†’ interior, house types â†’ neighbourhood, default â†’ interior
  const HERO_BY_TYPE: Record<string, string> = {
    condo: "/rentals-ads/hero-default.png",
    detached: "/rentals-ads/hero-neighbourhood.png",
    townhouse: "/rentals-ads/hero-neighbourhood.png",
    semi: "/rentals-ads/hero-neighbourhood.png",
  };
  const heroSrc = HERO_BY_TYPE[qType] || "/rentals-ads/hero-default.png";

  // Schema.org JSON-LD for /rentals/ads â€” RealEstateAgent + LocalBusiness + WebPage.
  // Public Mega ${CITY_NAME} GBP address used for LocalBusiness; authorized by agent.
  const realtorFirstName = config.realtor.name.split(" ")[0].toLowerCase();
  const brokerageShort = config.brokerage.name.replace(", Brokerage", "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": `${config.SITE_URL_WWW}/#${realtorFirstName}`,
        name: config.realtor.name,
        jobTitle: config.realtor.title,
        worksFor: {
          "@type": "RealEstateAgent",
          name: brokerageShort,
        },
        telephone: config.realtor.phoneE164,
        url: config.SITE_URL_WWW,
        areaServed: [
          { "@type": "City", name: config.CITY_NAME, addressRegion: config.CITY_PROVINCE_CODE, addressCountry: config.CITY_COUNTRY_CODE },
          { "@type": "City", name: "Halton Hills", addressRegion: config.CITY_PROVINCE_CODE, addressCountry: config.CITY_COUNTRY_CODE },
          { "@type": "City", name: "Oakville", addressRegion: config.CITY_PROVINCE_CODE, addressCountry: config.CITY_COUNTRY_CODE },
        ],
        knowsAbout: [
          `${config.CITY_NAME} Real Estate`,
          `${config.CITY_NAME} Rentals`,
          "Lease Negotiation",
          "Property Inspection",
          "Halton Region MLS",
        ],
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "5.0",
          bestRating: "5",
          ratingCount: "4",
        },
        award: ["RE/MAX Hall of Fame", "RE/MAX Executive Award", "RE/MAX 100% Club"],
      },
      {
        "@type": "LocalBusiness",
        "@id": `${config.SITE_URL_WWW}/#business`,
        name: `${config.realtor.name} â€” ${config.CITY_NAME} Real Estate Agent | RE/MAX`,
        image: `${config.SITE_URL_WWW}/og-image.jpg`,
        telephone: config.realtor.phoneE164,
        url: config.SITE_URL_WWW,
        address: {
          "@type": "PostalAddress",
          streetAddress: "178 Lemieux Ct",
          addressLocality: config.CITY_NAME,
          addressRegion: config.CITY_PROVINCE_CODE,
          postalCode: "L9E 1E9",
          addressCountry: config.CITY_COUNTRY_CODE,
        },
        areaServed: `${config.CITY_NAME}, ${config.CITY_PROVINCE}, ${config.CITY_COUNTRY}`,
        priceRange: "$$",
      },
      {
        "@type": "WebPage",
        "@id": `${config.SITE_URL_WWW}/rentals/ads`,
        name: `${config.CITY_NAME} Rentals â€” Get Matched by a Local Expert`,
        description:
          `Find your ${config.CITY_NAME} rental with ${config.realtor.name} â€” RE/MAX Hall of Fame, ${config.realtor.yearsExperience} years in ${config.CITY_NAME}. Live TREB listings hand-matched. Reply within 60 min.`,
        isPartOf: { "@id": `${config.SITE_URL_WWW}/#business` },
        about: { "@id": `${config.SITE_URL_WWW}/#${realtorFirstName}` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AdsClient
        listings={serialized}
        totalRentals={totalRentals}
        newThisWeek={newThisWeek}
        renterCount={renterCount}
        updatedMinAgo={updatedMinAgo}
        initialType={qType}
        initialBeds={qBeds}
        initialMax={qMax}
        heroSrc={heroSrc}
      />
    </>
  );
}
