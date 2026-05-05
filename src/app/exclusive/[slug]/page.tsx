import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import type { Metadata } from "next";
import Gallery from "./Gallery";
import AgentSidebar from "./AgentSidebar";

export const dynamic = 'force-dynamic';

export const revalidate = 300;

interface Props {
  params: { slug: string };
}

interface Room {
  name: string;
  level: string;
  size: string;
  notes?: string;
}

function formatPrice(price: number, priceType: string) {
  if (priceType === "rent") return `$${price.toLocaleString()}`;
  return `$${price.toLocaleString()}`;
}

function formatBedsLong(bedsMin: number, bedsMax: number) {
  if (bedsMax > 0) return `${bedsMin}+${bedsMax}`;
  return `${bedsMin}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await prisma.exclusiveListing.findUnique({ where: { slug: params.slug } });
  if (!listing) return { title: "Listing not found" };
  const priceStr =
    listing.priceType === "rent"
      ? `$${listing.price.toLocaleString()}/mo`
      : `$${listing.price.toLocaleString()}`;
  const beds = listing.bedsMax > 0 ? `${listing.bedsMin}+${listing.bedsMax}` : `${listing.bedsMin}`;
  return genMeta({
    title: `${listing.address} â€” ${priceStr} | ${beds} bed ${listing.propertyType} | ${config.SITE_NAME}`,
    description: listing.description.slice(0, 160),
    canonical: `${config.SITE_URL}/exclusive/${listing.slug}`,
  });
}

export default async function ExclusiveDetailPage({ params }: Props) {
  const listing = await prisma.exclusiveListing.findUnique({ where: { slug: params.slug } });
  if (!listing) notFound();

  const rooms: Room[] = Array.isArray(listing.rooms) ? (listing.rooms as unknown as Room[]) : [];
  const priceSuffix = listing.priceType === "rent" ? " / month" : "";

  const detailRows: Array<{ label: string; value: string }> = [
    { label: "Property type", value: listing.propertyType },
    { label: "Sqft", value: listing.sqft ? `${listing.sqft.toLocaleString()} sq ft` : "â€”" },
    { label: "Year built", value: listing.yearBuilt ? String(listing.yearBuilt) : "â€”" },
    {
      label: "Maintenance",
      value: listing.maintenance ? `$${listing.maintenance.toLocaleString()} / month` : "â€”",
    },
    {
      label: "Taxes",
      value: listing.taxes
        ? `$${listing.taxes.toLocaleString()}${listing.taxYear ? ` / yr (${listing.taxYear})` : " / yr"}`
        : "â€”",
    },
    { label: "Heating", value: listing.heating || "â€”" },
    { label: "Cooling", value: listing.cooling || "â€”" },
    { label: "Basement", value: listing.basement || "â€”" },
    { label: "Garage", value: listing.garage || "â€”" },
    { label: "Locker", value: listing.locker || "â€”" },
    { label: "Exposure", value: listing.exposure || "â€”" },
    { label: "Lot size", value: listing.lotSize || "â€”" },
    { label: "Exterior", value: listing.exterior || "â€”" },
    { label: "Pets", value: listing.petFriendly === null ? "â€”" : listing.petFriendly ? "Yes" : "No" },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Gallery â€” full width */}
      <Gallery photos={listing.photos} title={listing.title} />

      {/* Breadcrumb + back link */}
      <div className="max-w-6xl mx-auto px-5 pt-6">
        <Link
          href="/exclusive"
          className="text-[12px] text-[#94a3b8] hover:text-[#07111f] inline-block mb-2"
        >
          â† Back to exclusive listings
        </Link>
        <nav className="text-[11px] text-[#64748b]">
          <Link href="/" className="hover:text-[#07111f]">
            {config.SITE_NAME}
          </Link>
          <span className="mx-1.5">â€º</span>
          <Link href="/exclusive" className="hover:text-[#07111f]">
            Exclusive
          </Link>
          {listing.city && (
            <>
              <span className="mx-1.5">â€º</span>
              <span>{listing.city}</span>
            </>
          )}
          <span className="mx-1.5">â€º</span>
          <span className="text-[#07111f] font-semibold">{listing.address}</span>
        </nav>
      </div>

      {/* Header row â€” price + stats, agent sidebar */}
      <section className="max-w-6xl mx-auto px-5 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: price + address + stat row */}
          <div className="lg:col-span-2">
            <span className="inline-block bg-[#f59e0b] text-[#07111f] text-[10px] font-bold px-3 py-1 rounded-full tracking-wider uppercase">
              {listing.badge}
            </span>
            <p className="text-[36px] sm:text-[42px] font-extrabold text-[#07111f] tracking-[-0.02em] leading-[1.1] mt-3">
              {formatPrice(listing.price, listing.priceType)}
              {priceSuffix && (
                <span className="text-[20px] font-semibold text-[#64748b]"> {priceSuffix.trim()}</span>
              )}
            </p>
            <p className="text-[18px] font-semibold text-[#07111f] mt-2">{listing.address}</p>
            {listing.city && <p className="text-[14px] text-[#64748b] mt-0.5">{listing.city}</p>}

            {/* Icon stat row */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-5 py-5 border-y border-[#e2e8f0]">
              <Stat icon="ðŸ›" value={formatBedsLong(listing.bedsMin, listing.bedsMax)} label="Beds" />
              <Stat icon="ðŸš¿" value={String(listing.baths)} label="Baths" />
              {listing.sqft && <Stat icon="ðŸ“" value={`${listing.sqft.toLocaleString()}`} label="Sqft" />}
              <Stat icon="ðŸ " value={listing.propertyType} label="Type" />
              <Stat icon="ðŸš—" value={String(listing.parking)} label="Parking" />
              {listing.yearBuilt && <Stat icon="ðŸ“…" value={String(listing.yearBuilt)} label="Year built" />}
            </div>
          </div>

          {/* Right: sticky agent sidebar */}
          <div className="lg:sticky lg:top-[80px] self-start">
            <AgentSidebar address={listing.address} slug={listing.slug} />
          </div>
        </div>
      </section>

      {/* Details section â€” bg-[#f8f9fb] */}
      <section className="bg-[#f8f9fb] py-10 mt-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column 2/3 */}
            <div className="lg:col-span-2 space-y-10">
              {/* About */}
              <div>
                <h2 className="text-[20px] font-extrabold text-[#07111f] mb-4 tracking-[-0.01em]">
                  About this property
                </h2>
                <p className="text-[14px] leading-relaxed text-[#374151] whitespace-pre-line">
                  {listing.description}
                </p>
              </div>

              {/* Property details */}
              <div>
                <h2 className="text-[20px] font-extrabold text-[#07111f] mb-4 tracking-[-0.01em]">
                  Property details
                </h2>
                <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    {detailRows.map((row, i) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between px-5 py-3 text-[13px] ${
                          i % 2 === 0 ? "bg-white" : "bg-[#f8f9fb]"
                        } ${i < detailRows.length - 2 ? "border-b border-[#f1f5f9]" : ""}`}
                      >
                        <span className="text-[#94a3b8]">{row.label}</span>
                        <span className="text-[#07111f] font-semibold text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rooms */}
              {rooms.length > 0 && (
                <div>
                  <h2 className="text-[20px] font-extrabold text-[#07111f] mb-4 tracking-[-0.01em]">
                    Room details
                  </h2>
                  <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
                    <table className="w-full text-[13px]">
                      <thead className="bg-[#07111f] text-[#f8f9fb]">
                        <tr>
                          <th className="text-left px-5 py-3 font-semibold">Room</th>
                          <th className="text-left px-5 py-3 font-semibold">Level</th>
                          <th className="text-left px-5 py-3 font-semibold">Size</th>
                          <th className="text-left px-5 py-3 font-semibold">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map((r, i) => (
                          <tr key={`${r.name}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-[#f8f9fb]"}>
                            <td className="px-5 py-3 font-semibold text-[#07111f]">{r.name}</td>
                            <td className="px-5 py-3 text-[#64748b]">{r.level}</td>
                            <td className="px-5 py-3 text-[#64748b]">{r.size}</td>
                            <td className="px-5 py-3 text-[#64748b]">{r.notes || "â€”"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Interior features */}
              {listing.interiorFeatures.length > 0 && (
                <div>
                  <h2 className="text-[20px] font-extrabold text-[#07111f] mb-4 tracking-[-0.01em]">
                    Interior features
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {listing.interiorFeatures.map((f) => (
                      <span
                        key={f}
                        className="bg-white border border-[#e2e8f0] text-[#475569] rounded-full px-3 py-1 text-[12px] font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Exterior features */}
              {listing.exteriorFeatures.length > 0 && (
                <div>
                  <h2 className="text-[20px] font-extrabold text-[#07111f] mb-4 tracking-[-0.01em]">
                    Exterior features
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {listing.exteriorFeatures.map((f) => (
                      <span
                        key={f}
                        className="bg-white border border-[#e2e8f0] text-[#475569] rounded-full px-3 py-1 text-[12px] font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column 1/3 â€” sticky duplicate */}
            <div className="lg:sticky lg:top-[80px] self-start">
              <AgentSidebar address={listing.address} slug={listing.slug} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-start min-w-[72px]">
      <span className="text-[20px] leading-none mb-1">{icon}</span>
      <span className="text-[18px] font-extrabold text-[#07111f] leading-tight">{value}</span>
      <span className="text-[11px] text-[#64748b] font-semibold">{label}</span>
    </div>
  );
}
