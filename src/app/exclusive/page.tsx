import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `Exclusive Listings â€” ${config.realtor.name}`,
  description: `Properties personally listed and represented by ${config.realtor.name} Â· ${config.brokerage.name.replace(", Brokerage", "")}. ${config.CITY_NAME} ${config.CITY_PROVINCE} exclusive homes for sale and for rent.`,
  canonical: `${config.SITE_URL}/exclusive`,
});

export const revalidate = 300;

function formatPrice(price: number, priceType: string) {
  if (priceType === "rent") return `$${price.toLocaleString()} / month`;
  return `$${price.toLocaleString()}`;
}

function formatBeds(bedsMin: number, bedsMax: number) {
  if (bedsMax > 0) return `${bedsMin}+${bedsMax} bed`;
  return `${bedsMin} bed`;
}

export default async function ExclusivePage() {
  const listings = await prisma.exclusiveListing.findMany({
    where: { status: { in: ["active", "coming-soon"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-[#f8f9fb]">
      {/* Hero */}
      <section className="bg-[#07111f] text-center px-5 py-16">
        <p className="text-[11px] font-bold text-[#f59e0b] tracking-[0.18em] mb-3">LISTED BY {config.realtor.name.toUpperCase()}</p>
        <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold text-[#f8f9fb] leading-[1.1] tracking-[-0.03em] mb-4">
          Exclusive Listings
        </h1>
        <p className="text-[14px] text-[#94a3b8] max-w-[560px] mx-auto leading-relaxed">
          Properties personally listed and represented by {config.realtor.name} Â·<br className="hidden sm:block" /> {config.brokerage.name.replace(", Brokerage", "")}
        </p>
      </section>

      {/* Grid */}
      <section className="py-10">
        <div className="max-w-6xl mx-auto px-5">
          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center">
              <p className="text-[15px] font-bold text-[#07111f] mb-2">No exclusive listings available right now</p>
              <p className="text-[13px] text-[#64748b] mb-5">Call {config.realtor.name.split(" ")[0]} to hear about off-market opportunities.</p>
              <a
                href={`tel:${config.realtor.phoneE164}`}
                className="inline-block bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-xl px-6 py-3 hover:bg-[#fbbf24] transition-colors"
              >
                ðŸ“ž Call {config.realtor.name.split(" ")[0]} {config.realtor.phone}
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((l) => {
                const isComingSoon = l.status === "coming-soon";
                const firstPhoto = l.photos[0];
                return (
                  <div
                    key={l.id}
                    className="relative bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Photo */}
                    <div className="relative aspect-[4/3] bg-[#0c1e35]">
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstPhoto}
                          alt={l.title}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      {isComingSoon && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                          <span className="text-[#f8f9fb] text-[16px] font-extrabold tracking-[0.1em] uppercase">Coming Soon</span>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-[#f59e0b] text-[#07111f] text-[10px] font-bold px-2 py-1 rounded-full z-10">
                        {l.badge}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-[22px] font-extrabold text-[#07111f] tracking-[-0.02em]">
                        {isComingSoon ? "Contact for price" : formatPrice(l.price, l.priceType)}
                      </p>
                      <p className="text-[13px] text-[#64748b] mt-1">
                        {l.address}
                        {l.city ? `, ${l.city}` : ""}
                      </p>
                      <p className="text-[12px] text-[#475569] mt-2">
                        {formatBeds(l.bedsMin, l.bedsMax)} Â· {l.baths} bath Â· {l.parking} parking
                      </p>
                      <p className="text-[11px] text-[#94a3b8] mt-1">{l.propertyType}</p>

                      <div className="mt-4 flex gap-2 relative z-10">
                        {isComingSoon ? (
                          <a
                            href={`tel:${config.realtor.phoneE164}`}
                            className="flex-1 bg-[#f59e0b] text-[#07111f] font-bold rounded-xl px-4 py-2 text-[13px] text-center hover:bg-[#fbbf24]"
                          >
                            Get notified â†’
                          </a>
                        ) : (
                          <>
                            <a
                              href="tel:+16478399090"
                              className="flex-1 bg-[#f59e0b] text-[#07111f] font-bold rounded-xl px-4 py-2 text-[13px] text-center hover:bg-[#fbbf24]"
                            >
                              ðŸ“ž Call {config.realtor.name.split(" ")[0]}
                            </a>
                            <a
                              href="https://wa.me/16478399090"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-[#07111f] text-[#f8f9fb] font-bold rounded-xl px-4 py-2 text-[13px] text-center border border-[#1e3a5f] hover:bg-[#0c1e35]"
                            >
                              ðŸ’¬ WhatsApp
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Clickable overlay covering non-button area */}
                    <Link
                      href={`/exclusive/${l.slug}`}
                      aria-label={`View ${l.title}`}
                      className="absolute inset-0 z-0"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
