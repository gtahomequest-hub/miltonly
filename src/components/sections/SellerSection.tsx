import Link from "next/link";
import { config } from "@/lib/config";

export default function SellerSection() {
  return (
    <section className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700">
      <div className="section-container section-padding-lg">
        <div className="max-w-2xl mx-auto text-center">
          <span className="section-label text-white/60 tracking-[0.2em]">
            Thinking of Selling?
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mt-4 leading-tight">
            Find out your {config.CITY_NAME} home&apos;s value in 30 seconds
          </h2>
          <p className="text-white/50 mt-5 text-lg leading-relaxed">
            Enter your street name and see what homes on your street have sold for.
            No signup required.
          </p>

          <div className="mt-10 max-w-lg mx-auto">
            <div className="relative">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                type="text"
                placeholder='Enter your street name — e.g. "Laurier Ave"'
                className="w-full pl-12 pr-5 py-5 bg-white/10 border border-white/20 rounded-2xl text-white text-lg placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
            </div>
            <Link
              href="/sell"
              className="block w-full mt-4 py-4 bg-white text-brand-600 text-lg font-bold rounded-2xl text-center hover:bg-neutral-50 transition-colors shadow-lg"
            >
              See What Homes On My Street Sold For
            </Link>
          </div>

          <p className="text-white/30 text-sm mt-6">
            Free. Based on real TREB sold data. No obligation.
          </p>
        </div>
      </div>
    </section>
  );
}
