import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import AdsClient from "./AdsClient";

export const metadata = genMeta({
  title: "Milton Rentals — Get Matched by a Local Expert",
  description: "Live TREB rental listings in Milton Ontario, matched to your needs by RE/MAX Hall-of-Fame Realtor Aamir Yaqoob. Same-day showings when available.",
  canonical: "https://miltonly.com/rentals/ads",
  noIndex: true,
});

export const revalidate = 600;

type SP = Record<string, string | string[] | undefined>;
const str = (sp: SP, k: string) => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

// Always-applied lead-page rentals filter — never relaxed.
const ALWAYS_WHERE = {
  transactionType: "For Lease" as const,
  city: "Milton",
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

  // Phase 2 — fetch a meaningful pool unfiltered, let the client filter chips
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

  // "Updated X min ago" — clamp to "RECENTLY" if unknown or > 60 minutes.
  let updatedMinAgo: number | null = null;
  if (latest?.syncedAt) {
    const minutes = Math.floor((Date.now() - new Date(latest.syncedAt).getTime()) / 60000);
    if (minutes >= 0 && minutes <= 60) updatedMinAgo = minutes;
  }

  // TODO: remove this floor after week 4 of paid traffic — early-launch
  // safeguard so the urgency line doesn't read "0 Milton renters got matched".
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
  // Public Mega Milton GBP address used for LocalBusiness; authorized by agent.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": "https://www.miltonly.com/#aamir",
        name: "Aamir Yaqoob",
        jobTitle: "Sales Representative",
        worksFor: {
          "@type": "RealEstateAgent",
          name: "RE/MAX Realty Specialists Inc.",
        },
        telephone: "+1-647-839-9090",
        url: "https://www.miltonly.com",
        areaServed: [
          { "@type": "City", name: "Milton", addressRegion: "ON", addressCountry: "CA" },
          { "@type": "City", name: "Halton Hills", addressRegion: "ON", addressCountry: "CA" },
          { "@type": "City", name: "Oakville", addressRegion: "ON", addressCountry: "CA" },
        ],
        knowsAbout: [
          "Milton Real Estate",
          "Milton Rentals",
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
        "@id": "https://www.miltonly.com/#business",
        name: "Aamir Yaqoob — Milton Real Estate Agent | RE/MAX",
        image: "https://www.miltonly.com/og-image.jpg",
        telephone: "+1-647-839-9090",
        url: "https://www.miltonly.com",
        address: {
          "@type": "PostalAddress",
          streetAddress: "178 Lemieux Ct",
          addressLocality: "Milton",
          addressRegion: "ON",
          postalCode: "L9E 1E9",
          addressCountry: "CA",
        },
        areaServed: "Milton, Ontario, Canada",
        priceRange: "$$",
      },
      {
        "@type": "WebPage",
        "@id": "https://www.miltonly.com/rentals/ads",
        name: "Milton Rentals — Get Matched by a Local Expert",
        description:
          "Find your Milton rental with Aamir Yaqoob — RE/MAX Hall of Fame, 14 years in Milton. Live TREB listings hand-matched. Reply within 60 min.",
        isPartOf: { "@id": "https://www.miltonly.com/#business" },
        about: { "@id": "https://www.miltonly.com/#aamir" },
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
