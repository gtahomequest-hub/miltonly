import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteChrome from "@/components/nav/SiteChrome";

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `Exclusive Listings by ${config.realtor.name}`,
  description: `Properties personally listed and represented by ${config.realtor.name} · ${config.brokerage.name}. ${config.CITY_NAME} ${config.CITY_PROVINCE} exclusive homes for sale and for rent.`,
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

// The source line every card carries (MC-036, VOW Best Practices item 9): an exclusive is the
// same price/address/beds shape as an MLS card, and the badge alone does not say where it came
// from. Rendered inside the price element so it inherits the price's font, size and colour,
// the way ListingBrokerage does on the MLS surfaces.
const SOURCE_LINE = `Not an MLS listing. Listed exclusively by ${config.brokerage.name}.`;
const SOURCE_STYLE = { display: "block", font: "inherit", color: "inherit", marginTop: "0.2em" } as const;

export default async function ExclusivePage() {
  const listings = await prisma.exclusiveListing.findMany({
    where: { status: { in: ["active", "coming-soon"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <SiteChrome>
    <div className="bg-[#fffdfa]">
      {/* Hero */}
      <section className="bg-[#073126] text-center px-5 py-16">
        <p className="text-[12px] font-bold text-[#00ff80] tracking-[0.18em] mb-3">LISTED BY {config.realtor.name.toUpperCase()}</p>
        <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold text-[#fffdfa] leading-[1.1] tracking-[-0.03em] mb-4">
          Exclusive Listings
        </h1>
        <p className="text-[14px] text-white/75 max-w-[560px] mx-auto leading-relaxed">
          Properties personally listed and represented by {config.realtor.name} ·<br className="hidden sm:block" /> {config.brokerage.name}
        </p>
      </section>

      {/* Grid */}
      <section className="py-10">
        <div className="max-w-6xl mx-auto px-5">
          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#dfe0dc] p-12 text-center">
              <p className="text-[15px] font-bold text-[#073126] mb-2">No exclusive listings available right now</p>
              <p className="text-[13px] text-[#6b6f6a] mb-5">Call {config.realtor.name.split(" ")[0]} to hear about off-market opportunities.</p>
              <a
                href={`tel:${config.realtor.phoneE164}`}
                className="inline-block bg-[#00ff80] text-[#04160f] text-[13px] font-extrabold rounded-xl px-6 py-3 hover:bg-[#5cffa8] transition-colors"
              >
                Call {config.realtor.name.split(" ")[0]} {config.realtor.phone}
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
                    className="relative bg-white rounded-2xl border border-[#dfe0dc] overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Photo */}
                    <div className="relative aspect-[4/3] bg-[#0b3d2e]">
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
                          <span className="text-[#fffdfa] text-[16px] font-extrabold tracking-[0.1em] uppercase">Coming Soon</span>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-[#00ff80] text-[#04160f] text-[12px] font-bold px-2 py-1 rounded-full z-10">
                        {l.badge}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-[22px] font-extrabold text-[#073126] tracking-[-0.02em]" data-price>
                        {isComingSoon ? "Contact for price" : formatPrice(l.price, l.priceType)}
                        <span data-brokerage style={SOURCE_STYLE}>{SOURCE_LINE}</span>
                      </p>
                      <p className="text-[13px] text-[#6b6f6a] mt-1">
                        {l.address}
                        {l.city ? `, ${l.city}` : ""}
                      </p>
                      <p className="text-[12px] text-[#4f534f] mt-2">
                        {formatBeds(l.bedsMin, l.bedsMax)} · {l.baths} bath · {l.parking} parking
                      </p>
                      <p className="text-[12px] text-[#6b6f6a] mt-1">{l.propertyType}</p>

                      <div className="mt-4 flex gap-2 relative z-10">
                        {isComingSoon ? (
                          <a
                            href={`tel:${config.realtor.phoneE164}`}
                            className="flex-1 bg-[#00ff80] text-[#04160f] font-bold rounded-xl px-4 py-2 text-[13px] text-center hover:bg-[#5cffa8]"
                          >
                            Get notified →
                          </a>
                        ) : (
                          <>
                            <a
                              href="tel:+16478399090"
                              className="flex-1 bg-[#00ff80] text-[#04160f] font-bold rounded-xl px-4 py-2 text-[13px] text-center hover:bg-[#5cffa8]"
                            >
                              Call {config.realtor.name.split(" ")[0]}
                            </a>
                            <a
                              href="https://wa.me/16478399090"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-[#073126] text-[#fffdfa] font-bold rounded-xl px-4 py-2 text-[13px] text-center border border-[#1c5a45] hover:bg-[#0a8f57]"
                            >
                              WhatsApp
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
    </SiteChrome>
  );
}
