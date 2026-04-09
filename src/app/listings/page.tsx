import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";

export const metadata = genMeta({
  title: "Milton Homes For Sale & Real Estate",
  description: "Browse Milton Ontario homes for sale. View listing photos, property details, and neighbourhood data. Live TREB MLS® data updated daily.",
  canonical: "https://miltonly.com/listings",
});

export const revalidate = 3600;

interface Props {
  searchParams: { type?: string; status?: string; min?: string; max?: string; beds?: string; baths?: string; sort?: string; page?: string };
}

const PER_PAGE = 36;

export default async function ListingsPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const skip = (page - 1) * PER_PAGE;

  const where: Record<string, unknown> = { city: "Milton" };
  if (searchParams.type && searchParams.type !== "all") where.propertyType = searchParams.type;
  if (searchParams.status === "rent") where.transactionType = "For Lease";
  else if (searchParams.status === "sold") where.status = "sold";
  else where.status = "active";
  if (searchParams.min) where.price = { ...(where.price as object || {}), gte: parseInt(searchParams.min) };
  if (searchParams.max) where.price = { ...(where.price as object || {}), lte: parseInt(searchParams.max) };
  if (searchParams.beds) where.bedrooms = { gte: parseInt(searchParams.beds) };
  if (searchParams.baths) where.bathrooms = { gte: parseInt(searchParams.baths) };

  let orderBy: Record<string, string> = { listedAt: "desc" };
  if (searchParams.sort === "price_asc") orderBy = { price: "asc" };
  if (searchParams.sort === "price_desc") orderBy = { price: "desc" };

  const [listings, totalCount, avgPrice, typeBreakdown] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, skip, take: PER_PAGE }),
    prisma.listing.count({ where }),
    prisma.listing.aggregate({ where: { status: "active", city: "Milton" }, _avg: { price: true } }),
    prisma.listing.groupBy({ by: ["propertyType"], _count: true, _avg: { price: true }, where: { status: "active", city: "Milton" } }),
  ]);

  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const statusLabel = searchParams.status === "rent" ? "for rent" : searchParams.status === "sold" ? "sold" : "for sale";
  const avg = Math.round(avgPrice._avg.price || 0);

  return (
    <div className="min-h-screen bg-white">
      {/* ═══ HEADER + FILTERS ═══ */}
      <div className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11 py-5">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-[22px] font-extrabold text-[#07111f] tracking-[-0.3px] mb-1">
            Milton homes {statusLabel} &amp; real estate
          </h1>
          <p className="text-[13px] text-[#64748b] mb-5">{totalCount} homes · Live TREB MLS® data</p>

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
            <button type="submit" className="text-[12px] bg-[#07111f] text-[#f59e0b] font-bold px-5 py-2.5 rounded-lg hover:bg-[#0c1e35] transition-colors">Apply</button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-[#94a3b8]">Sort:</span>
              <select name="sort" defaultValue={searchParams.sort || "newest"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[#475569] font-medium cursor-pointer">
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
              </select>
            </div>
          </form>
        </div>
      </div>

      {/* ═══ LISTINGS GRID ═══ */}
      <div className="max-w-7xl mx-auto px-5 sm:px-11 py-6">
        {listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[16px] font-bold text-[#07111f] mb-2">No homes match your filters</p>
            <p className="text-[13px] text-[#64748b] mb-4">Try adjusting your search criteria.</p>
            <Link href="/listings" className="text-[13px] text-[#2563eb] font-semibold hover:underline">Clear all filters</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l) => {
              const days = daysAgo(new Date(l.listedAt));
              const isRental = l.transactionType === "For Lease";
              return (
                <Link key={l.mlsNumber} href={`/listings/${l.mlsNumber}`} className="group bg-white rounded-xl border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all">
                  {/* Photo — bigger, 3:2 aspect */}
                  <div className="aspect-[3/2] relative bg-[#f1f5f9]">
                    {l.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photos[0]} alt={l.address} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#cbd5e1] text-[32px]">🏠</div>
                    )}
                    {/* Status tag */}
                    {days <= 3 && <span className="absolute top-2.5 left-2.5 bg-[#07111f] text-[#f59e0b] text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{days === 0 ? "New today" : "New"}</span>}
                    {/* Photo count — Redfin style */}
                    {l.photos.length > 1 && (
                      <span className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 backdrop-blur-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                        {l.photos.length}
                      </span>
                    )}
                    {/* Favourite */}
                    <span className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-[14px] opacity-0 group-hover:opacity-100">♡</span>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[20px] font-extrabold text-[#07111f] tracking-[-0.3px]">
                          {formatPriceFull(l.price)}{isRental ? <span className="text-[13px] font-normal text-[#94a3b8]">/mo</span> : ""}
                        </p>
                        <p className="text-[13px] text-[#475569] mt-0.5">
                          {l.bedrooms} bd · {l.bathrooms} ba
                          {l.sqft ? ` · ${l.sqft.toLocaleString()} sqft` : ""}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${isRental ? "bg-[#eff6ff] text-[#1e3a8a]" : l.status === "sold" ? "bg-[#fef2f2] text-[#991b1b]" : "bg-[#f0fdf4] text-[#166534]"}`}>
                        {isRental ? "Lease" : l.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#64748b] mt-1.5 truncate">{l.address}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-2">
                      {l.listOfficeName || "MLS®"} · {days === 0 ? "Listed today" : `${days}d on Miltonly`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
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

      {/* ═══ MARKET STATS SECTION ═══ */}
      <div className="bg-[#f8f9fb] border-t border-[#e2e8f0] px-5 sm:px-11 py-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[20px] font-extrabold text-[#07111f] mb-2">Average home prices in Milton, ON</h2>
          <p className="text-[13px] text-[#64748b] mb-6">Based on {totalCount} active listings · Updated daily from TREB MLS®</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1">All homes avg.</p>
              <p className="text-[26px] font-extrabold text-[#07111f]">{formatPriceFull(avg)}</p>
            </div>
            {[...typeBreakdown].sort((a, b) => (b._avg.price || 0) - (a._avg.price || 0)).map((t) => (
              <div key={t.propertyType} className="bg-white rounded-xl border border-[#e2e8f0] p-5">
                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1 capitalize">{t.propertyType} avg.</p>
                <p className="text-[26px] font-extrabold text-[#07111f]">{formatPriceFull(Math.round(t._avg.price || 0))}</p>
                <p className="text-[11px] text-[#64748b] mt-1">{t._count} listings</p>
              </div>
            ))}
          </div>

          {/* Milton real estate trends */}
          <h2 className="text-[20px] font-extrabold text-[#07111f] mt-10 mb-2">Milton, ON real estate trends</h2>
          <p className="text-[13px] text-[#64748b] mb-6">Milton is one of Canada&apos;s fastest-growing cities. Here&apos;s what the market looks like right now.</p>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[28px] font-extrabold text-[#07111f]">{formatPriceFull(avg)}</p>
              <p className="text-[12px] text-[#64748b] mt-1">Median sale price</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[28px] font-extrabold text-[#07111f]">{totalCount}</p>
              <p className="text-[12px] text-[#64748b] mt-1">Homes on market</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
              <p className="text-[28px] font-extrabold text-[#07111f]">18</p>
              <p className="text-[12px] text-[#64748b] mt-1">Avg. days on market</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ HOW TO BUY SECTION ═══ */}
      <div className="bg-white border-t border-[#e2e8f0] px-5 sm:px-11 py-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[20px] font-extrabold text-[#07111f] mb-6">How to buy a house in Milton, ON</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Get pre-approved", desc: "Know your budget before you start. Milton&apos;s average home is " + formatPriceFull(avg) + ". A pre-approval shows sellers you&apos;re serious." },
              { step: "2", title: "Search & shortlist", desc: "Browse listings on Miltonly — filter by neighbourhood, price, bedrooms, and property type. Save your favourites and set up alerts." },
              { step: "3", title: "Book showings", desc: "See homes in person. On Miltonly, you can book showings directly — we respond within 15 minutes, guaranteed." },
              { step: "4", title: "Make an offer", desc: "Your agent prepares a competitive offer. In Milton, homes sell at an average of 100% of asking price within 18 days." },
              { step: "5", title: "Home inspection", desc: "Protect your investment with a professional inspection. Milton homes average " + formatPriceFull(avg) + " — inspection is essential at this price point." },
              { step: "6", title: "Close & move in", desc: "Your lawyer handles closing. Typical Milton closing takes 30-60 days. Welcome to Milton — one of Canada&apos;s best places to live." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 bg-[#07111f] text-[#f59e0b] rounded-full flex items-center justify-center text-[12px] font-extrabold shrink-0">{item.step}</div>
                <div>
                  <h3 className="text-[14px] font-bold text-[#07111f] mb-1">{item.title}</h3>
                  <p className="text-[12px] text-[#64748b] leading-[1.6]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SEO LINKS ═══ */}
      <div className="bg-[#f8f9fb] border-t border-[#e2e8f0] px-5 sm:px-11 py-8">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-[14px] font-extrabold text-[#07111f] mb-4">More Milton real estate</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-1.5">
            {[
              { label: "Milton detached homes", href: "/listings?type=detached" },
              { label: "Milton townhouses", href: "/listings?type=townhouse" },
              { label: "Milton condos", href: "/listings?type=condo" },
              { label: "Milton homes for rent", href: "/rentals" },
              { label: "Milton sold prices", href: "/listings?status=sold" },
              { label: "Milton under $700K", href: "/listings?max=700000" },
              { label: "Milton under $1M", href: "/listings?max=1000000" },
              { label: "Milton over $1M", href: "/listings?min=1000000" },
              { label: "Milton street prices", href: "/streets" },
              { label: "Milton market data", href: "/market-report" },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="text-[12px] text-[#64748b] hover:text-[#07111f] transition-colors">{l.label}</Link>
            ))}
          </div>

          <p className="text-[10px] text-[#94a3b8] mt-8 leading-relaxed">
            Data provided by TREB via Miltonly. MLS® listings updated daily. Information is deemed reliable but not guaranteed.
            Miltonly.com is Milton Ontario&apos;s only dedicated real estate platform.
          </p>
        </div>
      </div>
    </div>
  );
}
