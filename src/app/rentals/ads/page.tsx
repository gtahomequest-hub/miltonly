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

export default async function RentalsAdsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const qType = (str(sp, "type") || "").toLowerCase();
  const qBeds = parseInt(str(sp, "beds") || "0", 10) || 0;
  const qMax = parseInt(str(sp, "max") || "0", 10) || 0;
  const qMin = parseInt(str(sp, "min") || "0", 10) || 0;

  const where: Record<string, unknown> = {
    transactionType: "For Lease",
    city: "Milton",
    permAdvertise: true,
  };
  if (["condo", "townhouse", "semi", "detached"].includes(qType)) where.propertyType = qType;
  if (qBeds > 0) where.bedrooms = qBeds >= 4 ? { gte: 4 } : qBeds;
  if (qMax > 0 || qMin > 0) {
    where.price = { gt: qMin || 500, lt: qMax || 10000 };
  }

  const [listings, totalRentals, allListed] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { listedAt: "desc" },
      take: 9,
    }),
    prisma.listing.count({
      where: { transactionType: "For Lease", city: "Milton", permAdvertise: true },
    }),
    prisma.listing.findMany({
      where: { transactionType: "For Lease", city: "Milton", permAdvertise: true },
      select: { listedAt: true },
      take: 300,
    }),
  ]);

  const matchCount = await prisma.listing.count({ where });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newThisWeek = allListed.filter((l) => new Date(l.listedAt) > weekAgo).length;

  const serialized = JSON.parse(JSON.stringify(listings));

  // Hero image selection — condo → interior, house types → neighbourhood, default → interior
  const HERO_BY_TYPE: Record<string, string> = {
    condo: "/rentals-ads/hero-default.png",
    detached: "/rentals-ads/hero-neighbourhood.png",
    townhouse: "/rentals-ads/hero-neighbourhood.png",
    semi: "/rentals-ads/hero-neighbourhood.png",
  };
  const heroSrc = HERO_BY_TYPE[qType] || "/rentals-ads/hero-default.png";

  return (
    <AdsClient
      listings={serialized}
      matchCount={matchCount}
      totalRentals={totalRentals}
      newThisWeek={newThisWeek}
      initialType={qType}
      initialBeds={qBeds}
      initialMax={qMax}
      heroSrc={heroSrc}
    />
  );
}
