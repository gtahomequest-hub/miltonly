import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatPrice(price: number, priceType: string) {
  if (priceType === "rent") return `$${price.toLocaleString()} / month`;
  return `$${price.toLocaleString()}`;
}

function formatBeds(bedsMin: number, bedsMax: number) {
  if (bedsMax > 0) return `${bedsMin}+${bedsMax} bed`;
  return `${bedsMin} bed`;
}

export default async function ExclusiveStrip() {
  const listings = await prisma.exclusiveListing.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <section className="bg-[#07111f] border-t border-[#1e3a5f] px-5 sm:px-11 py-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left side — copy + CTA */}
        <div className="lg:col-span-2 flex flex-col justify-center">
          <p className="text-[11px] font-bold text-[#f59e0b] tracking-[0.18em] mb-2">LISTED BY AAMIR YAQOOB</p>
          <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#f8f9fb] tracking-[-0.02em] leading-[1.1] mb-3">
            Exclusive Listings
          </h2>
          <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-5 max-w-md">
            Properties personally listed and represented by Aamir — off-market and exclusive opportunities in Milton and beyond.
          </p>
          <Link
            href="/exclusive"
            className="inline-block self-start bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-xl px-5 py-3 hover:bg-[#fbbf24] transition-colors"
          >
            View all exclusive listings →
          </Link>
        </div>

        {/* Right side — mini cards */}
        <div className="lg:col-span-3">
          {listings.length === 0 ? (
            <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-6 text-center">
              <p className="text-[15px] font-bold text-[#f8f9fb] mb-1">More listings coming soon</p>
              <p className="text-[12px] text-[#94a3b8] mb-4">Contact Aamir for off-market opportunities</p>
              <a
                href="tel:+16478399090"
                className="inline-block text-[13px] font-bold text-[#f59e0b] hover:underline"
              >
                📞 (647) 839-9090
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((l) => {
                const firstPhoto = l.photos[0];
                return (
                  <div key={l.id} className="bg-[#0c1e35] rounded-xl p-4 border border-[#1e3a5f] flex flex-col">
                    <Link href={`/exclusive/${l.slug}`} className="block relative rounded-lg overflow-hidden aspect-[4/3] bg-[#07111f] mb-3">
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={firstPhoto} alt={l.title} className="w-full h-full object-cover" />
                      ) : null}
                      <span className="absolute top-2 left-2 bg-[#f59e0b] text-[#07111f] text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {l.badge}
                      </span>
                    </Link>
                    <Link href={`/exclusive/${l.slug}`} className="block">
                      <p className="text-[16px] font-extrabold text-[#f8f9fb] tracking-[-0.01em]">
                        {formatPrice(l.price, l.priceType)}
                      </p>
                      <p className="text-[12px] text-[#94a3b8] mt-0.5">
                        {l.address}
                        {l.city ? `, ${l.city}` : ""}
                      </p>
                      <p className="text-[11px] text-[#64748b] mt-1">
                        {formatBeds(l.bedsMin, l.bedsMax)} · {l.baths} bath
                      </p>
                    </Link>
                    <a
                      href="tel:+16478399090"
                      className="mt-3 block text-center bg-[#f59e0b] text-[#07111f] text-[12px] font-bold rounded-lg py-2 hover:bg-[#fbbf24]"
                    >
                      📞 Contact Aamir
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
