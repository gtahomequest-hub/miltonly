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
import { isPublicListing, stripVowFields, PUBLIC_SALE_WHERE, PUBLIC_LEASE_WHERE } from "@/lib/listings/vow";
import ListingVowFacts from "@/components/listings/ListingVowFacts";
import { resolvePublishedHubSlug } from "@/lib/hubResolve";
import { isOurBrokerage } from "@/components/listings/ListingBrokerage";

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

// MC-036 item 1: InternetAddressDisplayYN=N (Listing.displayAddress=false) withholds the
// address, the street name, the unit, the postal code and any map position, not only the
// address line. redactAddress (display-gate.ts) blanks the address; this view takes the rest
// off the row before anything reads it, so the client payload carries no street identity
// (streetSlug, streetName, crossStreet) and no rooftop (townLat, townLng), the schema emits no
// coordinate, and nothing downstream can name the street or place the home. The row still
// counts wherever it is counted; on this surface it is not placed, mapped, addressed or tied to
// its street.
type WithheldFields = {
  streetSlug: string | null; streetName: string | null; crossStreet: string | null;
  townLat: number | null; townLng: number | null; latitude: number; longitude: number;
  virtualTourUrl: string | null; description: string | null;
};
function withheldView<T extends WithheldFields & { displayAddress: boolean; address: string }>(
  row: T,
): Omit<T, keyof WithheldFields> & WithheldFields {
  if (row.displayAddress) return row;
  return {
    ...row,
    streetSlug: null, streetName: null, crossStreet: null, townLat: null, townLng: null,
    // the feed's own coordinate columns (0/0 today, a rooftop if the feed ever sends one) and the
    // tour URL, whose path names the civic address
    latitude: 0, longitude: 0, virtualTourUrl: null,
    description: redactRemarks(row.description, row.address, row.streetName),
  };
}

// The listing brokerage sometimes writes the address into its own remarks ("Welcome to 120
// Hanson Crescent"), which is how a withheld page carried the address beside "Address on
// request". For a withheld row the remarks are masked where they name the house or the street:
// the house number with the street's name, the street's name with its suffix, and a postal
// code. The rest stays the brokerage's words, and the client labels the block as masked.
const STREET_SUFFIX =
  "(?:Avenue|Ave|Boulevard|Blvd|Circle|Cir|Close|Common|Court|Crt|Ct|Crescent|Cres|Drive|Dr|Gate|Grove|Grv|Heights|Hts|Hollow|Hllw|Lane|Ln|Line|Mews|Path|Place|Pl|Road|Rd|Row|Square|Sq|Street|St|Terrace|Terr|Ter|Trail|Trl|Way)\\.?";
const SUFFIX_WORD = new RegExp(`^${STREET_SUFFIX}$`, "i");
const DIRECTION_WORD = /^(?:N|S|E|W|North|South|East|West)$/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function redactRemarks(description: string | null, address: string, streetName: string | null): string | null {
  if (!description) return description;
  // The street segment of the feed's address, the unit prefixes and parentheticals dropped:
  // "120 Hanson Crescent", "480 Gordon Krantz Avenue 314", "1204-38 Main Street" -> "38 Main Street".
  const street = address.split(",")[0]
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^(?:unit|suite|apt|apartment|ph|penthouse|#)\s*\w+\s*[-–]\s*/i, "")
    .replace(/^\d{1,6}-/, "")
    .trim();
  const number = street.match(/^(\d+[A-Za-z]?)\s/)?.[1] ?? null;
  // The street's name without its suffix or direction: Listing.streetName ("Hanson Cres") when
  // the row has one, else the address segment less its number and any trailing unit number.
  const words = (streetName ?? street.replace(/^\d+[A-Za-z]?\s+/, "")).replace(/\s+\d+$/, "").split(/\s+/).filter(Boolean);
  if (words.length > 1 && DIRECTION_WORD.test(words[words.length - 1])) words.pop();
  if (words.length > 1 && SUFFIX_WORD.test(words[words.length - 1])) words.pop();
  const name = words.map(escapeRe).join("\\s+");
  const patterns: RegExp[] = [];
  if (name) {
    if (number) patterns.push(new RegExp(`\\b${number}\\s*[-–]?\\s*${name}\\b(?:\\s+${STREET_SUFFIX})?`, "gi"));
    patterns.push(new RegExp(`\\b${name}\\s+${STREET_SUFFIX}(?![A-Za-z])`, "gi"));
  }
  patterns.push(/\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/g);
  return patterns.reduce((s, re) => s.replace(re, "[address withheld]"), description);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!l) return { title: "Listing Not Found" };
  // MC-029: a listing that is not advertised, or not on the market, has no public page and no
  // index entry. "Not available" says nothing about which, on purpose.
  if (!isPublicListing(l)) return { title: "Listing Not Available", robots: { index: false, follow: false } };

  const isRental = l.transactionType === "For Lease";
  const hood = cleanHood(l.neighbourhood);
  const addr = l.displayAddress ? titleCase(l.address.split(",")[0]) : "Address on request";
  const typeLabel = titleCase(l.propertyType);
  const priceStr = `$${l.price.toLocaleString()}${isRental ? "/mo" : ""}`;

  const title = isRental
    ? `${addr}: ${l.bedrooms}bd ${typeLabel} for rent in ${hood} ${config.CITY_NAME} | ${priceStr}`
    : `${addr}: ${l.bedrooms}bd ${l.bathrooms}ba ${typeLabel} for sale in ${hood} ${config.CITY_NAME} | ${priceStr}`;

  // MC-029: the description no longer says "Listed N days ago". Days since the list date is the
  // listing's time on market, a VOW-only fact, and a meta description is public.
  const firstName = config.realtor.name.split(" ")[0];
  const description = isRental
    ? `${typeLabel} rental at ${addr}, ${hood}: ${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}, ${l.bathrooms} bath. ${priceStr}. Book a showing with ${firstName}, usually confirmed within the hour.`
    : `${typeLabel} for sale at ${addr}, ${hood} ${config.CITY_NAME}: ${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}, ${l.bathrooms} bath${l.sqft ? `, ${l.sqft} sqft` : ""}. ${priceStr}. Book a showing with ${firstName}, usually confirmed within the hour.`;

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
  // If permAdvertise = false, do not render the listing publicly. MC-029 widened the gate to
  // the whole public predicate: a sold, expired or leased listing is VOW data in its entirety
  // (its page says what happened to it), so it gets the same shell, with the same words, and
  // generateMetadata above marks it noindex. The shell never says which condition failed.
  if (!isPublicListing(listingRaw)) {
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

  // Redact address if displayAddress = false (keeps MLS + brokerage per RECO), and with it the
  // street identity, the rooftop and the address inside the remarks (withheldView above).
  const listing = redactAddress(withheldView(listingRaw));

  // Parallel queries.
  // Phase 2.6: the two sold-count queries (by streetSlug + soldDate, and by
  // neighbourhood + soldDate) were removed. DB1 no longer carries soldDate
  // values; the sold-count information surfaces on the page through the
  // gated StreetSoldBlock / NeighbourhoodSoldBlock fed from DB2.
  const [similarRaw, leaseMarket] = await Promise.all([
    prisma.listing.findMany({
      where: {
        // MC-029: the same public predicate as the grid. This selected by permAdvertise alone,
        // so a sold or expired listing could sit in "similar homes" with its status in the payload.
        ...(listing.transactionType === "For Lease" ? PUBLIC_LEASE_WHERE : PUBLIC_SALE_WHERE),
        propertyType: listing.propertyType,
        mlsNumber: { not: listing.mlsNumber },
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

  const similar = similarRaw.map((s) => redactAddress(withheldView(s)));
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

  // MC-029: the row is stripped of every VOW-only column BEFORE it is serialised for the client
  // component, so the RSC payload never carries a day count, a list date, a prior price or a
  // sold price. The island below fetches those for an acknowledged session.
  const serialized = JSON.parse(JSON.stringify(stripVowFields(listing)));
  const serializedSimilar = JSON.parse(JSON.stringify(similar.map(stripVowFields)));

  // Match schools by neighbourhood (no lat/lng on schools data)
  const schoolsLite = schools.map((s) => ({
    slug: s.slug, name: s.name, board: s.board as string, level: s.level as string,
    grades: s.grades, fraserScore: s.fraserScore, neighbourhood: s.neighbourhood,
  }));

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
    // Town has no point for the address: absent is a fact, (0,0) is a false one. Omitted too
    // when the address is withheld (MC-036 item 1): the rooftop of a withheld house is its
    // address as a coordinate. withheldView already nulled it; the gate is stated here as well
    // because the schema is a published surface.
    latitude: listing.displayAddress ? listing.townLat ?? undefined : undefined,
    longitude: listing.displayAddress ? listing.townLng ?? undefined : undefined,
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
    // our own office by its registered name (MC-043); every other office as the feed names it
    seller: { "@type": "Organization", name: isOurBrokerage(listing.listOfficeName) ? config.brokerage.name : listing.listOfficeName || "TREB MLS" },
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
        }}
        vowFacts={<ListingVowFacts mlsNumber={listing.mlsNumber} isRental={isRental} />}
      />
    </div>
    </SiteChrome>
  );
}
