import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: { mlsNumber: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!listing) return { title: "Listing Not Found" };

  return {
    title: `${listing.address} — ${formatPriceFull(listing.price)} | ${listing.bedrooms}bd ${listing.bathrooms}ba`,
    description: `View ${listing.propertyType} at ${listing.address}, Milton ON listed at ${formatPriceFull(listing.price)}. ${listing.bedrooms} beds, ${listing.bathrooms} baths.`,
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const listing = await prisma.listing.findUnique({ where: { mlsNumber: params.mlsNumber } });
  if (!listing) notFound();

  const days = daysAgo(listing.listedAt);

  // Similar listings (same neighbourhood or property type)
  const similar = await prisma.listing.findMany({
    where: {
      status: "active",
      propertyType: listing.propertyType,
      mlsNumber: { not: listing.mlsNumber },
    },
    orderBy: { listedAt: "desc" },
    take: 3,
  });

  const monthlyPayment = Math.round((listing.price * 0.8 * 0.05) / 12 + (listing.price * 0.8) / (25 * 12));

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="px-5 sm:px-11 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] text-[#94a3b8] mb-4">
          <Link href="/" className="hover:text-[#07111f]">Home</Link>
          <span>/</span>
          <Link href="/listings" className="hover:text-[#07111f]">Listings</Link>
          <span>/</span>
          <span className="text-[#475569]">{listing.mlsNumber}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo */}
            <div className="aspect-[16/10] bg-gradient-to-br from-[#b0c4de] to-[#93a8c4] rounded-2xl overflow-hidden">
              {listing.photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.photos[0]} alt={listing.address} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-[14px]">No photos available</div>
              )}
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[28px] font-extrabold text-[#07111f] tracking-[-0.5px]">{formatPriceFull(listing.price)}</p>
                  <p className="text-[14px] text-[#64748b] mt-1">{listing.address}</p>
                </div>
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#07111f] text-[#f59e0b] capitalize shrink-0">
                  {listing.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-[#f1f5f9]">
                <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Bedrooms</p><p className="text-[18px] font-extrabold text-[#07111f]">{listing.bedrooms}</p></div>
                <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Bathrooms</p><p className="text-[18px] font-extrabold text-[#07111f]">{listing.bathrooms}</p></div>
                <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Parking</p><p className="text-[18px] font-extrabold text-[#07111f]">{listing.parking}</p></div>
                <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Type</p><p className="text-[18px] font-extrabold text-[#07111f] capitalize">{listing.propertyType}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 text-[12px]">
                <div><span className="text-[#94a3b8]">MLS#</span> <span className="text-[#07111f] font-semibold">{listing.mlsNumber}</span></div>
                <div><span className="text-[#94a3b8]">Neighbourhood</span> <span className="text-[#07111f] font-semibold">{listing.neighbourhood}</span></div>
                <div><span className="text-[#94a3b8]">Listed</span> <span className="text-[#07111f] font-semibold">{days === 0 ? "Today" : `${days} days ago`}</span></div>
                {listing.basement && <div><span className="text-[#94a3b8]">Basement</span> <span className="text-[#07111f] font-semibold">Yes</span></div>}
              </div>

              {listing.description && (
                <div className="mt-6 pt-6 border-t border-[#f1f5f9]">
                  <h2 className="text-[14px] font-bold text-[#07111f] mb-3">Description</h2>
                  <p className="text-[13px] text-[#64748b] leading-[1.7] whitespace-pre-line">{listing.description}</p>
                </div>
              )}
            </div>

            {/* Mortgage estimate */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
              <h2 className="text-[14px] font-bold text-[#07111f] mb-3">Mortgage Estimate</h2>
              <p className="text-[11px] text-[#94a3b8] mb-4">Based on 20% down, 5% rate, 25-year amortization</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-extrabold text-[#07111f]">${monthlyPayment.toLocaleString()}</span>
                <span className="text-[13px] text-[#94a3b8]">/month</span>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Agent card */}
            <div className="bg-[#07111f] rounded-2xl p-6">
              <h3 className="text-[14px] font-bold text-[#f8f9fb] mb-3">Book a showing</h3>
              <p className="text-[12px] text-[rgba(248,249,251,0.6)] mb-4">Interested in this property? Get in touch.</p>
              <form className="space-y-3">
                <input type="text" placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[rgba(248,249,251,0.3)] outline-none focus:border-[#f59e0b]" />
                <input type="email" placeholder="Email" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[rgba(248,249,251,0.3)] outline-none focus:border-[#f59e0b]" />
                <input type="tel" placeholder="Phone (optional)" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[rgba(248,249,251,0.3)] outline-none focus:border-[#f59e0b]" />
                <button type="submit" className="w-full bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#eab308] transition-colors">
                  Book a Showing
                </button>
              </form>
            </div>

            {/* Street link */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
              <h3 className="text-[14px] font-bold text-[#07111f] mb-2">Street Intelligence</h3>
              <p className="text-[12px] text-[#64748b] mb-3">See sold prices, trends, and data for this street.</p>
              <Link href={`/streets/${listing.streetSlug}`} className="text-[12px] text-[#2563eb] font-semibold hover:underline">
                View street data →
              </Link>
            </div>

            {/* Similar listings */}
            {similar.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
                <h3 className="text-[14px] font-bold text-[#07111f] mb-4">Similar listings</h3>
                <div className="space-y-3">
                  {similar.map((s) => (
                    <Link key={s.mlsNumber} href={`/listings/${s.mlsNumber}`} className="flex items-center gap-3 hover:bg-[#f8fafc] -mx-2 px-2 py-2 rounded-lg transition-colors">
                      <div className="w-16 h-12 bg-gradient-to-br from-[#b0c4de] to-[#93a8c4] rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#07111f]">{formatPriceFull(s.price)}</p>
                        <p className="text-[11px] text-[#94a3b8] truncate">{s.address}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
