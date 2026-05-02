import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";
import ListingsCardsClient from "./ListingsCardsClient";
import SaveSearchStrip from "./SaveSearchStrip";
import SchemaScript from "@/components/SchemaScript";
import { generateFAQSchema } from "@/lib/schema";

export const metadata = genMeta({
  title: `${config.CITY_NAME} Homes For Sale & Real Estate`,
  description: `Browse ${config.CITY_NAME} ${config.CITY_PROVINCE} homes for sale. View listing photos, property details, and neighbourhood data. Live TREB MLS® data updated daily.`,
  canonical: `${config.SITE_URL}/listings`,
});

export const revalidate = 3600;

interface Props {
  searchParams: {
    type?: string; status?: string; min?: string; max?: string; maxPrice?: string;
    beds?: string; baths?: string; sort?: string; page?: string; q?: string;
    neighbourhood?: string; openHouse?: string;
  };
}

const PER_PAGE = 36;

const NEIGHBOURHOOD_FILTER_OPTIONS = [
  "Dempsey", "Beaty", "Willmott", "Hawthorne Village", "Timberlea", "Old Milton",
  "Coates", "Clarke", "Scott", "Harrison", "Ford", "Walker", "Cobban",
];

const FOOTER_NEIGHBOURHOODS = ["Dempsey", "Beaty", "Willmott", "Hawthorne Village", "Timberlea", "Old Milton"];

const FEATURED_SCHOOLS = [
  { slug: "chris-hadfield-ps", name: "Chris Hadfield PS", board: "Public", neighbourhood: "Dempsey", fraser: null as string | null },
  { slug: "bishop-pf-reding-catholic-secondary-school", name: "Bishop P.F. Reding", board: "Catholic", neighbourhood: "Old Milton", fraser: "8.0" as string | null },
  { slug: "guardian-angels-catholic-es", name: "Guardian Angels Catholic ES", board: "Catholic", neighbourhood: "Milton", fraser: null as string | null },
  { slug: "irma-coulson-ps", name: "Irma Coulson PS", board: "Public", neighbourhood: "Beaty", fraser: null as string | null },
];

function titleCaseHood(h: string) {
  const cleaned = h.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function ListingsPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const skip = (page - 1) * PER_PAGE;

  const where: Record<string, unknown> = { city: config.PRISMA_CITY_VALUE, permAdvertise: true };
  if (searchParams.type && searchParams.type !== "all") where.propertyType = searchParams.type;
  if (searchParams.status === "rent") where.transactionType = "For Lease";
  else if (searchParams.status === "sold") where.status = "sold";
  else where.status = "active";
  if (searchParams.min) where.price = { ...(where.price as object || {}), gte: parseInt(searchParams.min) };
  if (searchParams.max || searchParams.maxPrice) {
    const maxVal = parseInt(searchParams.maxPrice || searchParams.max || "0");
    where.price = { ...(where.price as object || {}), lte: maxVal };
  }
  if (searchParams.beds) where.bedrooms = parseInt(searchParams.beds);
  if (searchParams.baths) where.bathrooms = { gte: parseInt(searchParams.baths) };
  if (searchParams.neighbourhood) where.neighbourhood = { contains: searchParams.neighbourhood, mode: "insensitive" };
  if (searchParams.q) {
    where.OR = [
      { address: { contains: searchParams.q, mode: "insensitive" } },
      { neighbourhood: { contains: searchParams.q, mode: "insensitive" } },
      { mlsNumber: { contains: searchParams.q, mode: "insensitive" } },
      { description: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }

  let orderBy: Record<string, string> = { listedAt: "desc" };
  if (searchParams.sort === "price_asc") orderBy = { price: "asc" };
  if (searchParams.sort === "price_desc") orderBy = { price: "desc" };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeBase = { status: "active", city: config.PRISMA_CITY_VALUE, permAdvertise: true } as const;

  const [
    listings,
    totalCount,
    avgPriceAgg,
    domAgg,
    newThisWeek,
    neighbourhoodStats,
    topStreets,
  ] = await Promise.all([
    prisma.listing.findMany({
      where, orderBy, skip, take: PER_PAGE,
      select: {
        mlsNumber: true, address: true, price: true, bedrooms: true, bathrooms: true,
        sqft: true, propertyType: true, status: true, transactionType: true, photos: true,
        listedAt: true, neighbourhood: true, daysOnMarket: true, listOfficeName: true,
      },
    }),
    prisma.listing.count({ where }),
    prisma.listing.aggregate({ where: activeBase, _avg: { price: true } }),
    prisma.listing.aggregate({ where: { ...activeBase, daysOnMarket: { gt: 0 } }, _avg: { daysOnMarket: true } }),
    prisma.listing.count({ where: { ...activeBase, listedAt: { gte: sevenDaysAgo } } }),
    prisma.listing.groupBy({
      by: ["neighbourhood"],
      _count: true,
      _avg: { price: true },
      where: activeBase,
      orderBy: { _count: { neighbourhood: "desc" } },
      take: 30,
    }),
    prisma.listing.groupBy({
      by: ["streetSlug", "streetName"],
      _count: true,
      where: { ...activeBase, streetName: { not: null } },
      orderBy: { _count: { streetSlug: "desc" } },
      take: 6,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const statusLabel = searchParams.status === "rent" ? "for rent" : searchParams.status === "sold" ? "sold" : "for sale";
  const avg = Math.round(avgPriceAgg._avg.price || 0);
  const avgDom = Math.round(domAgg._avg.daysOnMarket || 0);

  // De-duplicate neighbourhood stats (TREB has versions like "1035 - Old Milton")
  const hoodMap = new Map<string, { count: number; avgSum: number; avgN: number }>();
  for (const h of neighbourhoodStats) {
    const name = titleCaseHood(h.neighbourhood);
    if (!name) continue;
    const existing = hoodMap.get(name);
    const avgPrice = h._avg.price || 0;
    if (existing) {
      existing.count += h._count;
      existing.avgSum += avgPrice * h._count;
      existing.avgN += h._count;
    } else {
      hoodMap.set(name, { count: h._count, avgSum: avgPrice * h._count, avgN: h._count });
    }
  }
  const topNeighbourhoods = Array.from(hoodMap.entries())
    .filter(([name]) => name && name.toLowerCase() !== config.CITY_NAME.toLowerCase())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      avg: stats.avgN > 0 ? Math.round(stats.avgSum / stats.avgN) : 0,
    }));

  const faqs = [
    {
      question: `How many homes are for sale in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `There are currently ${totalCount} homes ${statusLabel} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}. Listings update daily from TREB MLS® data and include detached homes, semis, townhouses, and condos across every ${config.CITY_NAME} neighbourhood.`,
    },
    {
      question: `What is the average home price in ${config.CITY_NAME}?`,
      answer: `The average asking price for a ${config.CITY_NAME} home right now is ${formatPriceFull(avg)}. Prices range widely by property type and neighbourhood — detached homes in established areas like Old ${config.CITY_NAME} sit higher, while condos and townhouses in newer subdivisions can come in considerably lower.`,
    },
    {
      question: `What neighbourhoods are in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME}'s main residential neighbourhoods include Dempsey, Beaty, Willmott, Hawthorne Village, Timberlea, Old ${config.CITY_NAME}, Coates, Clarke, Scott, Harrison, Ford, Walker, and Cobban. Each has its own mix of housing stock, schools, and price points — use the neighbourhood filter to narrow your search.`,
    },
    {
      question: `How do I book a showing for a ${config.CITY_NAME} home?`,
      answer: `Click "Book showing" on any listing card and ${config.realtor.name} — a licensed ${config.brokerage.name.replace(", Brokerage", "")} agent based in ${config.CITY_NAME} — will confirm your appointment within the hour. No obligation, no pressure.`,
    },
  ];

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `About ${config.CITY_NAME} ${config.CITY_PROVINCE} Real Estate`,
    description: `An overview of the ${config.CITY_NAME} real estate market — growth, property mix, and why working with a local specialist matters.`,
    author: { "@type": "Person", name: config.realtor.name },
    publisher: { "@type": "Organization", name: config.SITE_NAME },
    datePublished: "2026-04-01",
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <>
      <SchemaScript schemas={[generateFAQSchema(faqs), articleSchema]} />

      <div className="min-h-screen bg-white">
        {/* ═══ HEADER + SNAPSHOT + FILTERS ═══ */}
        <div className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11 py-5">
          <div className="max-w-7xl mx-auto">
            {/* ═══ MODE TABS — Active / Rent / Sold ═══ */}
            <div className="flex gap-2 mb-5">
              {[
                { label: "For Sale", href: "/listings", active: searchParams.status !== "rent" && searchParams.status !== "sold" },
                { label: "For Rent", href: "/listings?status=rent", active: searchParams.status === "rent" },
                { label: "Sold", href: "/sold", active: false },
              ].map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className={`text-[12px] font-bold px-4 py-2 rounded-full border transition-colors ${
                    t.active
                      ? "bg-[#07111f] text-white border-[#07111f]"
                      : "bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8f9fb]"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            <h1 className="text-[30px] font-extrabold text-[#07111f] tracking-[-0.5px] mb-1 leading-tight">
              {config.CITY_NAME} homes {statusLabel} &amp; real estate
            </h1>
            <p className="text-[14px] text-[#64748b] mb-4">{totalCount} homes · Live TREB MLS® data</p>

            {/* Market snapshot bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-[#07111f] rounded-lg px-4 py-3">
                <p className="text-[18px] font-extrabold text-white tracking-[-0.3px]">{formatPriceFull(avg)}</p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 font-medium">Avg asking price</p>
              </div>
              <div className="bg-[#07111f] rounded-lg px-4 py-3">
                <p className="text-[18px] font-extrabold text-white tracking-[-0.3px]">{avgDom || "—"}{avgDom ? " days" : ""}</p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 font-medium">Avg DOM</p>
              </div>
              <div className="bg-[#07111f] rounded-lg px-4 py-3">
                <p className="text-[18px] font-extrabold text-white tracking-[-0.3px]">{newThisWeek}</p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 font-medium">New this week</p>
              </div>
              <div className="bg-[#07111f] rounded-lg px-4 py-3">
                <p className="text-[18px] font-extrabold text-white tracking-[-0.3px]">{totalCount}</p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 font-medium">Active listings</p>
              </div>
            </div>

            <form className="flex flex-wrap items-center gap-2">
              <select name="status" defaultValue={searchParams.status || "active"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#07111f] font-semibold cursor-pointer">
                <option value="active">For sale</option>
                <option value="rent">For rent</option>
                <option value="sold">Sold</option>
              </select>
              <select name="type" defaultValue={searchParams.type || "all"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="all">All types</option>
                <option value="detached">Detached</option>
                <option value="semi">Semi</option>
                <option value="townhouse">Townhouse</option>
                <option value="condo">Condo</option>
              </select>
              <select name="min" defaultValue={searchParams.min || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="">No min</option>
                {[300000,400000,500000,600000,700000,800000,900000,1000000,1200000,1500000].map(p => (
                  <option key={p} value={p}>{formatPriceFull(p)}</option>
                ))}
              </select>
              <span className="text-[11px] text-[#94a3b8]">–</span>
              <select name="max" defaultValue={searchParams.max || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="">No max</option>
                {[500000,600000,700000,800000,900000,1000000,1200000,1500000,2000000,3000000].map(p => (
                  <option key={p} value={p}>{formatPriceFull(p)}</option>
                ))}
              </select>
              <select name="beds" defaultValue={searchParams.beds || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="">Beds</option>
                {[1,2,3,4,5].map(b => <option key={b} value={b}>{b}+</option>)}
              </select>
              <select name="baths" defaultValue={searchParams.baths || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="">Baths</option>
                {[1,2,3].map(b => <option key={b} value={b}>{b}+</option>)}
              </select>
              <select name="neighbourhood" defaultValue={searchParams.neighbourhood || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="">All neighbourhoods</option>
                {NEIGHBOURHOOD_FILTER_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#475569] border border-[#e2e8f0] rounded-lg px-3 py-2.5 cursor-pointer hover:border-[#07111f] transition-colors">
                <input type="checkbox" name="openHouse" value="1" defaultChecked={!!searchParams.openHouse} className="accent-[#f59e0b]" />
                Open houses
              </label>
              <button type="submit" className="text-[12px] bg-[#07111f] text-[#f59e0b] font-bold px-5 py-2.5 rounded-lg hover:bg-[#0c1e35] transition-colors">Apply</button>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#94a3b8]">Sort:</span>
                <select name="sort" defaultValue={searchParams.sort || "newest"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                </select>
              </div>
            </form>
          </div>
        </div>

        {/* ═══ SAVE SEARCH STRIP ═══ */}
        <SaveSearchStrip
          type={searchParams.type}
          status={searchParams.status}
          neighbourhood={searchParams.neighbourhood}
          min={searchParams.min}
          max={searchParams.max}
          beds={searchParams.beds}
          baths={searchParams.baths}
          openHouse={searchParams.openHouse}
        />

        {/* ═══ LISTINGS GRID ═══ */}
        <div className="max-w-7xl mx-auto px-5 sm:px-11 py-6">
          {listings.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[16px] font-bold text-[#07111f] mb-2">No homes match your filters</p>
              <p className="text-[13px] text-[#64748b] mb-4">Try adjusting your search criteria.</p>
              <Link href="/listings" className="text-[13px] text-[#2563eb] font-semibold hover:underline">Clear all filters</Link>
            </div>
          ) : (
            <ListingsCardsClient listings={JSON.parse(JSON.stringify(listings))} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10 pt-8 border-t border-[#e2e8f0]">
              {page > 1 && (
                <Link href={{ pathname: "/listings", query: { ...searchParams, page: String(page - 1) } }} className="text-[13px] bg-white border border-[#e2e8f0] rounded-lg px-5 py-2.5 text-[#475569] font-medium hover:border-[#07111f] transition-colors">
                  ← Previous
                </Link>
              )}
              <span className="text-[13px] text-[#94a3b8]">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <Link href={{ pathname: "/listings", query: { ...searchParams, page: String(page + 1) } }} className="text-[13px] bg-white border border-[#e2e8f0] rounded-lg px-5 py-2.5 text-[#475569] font-medium hover:border-[#07111f] transition-colors">
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ═══ SECTION 1 — NEIGHBOURHOOD QUICK LINKS ═══ */}
        {topNeighbourhoods.length > 0 && (
          <div className="bg-[#07111f] px-5 sm:px-11 py-10">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-[22px] font-extrabold text-white mb-6">Browse {config.CITY_NAME} by neighbourhood</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topNeighbourhoods.map((h) => (
                  <Link
                    key={h.name}
                    href={`/listings?neighbourhood=${encodeURIComponent(h.name)}`}
                    className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-5 hover:border-[#f59e0b] transition-colors group"
                  >
                    <p className="text-[16px] font-bold text-[#f8f9fb] group-hover:text-[#f59e0b] transition-colors">{h.name}</p>
                    <p className="text-[12px] text-[#94a3b8] mt-1">{h.count} active listing{h.count === 1 ? "" : "s"}</p>
                    {h.avg > 0 && <p className="text-[14px] font-bold text-[#cbd5e1] mt-2">{formatPriceFull(h.avg)} avg</p>}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SECTION 2 — TOP STREETS STRIP ═══ */}
        {topStreets.length > 0 && (
          <div className="bg-[#0c1e35] px-5 sm:px-11 py-10 border-t border-[#1e3a5f]">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-[22px] font-extrabold text-white mb-6">Top {config.CITY_NAME} streets right now</h2>
              <div className="flex flex-wrap gap-2">
                {topStreets.map((s) => (
                  <Link
                    key={s.streetSlug}
                    href={`/streets/${s.streetSlug}`}
                    className="bg-[#07111f] border border-[#1e3a5f] rounded-full px-4 py-2 text-[13px] font-medium text-[#cbd5e1] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                  >
                    {s.streetName}
                    <span className="text-[#94a3b8] ml-2">· {s._count} active</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SECTION 3 — SCHOOL ZONE LINKS ═══ */}
        <div className="bg-[#f8f9fb] px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-[22px] font-extrabold text-[#07111f] mb-6">Find homes near top-rated schools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURED_SCHOOLS.map((s) => {
                const hoodStat = topNeighbourhoods.find((h) => h.name === s.neighbourhood);
                return (
                  <Link
                    key={s.slug}
                    href={`/schools/${s.slug}`}
                    className="bg-white border border-[#e2e8f0] rounded-xl p-5 hover:shadow-md hover:border-[#07111f] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[16px] font-bold text-[#07111f]">{s.name}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${s.board === "Public" ? "bg-[#dbeafe] text-[#1e40af]" : "bg-[#fef3c7] text-[#92400e]"}`}>
                        {s.board}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748b]">{s.neighbourhood}</p>
                    <div className="flex items-center gap-3 mt-2 text-[12px]">
                      {s.fraser && <span className="text-[#15803d] font-semibold">Fraser {s.fraser}/10</span>}
                      {hoodStat && <span className="text-[#64748b]">{hoodStat.count} nearby listings</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ SECTION 4 — SAVE SEARCH CTA ═══ */}
        <div className="bg-white px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[18px] font-extrabold text-[#07111f] mb-2">Create a free account to save searches and get deal alerts</p>
            <p className="text-[14px] text-[#64748b] mb-5">We&apos;ll email you the moment a new {config.CITY_NAME} listing matches your filters — before it hits any other site.</p>
            <Link href="/signin" className="inline-block bg-[#07111f] text-[#f59e0b] text-[14px] font-bold px-6 py-3 rounded-lg hover:bg-[#0c1e35] transition-colors">
              Sign up free →
            </Link>
          </div>
        </div>

        {/* ═══ SECTION 5 — SEO CONTENT ═══ */}
        <article className="bg-white px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-[800px] mx-auto">
            <h2 className="text-[24px] font-extrabold text-[#07111f] mb-4">About {config.CITY_NAME} real estate</h2>
            <div className="space-y-4 text-[15px] text-[#475569] leading-[1.7]">
              <p>
                {config.CITY_NAME} has been one of Canada&apos;s fastest-growing communities for two decades, and the pace hasn&apos;t really let up. Between the GO train expansion, the Boyne and Agerton build-out, and new campus infrastructure coming online, the pool of people arriving here each year keeps the resale market competitive. What that means for buyers is simple: inventory moves quickly, the good homes get multiple offers, and knowing which neighbourhoods to shortlist is half the work.
              </p>
              <p>
                The property mix is unusually wide for a town this size. You can be looking at a 2005 detached in Timberlea, a brand-new Mattamy townhouse in Walker, or a low-rise condo right off the GO station — all in the same afternoon. Price points spread across a similar range. Entry-level condos start in the high $400K window; established detached streets in Dempsey and Hawthorne Village routinely clear $1.2M. Understanding that spread — and what each pocket actually trades at right now — is where a local agent makes the biggest difference.
              </p>
              <p>
                That&apos;s where working with someone who only sells {config.CITY_NAME} matters. {config.realtor.name} has been with {config.brokerage.name.replace(", Brokerage", "")} full-time for {config.realtor.yearsExperience} years and has closed on every street you&apos;ll scroll past. {config.realtor.name.split(" ")[0]}&apos;ll tell you which townhouse has a rental parking spot included, which street backs onto a park that floods, and which condo building has a maintenance fee about to jump. Call {config.realtor.phone} or tap Book showing on any listing — confirmed within the hour, no obligation.
              </p>
            </div>
          </div>
        </article>

        {/* ═══ SECTION 6 — FAQ ═══ */}
        <div className="bg-[#f8f9fb] px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-[22px] font-extrabold text-[#07111f] mb-6">Frequently asked questions</h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl p-5">
                  <h3 className="text-[15px] font-bold text-[#07111f] mb-2">{faq.question}</h3>
                  <p className="text-[13px] text-[#64748b] leading-[1.65]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <footer className="bg-[#07111f] px-5 sm:px-11 py-12 border-t border-[#1e3a5f]">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-8">
              <div>
                <h4 className="text-[13px] font-bold text-[#f59e0b] uppercase tracking-[0.12em] mb-4">Popular searches</h4>
                <ul className="space-y-2">
                  <li><Link href="/listings?type=detached" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Detached homes</Link></li>
                  <li><Link href="/listings?type=townhouse" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Townhouses</Link></li>
                  <li><Link href="/listings?type=condo" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Condos</Link></li>
                  <li><Link href="/listings?max=700000" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Under $700K</Link></li>
                  <li><Link href="/listings?status=sold" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Sold prices</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#f59e0b] uppercase tracking-[0.12em] mb-4">{config.CITY_NAME} neighbourhoods</h4>
                <ul className="space-y-2">
                  {FOOTER_NEIGHBOURHOODS.map((n) => (
                    <li key={n}>
                      <Link href={`/listings?neighbourhood=${encodeURIComponent(n)}`} className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">{n}</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-[#f59e0b] uppercase tracking-[0.12em] mb-4">Quick links</h4>
                <ul className="space-y-2">
                  <li><Link href="/streets" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Streets</Link></li>
                  <li><Link href="/schools" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Schools</Link></li>
                  <li><Link href="/mosques" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Mosques</Link></li>
                  <li><Link href="/rentals" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Rentals</Link></li>
                  <li><Link href="/sell" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">Sell</Link></li>
                  <li><Link href="/about" className="text-[13px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors">About</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-[#1e3a5f] pt-6 text-[12px] text-[#64748b] text-center">
              {config.realtor.name} · {config.brokerage.name.replace(", Brokerage", "")} · {config.CITY_NAME} {config.CITY_PROVINCE} · <a href={`tel:${config.realtor.phoneE164}`} className="text-[#f59e0b] hover:underline">{config.realtor.phone}</a>
            </div>
            <p className="text-[10px] text-[#475569] text-center mt-4 max-w-3xl mx-auto leading-relaxed">
              Data provided by TREB via {config.SITE_NAME}. MLS® listings updated daily. Information is deemed reliable but not guaranteed.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
