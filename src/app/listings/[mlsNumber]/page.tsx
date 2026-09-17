import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ListingDetailClient from "./ListingDetailClient";
import SiteChrome from "@/components/nav/SiteChrome";
import { getLeaseMarket, RENT_TYPE_LABEL, type RentType } from "@/lib/rentSignals";
import { formatCount, formatDateProse, formatRent } from "@/lib/figureFormat";
import type { ListingRentFigure } from "./ListingExtras";
import SchemaScript from "@/components/SchemaScript";
import { schools } from "@/lib/schools";
import { redactAddress } from "@/lib/listings/display-gate";
import { resolvePublishedHubSlug } from "@/lib/hubResolve";

// MC-017 (2026-09-13): ISR, not a render per request. A visit past the day, or a purge, renders
// once and the copy serves until the next. Every DB2 read carries the db2 tag and every DB3 read
// the db3 tag (src/lib/db.ts), dropped by the sold sync and the analytics jobs; the DB1 rows are
// dropped by path from the write paths (src/lib/revalidateSurfaces.ts). generateStaticParams
// returns nothing, and it must exist: without it Next 14 treats a dynamic route as dynamic on
// every request and never fills the route cache (the first MC-017 preview served every page
// MISS, private, no-store). With it, nothing is prerendered at build and every page renders on
// its first visit, then serves from the cache. A page whose Neon reads carry their own hour
// revalidates on the hour: Next takes the smaller of the route's and a fetch's.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface Props { params: { mlsNumber: string } }

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  const SMALL = new Set(["of", "at", "the", "in", "and", "on", "for", "by", "to"]);
  return s.toLowerCase().split(/(\s+|-|\/)/).map((t, i) => {
    if (!t.trim() || t === "/" || t === "-") return t;
    if (i > 0 && SMALL.has(t)) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }).join("");
}
const cleanHood = (h: string) => titleCase(h.replace(/^\d+\s*-\s*\w+\s+/, "").trim());

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!l) return { title: "Listing Not Found" };
  if (!l.permAdvertise) return { title: "Listing Not Available", robots: { index: false, follow: false } };

  const isRental = l.transactionType === "For Lease";
  const hood = cleanHood(l.neighbourhood);
  const addr = l.displayAddress ? titleCase(l.address.split(",")[0]) : "Address on request";
  const typeLabel = titleCase(l.propertyType);
  const priceStr = `$${l.price.toLocaleString()}${isRental ? "/mo" : ""}`;

  const title = isRental
    ? `${addr}: ${l.bedrooms}bd ${typeLabel} for rent in ${hood} ${config.CITY_NAME} | ${priceStr}`
    : `${addr}: ${l.bedrooms}bd ${l.bathrooms}ba ${typeLabel} for sale in ${hood} ${config.CITY_NAME} | ${priceStr}`;

  const days = Math.floor((Date.now() - new Date(l.listedAt).getTime()) / 86400000);
  const firstName = config.realtor.name.split(" ")[0];
  const description = isRental
    ? `${typeLabel} rental at ${addr}, ${hood}: ${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}, ${l.bathrooms} bath. ${priceStr}. Listed ${days === 0 ? "today" : `${days} days ago`}. Book a showing with ${firstName}, usually confirmed within the hour.`
    : `${typeLabel} for sale at ${addr}, ${hood} ${config.CITY_NAME}: ${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}, ${l.bathrooms} bath${l.sqft ? `, ${l.sqft} sqft` : ""}. ${priceStr}. Listed ${days === 0 ? "today" : `${days} days ago`}. Book a showing with ${firstName}, usually confirmed within the hour.`;

  return {
    title,
    description,
    alternates: { canonical: `${config.SITE_URL}/listings/${l.mlsNumber}` },
    openGraph: {
      title,
      description,
      images: l.photos[0] ? [{ url: l.photos[0] }] : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const listingRaw = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!listingRaw) notFound();

  // â”€â”€â”€ COMPLIANCE GATE â”€â”€â”€
  // If permAdvertise = false, do not render the listing publicly.
  if (!listingRaw.permAdvertise) {
    return (
      <div className="min-h-screen bg-[#fffdfa] flex items-center justify-center px-5 py-20">
        <div className="max-w-md text-center">
          <p className="text-[12px] font-bold text-[#6b6f6a] uppercase tracking-[0.14em] mb-3">Not available</p>
          <h1 className="text-[22px] font-extrabold text-[#073126] mb-3">This listing is not available for display</h1>
          <p className="text-[14px] text-[#6b6f6a] mb-6">The brokerage or seller has opted out of public display for this property.</p>
          <Link href="/listings" className="text-[14px] text-[#017848] font-bold hover:underline">← Browse other {config.CITY_NAME} listings</Link>
        </div>
      </div>
    );
  }

  // Redact address if displayAddress = false (keeps MLS + brokerage per RECO)
  const listing = redactAddress(listingRaw);

  // Parallel queries.
  // Phase 2.6: the two sold-count queries (by streetSlug + soldDate, and by
  // neighbourhood + soldDate) were removed. DB1 no longer carries soldDate
  // values; the sold-count information surfaces on the page through the
  // gated StreetSoldBlock / NeighbourhoodSoldBlock fed from DB2.
  const [similarRaw, leaseMarket] = await Promise.all([
    prisma.listing.findMany({
      where: {
        propertyType: listing.propertyType,
        transactionType: listing.transactionType,
        mlsNumber: { not: listing.mlsNumber },
        city: config.PRISMA_CITY_VALUE,
        permAdvertise: true,
      },
      orderBy: { listedAt: "desc" },
      take: 4,
    }),
    // The Board's closed leases by home type, k-gated (rentSignals.ts), for the typical-rent
    // block. The average ASKING rent this replaced fed a cap rate and a cashflow built on
    // assumed figures (MH-008).
    listing.transactionType === "For Lease" ? Promise.resolve(null) : getLeaseMarket(),
  ]);
  const soldCountOnStreet = 0; // deprecated — see StreetSoldBlock on street page
  const soldCountInHood = 0; // deprecated — see NeighbourhoodSoldBlock

  const similar = similarRaw.map(redactAddress);
  const rentFigure = ((): ListingRentFigure | null => {
    const type = listing.propertyType as RentType;
    const f = leaseMarket?.byType.find((t) => t.type === type);
    if (!leaseMarket || !f || f.typical === null) return null;
    const leases = (n: number) => `${formatCount(n)} ${n === 1 ? "lease" : "leases"}`;
    const classed = f.basementCount > 0 || f.upperCount > 0;
    return {
      label: RENT_TYPE_LABEL[type],
      whole: { value: formatRent(f.typical), sample: leases(classed ? f.wholeCount : f.count) },
      basement: f.basementTypical !== null ? { value: formatRent(f.basementTypical), sample: leases(f.basementCount) } : null,
      window: leaseMarket.window,
      through: leaseMarket.through ? formatDateProse(leaseMarket.through) : null,
    };
  })();

  const serialized = JSON.parse(JSON.stringify(listing));
  const serializedSimilar = JSON.parse(JSON.stringify(similar));

  // Match schools by neighbourhood (no lat/lng on schools data)
  const schoolsLite = schools.map((s) => ({
    slug: s.slug, name: s.name, board: s.board as string, level: s.level as string,
    grades: s.grades, fraserScore: s.fraserScore, neighbourhood: s.neighbourhood,
  }));

  const domDays = Math.floor((Date.now() - new Date(listing.listedAt).getTime()) / 86400000);

  // â”€â”€â”€ SCHEMA MARKUP â”€â”€â”€
  const isRental = listing.transactionType === "For Lease";
  const hoodName = cleanHood(listing.neighbourhood);
  // Resolve to a PUBLISHED hub slug for the breadcrumb. null => the neighbourhood crumb is
  // OMITTED rather than emitting /neighbourhoods/<name-slug>, which 404'd whenever the guessed
  // slug missed the registry canonical (e.g. "Rural Nassagaweya" -> the hub is `nassagaweya`)
  // or the hub simply isn't published. Reuses the street-page registry resolution.
  const hubSlug = await resolvePublishedHubSlug(listing.neighbourhood);
  const addrDisplay = listing.displayAddress ? titleCase(listing.address) : `Address on request, ${config.CITY_NAME}, ${config.CITY_PROVINCE_CODE}`;

  const residenceSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": listing.propertyType === "condo" ? "Apartment" : "SingleFamilyResidence",
    name: addrDisplay,
    address: {
      "@type": "PostalAddress",
      addressLocality: config.CITY_NAME,
      addressRegion: config.CITY_PROVINCE_CODE,
      addressCountry: config.CITY_COUNTRY_CODE,
      streetAddress: listing.displayAddress ? titleCase(listing.address.split(",")[0]) : undefined,
    },
    numberOfRooms: listing.bedrooms,
    numberOfBathroomsTotal: listing.bathrooms,
    floorSize: listing.sqft ? { "@type": "QuantitativeValue", value: listing.sqft, unitCode: "FTK" } : undefined,
    image: listing.photos[0] || undefined,
    // SCHEMA IS A PUBLISHED SURFACE. This emitted the legacy feed coordinate — 0 on every row —
    // so the structured data told Google that every home in Milton is in the Gulf of Guinea.
    // The resolved municipal rooftop, and the property is OMITTED rather than zeroed when the
    // Town has no point for the address: absent is a fact, (0,0) is a false one.
    latitude: listing.townLat ?? undefined,
    longitude: listing.townLng ?? undefined,
  };
  const offerSchema = {
    "@context": "https://schema.org",
    "@type": "Offer",
    priceCurrency: "CAD",
    price: listing.price,
    priceSpecification: isRental ? {
      "@type": "UnitPriceSpecification",
      price: listing.price,
      priceCurrency: "CAD",
      unitText: "MONTH",
    } : undefined,
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: listing.listOfficeName || "TREB MLS" },
  };
  const crumbs: Array<{ name: string; item: string }> = [
    { name: config.SITE_NAME, item: config.SITE_URL },
    { name: isRental ? "Rent" : "Buy", item: `${config.SITE_URL}/${isRental ? "rentals" : "listings"}` },
  ];
  // Only link the neighbourhood when it resolves to a published hub — otherwise omit the crumb
  // (positions renumber below) so the schema never carries a 404 URL.
  if (hubSlug) crumbs.push({ name: hoodName, item: `${config.SITE_URL}/neighbourhoods/${hubSlug}` });
  crumbs.push({
    name: listing.displayAddress ? titleCase(listing.address.split(",")[0]) : listing.mlsNumber,
    item: `${config.SITE_URL}/listings/${listing.mlsNumber}`,
  });
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };

  return (
    <SiteChrome>
    <div className="min-h-screen bg-[#fffdfa]">
      <SchemaScript schemas={[residenceSchema, offerSchema, breadcrumbSchema]} />

      {/* Breadcrumbs */}
      <div className="bg-white border-b border-[#dfe0dc] px-5 sm:px-11 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[#6b6f6a] max-w-6xl mx-auto">
          <Link href="/" className="hover:text-[#073126]">{config.SITE_NAME}</Link>
          <span>›</span>
          <Link href={isRental ? "/rentals" : "/listings"} className="hover:text-[#073126]">{isRental ? "Rent" : "Buy"}</Link>
          <span>›</span>
          <span className="text-[#6b6f6a]">{hoodName}</span>
          <span>›</span>
          <span className="text-[#3e423f] font-medium">
            {listing.displayAddress ? titleCase(listing.address.split(",")[0]) : "Address on request"}
          </span>
        </div>
      </div>

      <ListingDetailClient
        listing={serialized}
        similar={serializedSimilar}
        extras={{
          soldCountOnStreet,
          soldCountInHood,
          hoodName,
          rent: rentFigure,
          schools: schoolsLite,
          domDays,
        }}
      />
    </div>
    </SiteChrome>
  );
}
