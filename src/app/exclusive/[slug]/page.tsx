import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import type { Metadata } from "next";
import Gallery from "./Gallery";
import AgentSidebar from "./AgentSidebar";
import SiteChrome from "@/components/nav/SiteChrome";

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

// The source line under the price (MC-036, VOW Best Practices item 9), the same words the
// /exclusive card carries. Inside the price element so it inherits the price's font and colour.
const SOURCE_LINE = `Not an MLS listing. Listed exclusively by ${config.brokerage.name}.`;
const SOURCE_STYLE = { display: "block", font: "inherit", color: "inherit", marginTop: "0.2em" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await prisma.exclusiveListing.findUnique({ where: { slug: params.slug } });
  if (!listing) return { title: "Listing not found" };
  const priceStr =
    listing.priceType === "rent"
      ? `$${listing.price.toLocaleString()}/mo`
      : `$${listing.price.toLocaleString()}`;
  const beds = listing.bedsMax > 0 ? `${listing.bedsMin}+${listing.bedsMax}` : `${listing.bedsMin}`;
  return genMeta({
    title: `${listing.address}, ${priceStr} | ${beds} bed ${listing.propertyType} | ${config.SITE_NAME}`,
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
    { label: "Sqft", value: listing.sqft ? `${listing.sqft.toLocaleString()} sq ft` : "—" },
    { label: "Year built", value: listing.yearBuilt ? String(listing.yearBuilt) : "—" },
    {
      label: "Maintenance",
      value: listing.maintenance ? `$${listing.maintenance.toLocaleString()} / month` : "—",
    },
    {
      label: "Taxes",
      value: listing.taxes
        ? `$${listing.taxes.toLocaleString()}${listing.taxYear ? ` / yr (${listing.taxYear})` : " / yr"}`
        : "—",
    },
    { label: "Heating", value: listing.heating || "—" },
    { label: "Cooling", value: listing.cooling || "—" },
    { label: "Basement", value: listing.basement || "—" },
    { label: "Garage", value: listing.garage || "—" },
    { label: "Locker", value: listing.locker || "—" },
    { label: "Exposure", value: listing.exposure || "—" },
    { label: "Lot size", value: listing.lotSize || "—" },
    { label: "Exterior", value: listing.exterior || "—" },
    { label: "Pets", value: listing.petFriendly === null ? "—" : listing.petFriendly ? "Yes" : "No" },
  ];

  return (
    <SiteChrome>
    <div className="bg-white min-h-screen">
      {/* Gallery — full width */}
      <Gallery photos={listing.photos} title={listing.title} />

      {/* Breadcrumb + back link */}
      <div className="max-w-6xl mx-auto px-5 pt-6">
        <Link
          href="/exclusive"
          className="text-[12px] text-[#6b6f6a] hover:text-[#073126] inline-block mb-2"
        >
          ← Back to exclusive listings
        </Link>
        <nav className="text-[12px] text-[#6b6f6a]">
          <Link href="/" className="hover:text-[#073126]">
            {config.SITE_NAME}
          </Link>
          <span className="mx-1.5">›</span>
          <Link href="/exclusive" className="hover:text-[#073126]">
            Exclusive
          </Link>
          {listing.city && (
            <>
              <span className="mx-1.5">›</span>
              <span>{listing.city}</span>
            </>
          )}
          <span className="mx-1.5">›</span>
          <span className="text-[#073126] font-semibold">{listing.address}</span>
        </nav>
      </div>

      {/* Header row — price + stats, agent sidebar */}
      <section className="max-w-6xl mx-auto px-5 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: price + address + stat row */}
          <div className="lg:col-span-2">
            <span className="inline-block bg-[#00ff80] text-[#04160f] text-[12px] font-bold px-3 py-1 rounded-full tracking-wider uppercase">
              {listing.badge}
            </span>
            <p className="text-[36px] sm:text-[42px] font-extrabold text-[#073126] tracking-[-0.02em] leading-[1.1] mt-3" data-price>
              {formatPrice(listing.price, listing.priceType)}
              {priceSuffix && (
                <span className="text-[20px] font-semibold text-[#6b6f6a]"> {priceSuffix.trim()}</span>
              )}
              <span data-brokerage style={SOURCE_STYLE}>{SOURCE_LINE}</span>
            </p>
            <p className="text-[18px] font-semibold text-[#073126] mt-2">{listing.address}</p>
            {listing.city && <p className="text-[14px] text-[#6b6f6a] mt-0.5">{listing.city}</p>}

            {/* Icon stat row */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-5 py-5 border-y border-[#dfe0dc]">
              <Stat icon="🛏" value={formatBedsLong(listing.bedsMin, listing.bedsMax)} label="Beds" />
              <Stat icon="🚿" value={String(listing.baths)} label="Baths" />
              {listing.sqft && <Stat icon="📐" value={`${listing.sqft.toLocaleString()}`} label="Sqft" />}
              <Stat icon="🏠" value={listing.propertyType} label="Type" />
              <Stat icon="🚗" value={String(listing.parking)} label="Parking" />
              {listing.yearBuilt && <Stat icon="📅" value={String(listing.yearBuilt)} label="Year built" />}
            </div>
          </div>

          {/* Right: sticky agent sidebar */}
          <div className="lg:sticky lg:top-[80px] self-start">
            <AgentSidebar address={listing.address} slug={listing.slug} />
          </div>
        </div>
      </section>

      {/* Details section — bg-[#fffdfa] */}
      <section className="bg-[#fffdfa] py-10 mt-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column 2/3 */}
            <div className="lg:col-span-2 space-y-10">
              {/* About */}
              <div>
                <h2 className="text-[20px] font-extrabold text-[#073126] mb-4 tracking-[-0.01em]">
                  About this property
                </h2>
                <p className="text-[14px] leading-relaxed text-[#292b29] whitespace-pre-line">
                  {listing.description}
                </p>
              </div>

              {/* Property details */}
              <div>
                <h2 className="text-[20px] font-extrabold text-[#073126] mb-4 tracking-[-0.01em]">
                  Property details
                </h2>
                <div className="bg-white rounded-2xl border border-[#dfe0dc] overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    {detailRows.map((row, i) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between px-5 py-3 text-[13px] ${
                          i % 2 === 0 ? "bg-white" : "bg-[#fffdfa]"
                        } ${i < detailRows.length - 2 ? "border-b border-[#f6f6f3]" : ""}`}
                      >
                        <span className="text-[#6b6f6a]">{row.label}</span>
                        <span className="text-[#073126] font-semibold text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rooms */}
              {rooms.length > 0 && (
                <div>
                  <h2 className="text-[20px] font-extrabold text-[#073126] mb-4 tracking-[-0.01em]">
                    Room details
                  </h2>
                  <div className="bg-white rounded-2xl border border-[#dfe0dc] overflow-hidden">
                    <table className="w-full text-[13px]">
                      <thead className="bg-[#073126] text-[#fffdfa]">
                        <tr>
                          <th className="text-left px-5 py-3 font-semibold">Room</th>
                          <th className="text-left px-5 py-3 font-semibold">Level</th>
                          <th className="text-left px-5 py-3 font-semibold">Size</th>
                          <th className="text-left px-5 py-3 font-semibold">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map((r, i) => (
                          <tr key={`${r.name}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-[#fffdfa]"}>
                            <td className="px-5 py-3 font-semibold text-[#073126]">{r.name}</td>
                            <td className="px-5 py-3 text-[#6b6f6a]">{r.level}</td>
                            <td className="px-5 py-3 text-[#6b6f6a]">{r.size}</td>
                            <td className="px-5 py-3 text-[#6b6f6a]">{r.notes || "—"}</td>
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
                  <h2 className="text-[20px] font-extrabold text-[#073126] mb-4 tracking-[-0.01em]">
                    Interior features
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {listing.interiorFeatures.map((f) => (
                      <span
                        key={f}
                        className="bg-white border border-[#dfe0dc] text-[#4f534f] rounded-full px-3 py-1 text-[12px] font-medium"
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
                  <h2 className="text-[20px] font-extrabold text-[#073126] mb-4 tracking-[-0.01em]">
                    Exterior features
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {listing.exteriorFeatures.map((f) => (
                      <span
                        key={f}
                        className="bg-white border border-[#dfe0dc] text-[#4f534f] rounded-full px-3 py-1 text-[12px] font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column 1/3 — sticky duplicate */}
            <div className="lg:sticky lg:top-[80px] self-start">
              <AgentSidebar address={listing.address} slug={listing.slug} />
            </div>
          </div>
        </div>
      </section>
    </div>
    </SiteChrome>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-start min-w-[72px]">
      <span className="text-[20px] leading-none mb-1">{icon}</span>
      <span className="text-[18px] font-extrabold text-[#073126] leading-tight">{value}</span>
      <span className="text-[12px] text-[#6b6f6a] font-semibold">{label}</span>
    </div>
  );
}
