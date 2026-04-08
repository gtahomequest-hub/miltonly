import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";
import type { Metadata } from "next";

interface Props {
  params: { slug: string };
}

async function getStreetData(slug: string) {
  const listings = await prisma.listing.findMany({
    where: { streetSlug: slug },
    orderBy: { listedAt: "desc" },
  });

  if (listings.length === 0) return null;

  const active = listings.filter((l) => l.status === "active");
  const sold = listings.filter((l) => l.status === "sold");
  const all = listings;

  const avgPrice = all.length > 0 ? Math.round(all.reduce((sum, l) => sum + l.price, 0) / all.length) : 0;
  const avgDOM = all.filter((l) => l.daysOnMarket).length > 0
    ? Math.round(all.filter((l) => l.daysOnMarket).reduce((sum, l) => sum + (l.daysOnMarket || 0), 0) / all.filter((l) => l.daysOnMarket).length)
    : 0;

  // Extract street name from first listing address
  const sampleAddress = listings[0].address;
  const streetName = sampleAddress
    .replace(/^\d+\s*/, "")
    .replace(/,\s*Milton.*$/i, "")
    .replace(/,\s*ON.*$/i, "")
    .replace(/,\s*Unit.*$/i, "")
    .trim();

  return {
    slug,
    streetName,
    neighbourhood: listings[0].neighbourhood,
    avgPrice,
    avgDOM,
    activeCount: active.length,
    soldCount: sold.length,
    totalCount: all.length,
    activeListings: active.slice(0, 10),
    soldListings: sold.slice(0, 10),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStreetData(params.slug);
  if (!data) return { title: "Street Not Found" };

  return {
    title: `${data.streetName} Milton — Homes For Sale, Sold Prices & Market Data`,
    description: `${data.streetName} in Milton Ontario: ${data.activeCount} active listings, avg price ${formatPriceFull(data.avgPrice)}. Full sold history and street intelligence.`,
  };
}

export default async function StreetPage({ params }: Props) {
  const data = await getStreetData(params.slug);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="px-5 sm:px-11 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] text-[#94a3b8] mb-4">
          <Link href="/" className="hover:text-[#07111f]">Home</Link>
          <span>/</span>
          <Link href="/streets" className="hover:text-[#07111f]">Streets</Link>
          <span>/</span>
          <span className="text-[#475569]">{data.streetName}</span>
        </div>

        {/* Header */}
        <div className="bg-[#07111f] rounded-2xl p-6 sm:p-8 mb-6">
          <p className="text-[10px] text-[rgba(248,249,251,0.5)] font-semibold uppercase tracking-[0.12em] mb-2">
            Street Intelligence · {data.neighbourhood}
          </p>
          <h1 className="text-[24px] sm:text-[28px] font-extrabold text-[#f8f9fb] tracking-[-0.3px]">
            {data.streetName}, Milton
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { value: formatPriceFull(data.avgPrice), label: "Avg price" },
              { value: String(data.activeCount), label: "Active listings" },
              { value: data.avgDOM ? data.avgDOM + " days" : "—", label: "Avg days on market" },
              { value: String(data.totalCount), label: "Total listings" },
            ].map((s) => (
              <div key={s.label} className="bg-[#0c1e35] rounded-xl p-4">
                <p className="text-[18px] font-extrabold text-[#f8f9fb]">{s.value}</p>
                <p className="text-[10px] text-[rgba(248,249,251,0.5)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active listings */}
          <div className="lg:col-span-2">
            <h2 className="text-[16px] font-bold text-[#07111f] mb-4">
              Active listings on {data.streetName} ({data.activeCount})
            </h2>
            {data.activeListings.length > 0 ? (
              <div className="space-y-3">
                {data.activeListings.map((l) => (
                  <Link
                    key={l.mlsNumber}
                    href={`/listings/${l.mlsNumber}`}
                    className="flex items-center gap-4 bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="w-20 h-14 bg-gradient-to-br from-[#b0c4de] to-[#93a8c4] rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-extrabold text-[#07111f]">{formatPriceFull(l.price)}</p>
                      <p className="text-[11px] text-[#64748b] truncate">{l.address}</p>
                      <p className="text-[10px] text-[#94a3b8] mt-1">{l.bedrooms}bd · {l.bathrooms}ba · {l.propertyType} · {daysAgo(l.listedAt)}d on market</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#94a3b8] py-8">No active listings on this street right now.</p>
            )}

            {/* Sold listings */}
            {data.soldListings.length > 0 && (
              <div className="mt-8">
                <h2 className="text-[16px] font-bold text-[#07111f] mb-4">
                  Recently sold on {data.streetName} ({data.soldCount})
                </h2>
                <div className="space-y-3">
                  {data.soldListings.map((l) => (
                    <Link
                      key={l.mlsNumber}
                      href={`/listings/${l.mlsNumber}`}
                      className="flex items-center gap-4 bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="w-20 h-14 bg-gradient-to-br from-[#94a3b8] to-[#64748b] rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-extrabold text-[#07111f]">{formatPriceFull(l.soldPrice || l.price)}</p>
                          <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] rounded-full px-2 py-0.5">SOLD</span>
                        </div>
                        <p className="text-[11px] text-[#64748b] truncate">{l.address}</p>
                        <p className="text-[10px] text-[#94a3b8] mt-1">{l.bedrooms}bd · {l.bathrooms}ba · {l.propertyType}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Alert card */}
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
              <h3 className="text-[14px] font-bold text-[#07111f] mb-2">Get alerted</h3>
              <p className="text-[12px] text-[#64748b] mb-4">
                Get notified when a home lists on {data.streetName}.
              </p>
              <form className="space-y-3">
                <input type="email" placeholder="Your email" className="w-full px-3 py-2.5 text-[12px] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg outline-none focus:border-[#07111f]" />
                <button type="submit" className="w-full bg-[#07111f] text-[#f59e0b] text-[12px] font-bold rounded-lg py-2.5">
                  Alert me →
                </button>
              </form>
            </div>

            {/* Seller card */}
            <div className="bg-[#fbbf24] rounded-2xl p-6">
              <h3 className="text-[14px] font-bold text-[#07111f] mb-2">Own a home on {data.streetName}?</h3>
              <p className="text-[12px] text-[#78350f] mb-4">
                Find out what your home is worth based on recent sales on your street.
              </p>
              <Link href="/sell" className="block w-full bg-[#07111f] text-[#f59e0b] text-[12px] font-bold rounded-lg py-2.5 text-center">
                Get my home value →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
