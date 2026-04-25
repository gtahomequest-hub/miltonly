import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { extractStreetName } from "@/lib/streetUtils";
import PersonaRouter from "./PersonaRouter";

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
      {/* New to Milton? — persona routing */}
      <PersonaRouter />

      {/* Streets — Tier A */}
      <div className="mb-10">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="text-[16px] font-extrabold text-[#07111f]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 align-middle" />
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
        <h3 className="text-[14px] font-semibold text-slate-600 mb-4">
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
        <h3 className="text-[14px] font-semibold text-slate-600 mb-4">
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

      {/* Strip 1 — between Price and School Zones */}
      <div className="border-l-4 border-amber-500 bg-slate-900/40 rounded-r-lg px-5 py-3 my-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-slate-700">🎯 Can&apos;t find what you&apos;re looking for in this list?</p>
        <a
          href="tel:6478399090"
          className="text-sm font-semibold text-amber-600 hover:underline whitespace-nowrap"
        >
          Text Aamir directly: (647) 839-9090 →
        </a>
      </div>

      {/* School zones — Tier A */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="text-[16px] font-extrabold text-[#07111f]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 align-middle" />
            Search homes by school zone in Milton
          </h3>
          <Link href="/schools" className="text-[11px] text-[#f59e0b] font-semibold hover:underline">
            View all 30+ schools
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {[
            { name: "Bishop P.F. Reding Catholic SS", slug: "bishop-pf-reding-catholic-ss" },
            { name: "Milton District High School", slug: "milton-district-high-school" },
            { name: "Elsie MacGill Secondary", slug: "elsie-macgill-secondary-school" },
            { name: "St. Francis Xavier Catholic SS", slug: "st-francis-xavier-catholic-ss" },
            { name: "Chris Hadfield PS", slug: "chris-hadfield-ps" },
            { name: "Anne J. MacArthur PS", slug: "anne-j-macarthur-ps" },
            { name: "Tiger Jeet Singh PS", slug: "tiger-jeet-singh-ps" },
            { name: "Irma Coulson PS", slug: "irma-coulson-ps" },
            { name: "E.W. Foster PS", slug: "ew-foster-ps" },
            { name: "Sam Sherratt PS", slug: "sam-sherratt-ps" },
          ].map((school) => (
            <Link
              key={school.slug}
              href={`/schools/${school.slug}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors"
            >
              Homes near {school.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Mosques */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="text-[14px] font-extrabold text-[#07111f]">
            Homes near mosques in Milton
          </h3>
          <Link href="/mosques" className="text-[11px] text-[#f59e0b] font-semibold hover:underline">
            View all mosques
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
          {[
            { name: "Halton Islamic Community Centre", slug: "halton-islamic-community-centre" },
            { name: "ICNA Milton", slug: "icna-milton" },
            { name: "Milton Muslim Community Centre", slug: "milton-muslim-community-centre" },
            { name: "Islamic Community Centre of Milton", slug: "islamic-community-centre-of-milton" },
            { name: "Milton Musalla", slug: "milton-musalla" },
          ].map((mosque) => (
            <Link
              key={mosque.slug}
              href={`/mosques/${mosque.slug}`}
              className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors"
            >
              Homes near {mosque.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Strip 2 — between Mosques and More Milton */}
      <div className="border-l-4 border-amber-500 bg-slate-900/40 rounded-r-lg px-5 py-3 my-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-slate-700">💬 Looking for something hyper-specific? (e.g. backing onto greenspace, walk-out basement, mortgage helper)</p>
        <a
          href="tel:6478399090"
          className="text-sm font-semibold text-amber-600 hover:underline whitespace-nowrap"
        >
          Tell Aamir what you need →
        </a>
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
            { label: "Milton market data", href: "/listings?status=sold" },
            { label: "Milton street prices", href: "/streets" },
            { label: "Milton neighbourhood comparison", href: "/compare" },
            { label: "Milton rentals", href: "/rentals" },
            { label: "Milton condo buildings", href: "/condos" },
            { label: "Milton exclusive listings", href: "/exclusive" },
            { label: "Mosques in Milton", href: "/mosques" },
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
