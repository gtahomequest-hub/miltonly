import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ListingDetailClient from "./ListingDetailClient";
import FooterSection from "@/components/sections/FooterSection";
import SchemaScript from "@/components/SchemaScript";
import { schools } from "@/lib/schools";
import { redactAddress } from "@/lib/listings/display-gate";

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

// Deterministic "views today" based on mlsNumber + date — stable within a day
function viewsToday(mls: string): number {
  let h = 0;
  for (let i = 0; i < mls.length; i++) h = (h * 31 + mls.charCodeAt(i)) & 0xfffff;
  const day = Math.floor(Date.now() / 86400000);
  return 12 + ((h + day) & 0xff) % 9;
}

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
    ? `${addr} — ${l.bedrooms}bd ${typeLabel} for rent in ${hood} Milton | ${priceStr}`
    : `${addr} — ${l.bedrooms}bd ${l.bathrooms}ba ${typeLabel} for sale in ${hood} Milton | ${priceStr}`;

  const days = Math.floor((Date.now() - new Date(l.listedAt).getTime()) / 86400000);
  const description = isRental
    ? `${typeLabel} rental at ${addr}, ${hood} — ${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}, ${l.bathrooms} bath. ${priceStr}. Listed ${days === 0 ? "today" : `${days} days ago`}. Book a showing with Aamir — usually confirmed within the hour.`
    : `${typeLabel} for sale at ${addr}, ${hood} Milton — ${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}, ${l.bathrooms} bath${l.sqft ? `, ${l.sqft} sqft` : ""}. ${priceStr}. Listed ${days === 0 ? "today" : `${days} days ago`}. Book a showing with Aamir — usually confirmed within the hour.`;

  return {
    title,
    description,
    alternates: { canonical: `https://miltonly.com/listings/${l.mlsNumber}` },
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

  // ─── COMPLIANCE GATE ───
  // If permAdvertise = false, do not render the listing publicly.
  if (!listingRaw.permAdvertise) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-5 py-20">
        <div className="max-w-md text-center">
          <p className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-[0.14em] mb-3">Not available</p>
          <h1 className="text-[22px] font-extrabold text-[#07111f] mb-3">This listing is not available for display</h1>
          <p className="text-[14px] text-[#64748b] mb-6">The brokerage or seller has opted out of public display for this property.</p>
          <Link href="/listings" className="text-[14px] text-[#f59e0b] font-bold hover:underline">← Browse other Milton listings</Link>
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
  const [similarRaw, hoodRentAvg] = await Promise.all([
    prisma.listing.findMany({
      where: {
        propertyType: listing.propertyType,
        transactionType: listing.transactionType,
        mlsNumber: { not: listing.mlsNumber },
        city: "Milton",
        permAdvertise: true,
      },
      orderBy: { listedAt: "desc" },
      take: 4,
    }),
    // Average rent in same neighbourhood for investor widget
    prisma.listing.aggregate({
      where: {
        transactionType: "For Lease",
        city: "Milton",
        permAdvertise: true,
        neighbourhood: { contains: cleanHood(listing.neighbourhood), mode: "insensitive" },
        price: { gt: 500, lt: 10000 },
      },
      _avg: { price: true },
    }),
  ]);
  const soldCountOnStreet = 0; // deprecated — see StreetSoldBlock on street page
  const soldCountInHood = 0; // deprecated — see NeighbourhoodSoldBlock

  const similar = similarRaw.map(redactAddress);
  const hoodAvgRent = hoodRentAvg._avg.price ? Math.round(hoodRentAvg._avg.price) : null;

  const serialized = JSON.parse(JSON.stringify(listing));
  const serializedSimilar = JSON.parse(JSON.stringify(similar));

  // Match schools by neighbourhood (no lat/lng on schools data)
  const schoolsLite = schools.map((s) => ({
    slug: s.slug, name: s.name, board: s.board as string, level: s.level as string,
    grades: s.grades, fraserScore: s.fraserScore, neighbourhood: s.neighbourhood,
  }));

  const domDays = Math.floor((Date.now() - new Date(listing.listedAt).getTime()) / 86400000);
  const views = viewsToday(listing.mlsNumber);

  // ─── SCHEMA MARKUP ───
  const isRental = listing.transactionType === "For Lease";
  const hoodName = cleanHood(listing.neighbourhood);
  const addrDisplay = listing.displayAddress ? titleCase(listing.address) : "Address on request, Milton, ON";

  const residenceSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": listing.propertyType === "condo" ? "Apartment" : "SingleFamilyResidence",
    name: addrDisplay,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Milton",
      addressRegion: "ON",
      addressCountry: "CA",
      streetAddress: listing.displayAddress ? titleCase(listing.address.split(",")[0]) : undefined,
    },
    numberOfRooms: listing.bedrooms,
    numberOfBathroomsTotal: listing.bathrooms,
    floorSize: listing.sqft ? { "@type": "QuantitativeValue", value: listing.sqft, unitCode: "FTK" } : undefined,
    image: listing.photos[0] || undefined,
    latitude: listing.latitude,
    longitude: listing.longitude,
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
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Miltonly", item: "https://miltonly.com" },
      { "@type": "ListItem", position: 2, name: isRental ? "Rent" : "Buy", item: `https://miltonly.com/${isRental ? "rentals" : "listings"}` },
      { "@type": "ListItem", position: 3, name: hoodName, item: `https://miltonly.com/neighbourhoods/${hoodName.toLowerCase().replace(/\s+/g, "-")}` },
      { "@type": "ListItem", position: 4, name: listing.displayAddress ? titleCase(listing.address.split(",")[0]) : listing.mlsNumber, item: `https://miltonly.com/listings/${listing.mlsNumber}` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <SchemaScript schemas={[residenceSchema, offerSchema, breadcrumbSchema]} />

      {/* Breadcrumbs */}
      <div className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[#94a3b8] max-w-6xl mx-auto">
          <Link href="/" className="hover:text-[#07111f]">Miltonly</Link>
          <span>›</span>
          <Link href={isRental ? "/rentals" : "/listings"} className="hover:text-[#07111f]">{isRental ? "Rent" : "Buy"}</Link>
          <span>›</span>
          <span className="text-[#64748b]">{hoodName}</span>
          <span>›</span>
          <span className="text-[#475569] font-medium">
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
          hoodAvgRent,
          schools: schoolsLite,
          viewsToday: views,
          domDays,
        }}
      />
      <FooterSection />
    </div>
  );
}
