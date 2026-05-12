import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import AdsClient from "./AdsClient";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `${config.CITY_NAME} Rentals — Get Matched by a Local Expert`,
  description: `Live TREB rental listings in ${config.CITY_NAME} ${config.CITY_PROVINCE}, matched to your needs by RE/MAX Hall-of-Fame Realtor ${config.realtor.name}. Same-day showings when available.`,
  canonical: `${config.SITE_URL}/rentals/ads`,
  // Paid landing page is open to crawlers — anecdotal Quality Score lift
  // from removing noindex on Google Ads LPs. Other site routes keep their
  // noindex/robots rules; this override is scoped to /rentals/ads only.
  noIndex: false,
});

export const revalidate = 600;

type SP = Record<string, string | string[] | undefined>;
const str = (sp: SP, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

// Always-applied lead-page rentals filter — never relaxed.
// Price floor at $2,000 excludes sub-rent listings that read as bait or
// data artifacts on this paid-traffic LP. Listings under $2K stay in the DB
// and still appear on /listings + /rentals — only filtered on /rentals/ads.
const ALWAYS_WHERE = {
  transactionType: "For Lease" as const,
  city: config.PRISMA_CITY_VALUE,
  permAdvertise: true,
  price: { gte: 2000 },
};

// URL ?type= param → DB propertyType values. Verified against the live DB
// 2026-05-12: distinct propertyType values for /rentals/ads inventory are
// already normalized to lowercase short form ("condo" / "townhouse" /
// "detached" / "semi"). No Toronto-MLS variants like "Condo Apt" or
// "Att/Row/Twnhouse" — those get mapped to short form at ingest time.
const TYPE_MAP: Record<string, string[]> = {
  condo: ["condo"],
  detached: ["detached"],
  semi: ["semi"],
  townhouse: ["townhouse"],
};

// Min cards needed for the 3-clear + 9-locked grid below.
const MIN_LISTINGS_FOR_GRID = 12;

function buildListingsWhere(type: string | undefined) {
  const base: typeof ALWAYS_WHERE & { propertyType?: { in: string[] } } = { ...ALWAYS_WHERE };
  if (type && TYPE_MAP[type]) {
    base.propertyType = { in: TYPE_MAP[type] };
  }
  return base;
}

export default async function RentalsAdsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const qType = (str(sp, "type") || "").toLowerCase();
  const qBeds = parseInt(str(sp, "beds") || "0", 10) || 0;
  const qMax = parseInt(str(sp, "max") || "0", 10) || 0;

  // Type-aware query: when ?type=condo/detached/semi/townhouse is on URL,
  // filter the listings + total count to that property type. Falls back to
  // unfiltered if the type pool is thinner than MIN_LISTINGS_FOR_GRID (12)
  // so the 3-clear + 9-locked grid always renders fully.
  const typedWhere = buildListingsWhere(qType);
  let listings = await prisma.listing.findMany({
    where: typedWhere,
    orderBy: { listedAt: "desc" },
    take: MIN_LISTINGS_FOR_GRID,
  });
  let totalRentals = await prisma.listing.count({ where: typedWhere });

  if (qType && listings.length < MIN_LISTINGS_FOR_GRID) {
    console.log(
      `[listings-fallback] type=${qType} returned ${listings.length} < ${MIN_LISTINGS_FOR_GRID} — broadening to all types`,
    );
    listings = await prisma.listing.findMany({
      where: ALWAYS_WHERE,
      orderBy: { listedAt: "desc" },
      take: MIN_LISTINGS_FOR_GRID,
    });
    totalRentals = await prisma.listing.count({ where: ALWAYS_WHERE });
  }

  const [allListed, latest, renterCountRaw] = await Promise.all([
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

  // "Updated X min ago" — clamp to "RECENTLY" if unknown or > 60 minutes.
  let updatedMinAgo: number | null = null;
  if (latest?.syncedAt) {
    const minutes = Math.floor((Date.now() - new Date(latest.syncedAt).getTime()) / 60000);
    if (minutes >= 0 && minutes <= 60) updatedMinAgo = minutes;
  }

  // TODO: remove this floor after week 4 of paid traffic — early-launch
  // safeguard so the urgency line doesn't read "0 ${CITY_NAME} renters got matched".
  const renterCount = renterCountRaw < 5 ? 12 : renterCountRaw;

  // Hero image selection — condo → interior, house types → neighbourhood, default → interior
  const HERO_BY_TYPE: Record<string, string> = {
    condo: "/rentals-ads/hero-default.png",
    detached: "/rentals-ads/hero-neighbourhood.png",
    townhouse: "/rentals-ads/hero-neighbourhood.png",
    semi: "/rentals-ads/hero-neighbourhood.png",
  };
  const heroSrc = HERO_BY_TYPE[qType] || "/rentals-ads/hero-default.png";

  // Schema.org JSON-LD for /rentals/ads — RealEstateAgent + LocalBusiness + WebPage.
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
        name: `${config.realtor.name} — ${config.CITY_NAME} Real Estate Agent | RE/MAX`,
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
        name: `${config.CITY_NAME} Rentals — Get Matched by a Local Expert`,
        description:
          `Find your ${config.CITY_NAME} rental with ${config.realtor.name} — RE/MAX Hall of Fame, ${config.realtor.yearsExperience} years in ${config.CITY_NAME}. Live TREB listings hand-matched. Reply within 60 min.`,
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
