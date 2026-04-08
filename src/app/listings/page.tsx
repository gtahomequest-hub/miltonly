import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";
import ListingsGrid from "@/components/ListingsGrid";

export const metadata = genMeta({
  title: "Milton Homes For Sale — Active Listings",
  description: "Browse all active Milton Ontario real estate listings. Filter by price, bedrooms, property type, and neighbourhood. Live TREB data updated daily.",
  canonical: "https://miltonly.com/listings",
});

interface Props {
  searchParams: {
    type?: string;
    status?: string;
    min?: string;
    max?: string;
    beds?: string;
    baths?: string;
    neighbourhood?: string;
    sort?: string;
    page?: string;
  };
}

const PER_PAGE = 24;

export default async function ListingsPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const skip = (page - 1) * PER_PAGE;

  // Build where clause
  const where: Record<string, unknown> = { city: "Milton" };

  if (searchParams.type && searchParams.type !== "all") {
    where.propertyType = searchParams.type;
  }
  if (searchParams.status === "rent") {
    where.status = "rented";
  } else if (searchParams.status === "sold") {
    where.status = "sold";
  } else {
    where.status = "active";
  }
  if (searchParams.min) {
    where.price = { ...(where.price as object || {}), gte: parseInt(searchParams.min) };
  }
  if (searchParams.max) {
    where.price = { ...(where.price as object || {}), lte: parseInt(searchParams.max) };
  }
  if (searchParams.beds) {
    where.bedrooms = { gte: parseInt(searchParams.beds) };
  }
  if (searchParams.baths) {
    where.bathrooms = { gte: parseInt(searchParams.baths) };
  }
  if (searchParams.neighbourhood && searchParams.neighbourhood !== "all") {
    where.neighbourhood = { contains: searchParams.neighbourhood, mode: "insensitive" };
  }

  // Sort
  let orderBy: Record<string, string> = { listedAt: "desc" };
  if (searchParams.sort === "price_asc") orderBy = { price: "asc" };
  if (searchParams.sort === "price_desc") orderBy = { price: "desc" };
  if (searchParams.sort === "beds") orderBy = { bedrooms: "desc" };

  const [listings, totalCount] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, skip, take: PER_PAGE }),
    prisma.listing.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const statusLabel = searchParams.status === "rent" ? "for rent" : searchParams.status === "sold" ? "sold" : "for sale";

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="px-5 sm:px-11 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-[0.12em] mb-1">
            Live TREB data · {totalCount} results
          </p>
          <h1 className="text-[24px] font-extrabold text-[#07111f] tracking-[-0.3px]">
            {totalCount} homes {statusLabel} in Milton
          </h1>
        </div>

        {/* Filters */}
        <form className="flex flex-wrap gap-2 mb-6">
          <select name="type" defaultValue={searchParams.type || "all"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="all">All types</option>
            <option value="detached">Detached</option>
            <option value="semi">Semi</option>
            <option value="townhouse">Townhouse</option>
            <option value="condo">Condo</option>
          </select>
          <select name="status" defaultValue={searchParams.status || "active"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="active">For sale</option>
            <option value="rent">For rent</option>
            <option value="sold">Sold</option>
          </select>
          <select name="min" defaultValue={searchParams.min || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="">Min price</option>
            {[300000,400000,500000,600000,700000,800000,900000,1000000,1200000,1500000,2000000].map(p => (
              <option key={p} value={p}>{formatPriceFull(p)}</option>
            ))}
          </select>
          <select name="max" defaultValue={searchParams.max || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="">Max price</option>
            {[400000,500000,600000,700000,800000,900000,1000000,1200000,1500000,2000000,3000000].map(p => (
              <option key={p} value={p}>{formatPriceFull(p)}</option>
            ))}
          </select>
          <select name="beds" defaultValue={searchParams.beds || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="">Any beds</option>
            {[1,2,3,4,5].map(b => <option key={b} value={b}>{b}+ beds</option>)}
          </select>
          <select name="baths" defaultValue={searchParams.baths || ""} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="">Any baths</option>
            {[1,2,3].map(b => <option key={b} value={b}>{b}+ baths</option>)}
          </select>
          <select name="sort" defaultValue={searchParams.sort || "newest"} className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#475569] font-medium">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="beds">Most bedrooms</option>
          </select>
          <button type="submit" className="text-[12px] bg-[#07111f] text-[#f59e0b] font-bold px-4 py-2 rounded-lg">
            Apply filters
          </button>
        </form>

        {/* Grid */}
        <ListingsGrid listings={listings} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {page > 1 && (
              <Link
                href={{ pathname: "/listings", query: { ...searchParams, page: String(page - 1) } }}
                className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-4 py-2 text-[#475569] font-medium hover:bg-[#f8fafc]"
              >
                ← Previous
              </Link>
            )}
            <span className="text-[12px] text-[#94a3b8] px-3 py-2">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={{ pathname: "/listings", query: { ...searchParams, page: String(page + 1) } }}
                className="text-[12px] bg-white border border-[#e2e8f0] rounded-lg px-4 py-2 text-[#475569] font-medium hover:bg-[#f8fafc]"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
