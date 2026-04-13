import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { extractStreetName } from "@/lib/streetUtils";

interface StreetLink {
  slug: string;
  name: string;
  count: number;
}

const getSeoData = unstable_cache(
  async () => {
    // Top 60 streets by listing count
    const streetGroups = await prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: true,
      where: { permAdvertise: true },
      orderBy: { _count: { streetSlug: "desc" } },
      take: 60,
    });

    const streets: StreetLink[] = await Promise.all(
      streetGroups.map(async (s) => {
        const sample = await prisma.listing.findFirst({
          where: { streetSlug: s.streetSlug, streetName: { not: null } },
          select: { streetName: true, address: true },
        });
        const name = sample?.streetName || extractStreetName(sample?.address || s.streetSlug);
        return { slug: s.streetSlug, name, count: s._count };
      })
    );

    // Neighbourhoods
    const hoodGroups = await prisma.listing.groupBy({
      by: ["neighbourhood"],
      _count: true,
      where: { permAdvertise: true },
      orderBy: { _count: { neighbourhood: "desc" } },
    });

    const neighbourhoods = hoodGroups.map((h) => ({
      name: h.neighbourhood
        .replace(/^\d+\s*-\s*\w+\s+/, "") // Remove "1032 - FO " prefix
        .trim() || h.neighbourhood,
      fullName: h.neighbourhood,
      count: h._count,
    }));

    // Type counts
    const types = await prisma.listing.groupBy({
      by: ["propertyType"],
      _count: true,
      where: { status: "active", permAdvertise: true },
    });

    const totalStreets = await prisma.listing.groupBy({ by: ["streetSlug"], _count: true, where: { permAdvertise: true } });

    return { streets, neighbourhoods, types, totalStreets: totalStreets.length };
  },
  ["seo-link-grid"],
  { revalidate: 86400 } // 24 hours
);

export default async function SeoLinkGrid() {
  const { streets, neighbourhoods, types, totalStreets } = await getSeoData();

  return (
    <section className="bg-white border-t border-[#e9ecef] px-5 sm:px-11 py-10">
      {/* Streets */}
      <div className="mb-10">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="text-[14px] font-extrabold text-[#07111f]">
            Search homes by street in Milton
          </h3>
          <Link href="/streets" className="text-[11px] text-[#f59e0b] font-semibold hover:underline">
            View all {totalStreets} streets
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {streets.map((s) => (
            <Link
              key={s.slug}
              href={`/streets/${s.slug}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors truncate"
            >
              {s.name} real estate
            </Link>
          ))}
        </div>
      </div>

      {/* Neighbourhoods */}
      <div className="mb-10">
        <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">
          Search homes by neighbourhood in Milton
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {neighbourhoods.map((n) => (
            <Link
              key={n.fullName}
              href={`/listings?neighbourhood=${encodeURIComponent(n.name)}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors truncate"
            >
              {n.name} · Homes for sale
            </Link>
          ))}
          {neighbourhoods.map((n) => (
            <Link
              key={n.fullName + "-rent"}
              href={`/listings?neighbourhood=${encodeURIComponent(n.name)}&status=rent`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors truncate"
            >
              {n.name} · Homes for rent
            </Link>
          ))}
        </div>
      </div>

      {/* Property types */}
      <div className="mb-10">
        <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">
          Search by property type in Milton
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {types.map((t) => (
            <Link
              key={t.propertyType}
              href={`/listings?type=${t.propertyType}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors capitalize"
            >
              {t.propertyType} homes for sale ({t._count})
            </Link>
          ))}
          {types.map((t) => (
            <Link
              key={t.propertyType + "-rent"}
              href={`/listings?type=${t.propertyType}&status=rent`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors capitalize"
            >
              {t.propertyType} homes for rent
            </Link>
          ))}
        </div>
      </div>

      {/* Price ranges */}
      <div className="mb-10">
        <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">
          Search by price in Milton
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {[
            { label: "Homes under $500K", min: "", max: "500000" },
            { label: "Homes under $600K", min: "", max: "600000" },
            { label: "Homes under $700K", min: "", max: "700000" },
            { label: "Homes under $800K", min: "", max: "800000" },
            { label: "Homes $500K–$700K", min: "500000", max: "700000" },
            { label: "Homes $700K–$1M", min: "700000", max: "1000000" },
            { label: "Homes $1M–$1.5M", min: "1000000", max: "1500000" },
            { label: "Homes over $1M", min: "1000000", max: "" },
            { label: "Homes over $1.5M", min: "1500000", max: "" },
            { label: "Homes over $2M", min: "2000000", max: "" },
          ].map((p) => (
            <Link
              key={p.label}
              href={`/listings?min=${p.min}&max=${p.max}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors"
            >
              Milton {p.label.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      {/* School zones */}
      <div className="mb-6">
        <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">
          Search homes by school zone in Milton
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {[
            { name: "Craig Kielburger Secondary", q: "Craig Kielburger" },
            { name: "Bishop Reding Catholic Secondary", q: "Bishop Reding" },
            { name: "Milton District High School", q: "Milton District" },
            { name: "E.W. Foster Public School", q: "E.W. Foster" },
            { name: "Stuart E. Russel PS", q: "Stuart E. Russel" },
            { name: "Tiger Jeet Singh PS", q: "Tiger Jeet Singh" },
            { name: "Sam Sherratt PS", q: "Sam Sherratt" },
            { name: "Anne J. MacArthur PS", q: "Anne J. MacArthur" },
            { name: "Viola Desmond PS", q: "Viola Desmond" },
            { name: "Chris Hadfield PS", q: "Chris Hadfield" },
          ].map((school) => (
            <Link
              key={school.name}
              href={`/listings?q=${encodeURIComponent(school.q)}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors"
            >
              Homes near {school.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">
          More Milton real estate searches
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {[
            { label: "Milton homes for sale", href: "/listings" },
            { label: "Milton homes for rent", href: "/listings?status=rent" },
            { label: "Milton sold prices", href: "/listings?status=sold" },
            { label: "Milton street prices", href: "/streets" },
            { label: "Milton neighbourhood comparison", href: "/compare" },
            { label: "Milton rentals", href: "/rentals" },
            { label: "Milton condo buildings", href: "/condos" },
            { label: "Milton exclusive listings", href: "/exclusive" },
            { label: "What's my Milton home worth?", href: "/sell" },
            { label: "About your Milton agent", href: "/about" },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
