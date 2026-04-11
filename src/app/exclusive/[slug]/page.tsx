import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import type { Metadata } from "next";
import InquiryForm from "./InquiryForm";

export const revalidate = 300;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await prisma.exclusiveListing.findUnique({ where: { slug: params.slug } });
  if (!listing) return { title: "Listing not found" };
  const priceStr = listing.priceType === "rent"
    ? `$${listing.price.toLocaleString()}/mo`
    : `$${listing.price.toLocaleString()}`;
  return genMeta({
    title: `${listing.title} — ${priceStr}`,
    description: listing.description.slice(0, 160),
    canonical: `https://miltonly.com/exclusive/${listing.slug}`,
  });
}

function formatPrice(price: number, priceType: string) {
  if (priceType === "rent") return `$${price.toLocaleString()} / month`;
  return `$${price.toLocaleString()}`;
}

function formatBedsLong(bedsMin: number, bedsMax: number) {
  if (bedsMax > 0) return `${bedsMin}+${bedsMax} Bed`;
  return `${bedsMin} Bed`;
}

export default async function ExclusiveDetailPage({ params }: Props) {
  const listing = await prisma.exclusiveListing.findUnique({ where: { slug: params.slug } });
  if (!listing) notFound();

  const [heroPhoto, ...restPhotos] = listing.photos;

  return (
    <div className="bg-[#f8f9fb] min-h-screen">
      {/* Gallery */}
      <section className="bg-white">
        {heroPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt={listing.title}
            className="w-full max-h-[500px] object-cover"
          />
        )}
        {restPhotos.length > 0 && (
          <div className="max-w-6xl mx-auto px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {restPhotos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p}
                alt={`${listing.title} photo ${i + 2}`}
                className="w-full aspect-[4/3] object-cover rounded-lg"
              />
            ))}
          </div>
        )}
      </section>

      {/* Info */}
      <section className="max-w-6xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2/3 */}
          <div className="lg:col-span-2">
            <span className="inline-block bg-[#f59e0b] text-[#07111f] text-[10px] font-bold px-3 py-1 rounded-full">
              {listing.badge}
            </span>
            <p className="text-[32px] sm:text-[38px] font-extrabold text-[#07111f] tracking-[-0.02em] mt-3">
              {formatPrice(listing.price, listing.priceType)}
            </p>
            <p className="text-[15px] text-[#475569] mt-1">
              {listing.address}
              {listing.city ? `, ${listing.city}` : ""}
            </p>
            <p className="text-[14px] font-bold text-[#07111f] mt-4">
              {formatBedsLong(listing.bedsMin, listing.bedsMax)}
            </p>
            <p className="text-[13px] text-[#64748b] mt-1">
              {listing.baths} Bath · {listing.parking} Parking · {listing.propertyType}
            </p>

            <div className="border-t border-[#e2e8f0] my-6" />

            <h2 className="text-[16px] font-extrabold text-[#07111f] mb-3">About this home</h2>
            <p className="text-[14px] leading-relaxed text-[#374151] whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* Right 1/3 */}
          <div className="self-start lg:sticky lg:top-6">
            {/* Agent contact card */}
            <div className="bg-[#07111f] rounded-2xl p-6">
              <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Listed by</p>
              <p className="text-[20px] font-extrabold text-[#f8f9fb] mt-1">Aamir Yaqoob</p>
              <p className="text-[12px] font-bold text-[#f59e0b] mt-1">
                Sales Representative · RE/MAX Realty Specialists Inc.
              </p>

              <div className="mt-3 space-y-1">
                <p className="text-[11px] text-[#94a3b8]">🏆 RE/MAX Hall of Fame Award</p>
                <p className="text-[11px] text-[#94a3b8]">🏆 RE/MAX Executive Award</p>
                <p className="text-[11px] text-[#94a3b8]">🏆 RE/MAX 100% Club Award</p>
              </div>

              <div className="mt-4 space-y-2">
                <a
                  href="tel:+16478399090"
                  className="block w-full bg-[#f59e0b] text-[#07111f] text-center rounded-xl py-3 font-bold text-[14px] hover:bg-[#fbbf24]"
                >
                  📞 Call (647) 839-9090
                </a>
                <a
                  href="https://wa.me/16478399090"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] text-center rounded-xl py-3 font-bold text-[14px] hover:bg-[#1e3a5f]"
                >
                  💬 WhatsApp (647) 839-9090
                </a>
                <p className="text-[11px] text-[#94a3b8] text-center mt-2">gtahomequest@gmail.com</p>
              </div>
            </div>

            {/* Inquiry form */}
            <InquiryForm address={listing.address} slug={listing.slug} />
          </div>
        </div>
      </section>
    </div>
  );
}
