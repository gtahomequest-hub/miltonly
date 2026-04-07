import Link from "next/link";

export default function SellerSection() {
  return (
    <section className="bg-neutral-900">
      <div className="section-container section-padding">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-sm font-semibold text-accent-400 uppercase tracking-wide">
            Thinking of selling?
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mt-3">
            Find out your Milton home&apos;s value in 30 seconds
          </h2>
          <p className="text-neutral-400 mt-4 text-lg">
            Enter your street name and see what homes on your street have sold for.
            No signup required.
          </p>

          {/* Street name input */}
          <div className="mt-8 max-w-lg mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder='Enter your street name — e.g. "Laurier Ave"'
                className="flex-1 px-5 py-4 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-lg"
              />
            </div>
            <Link
              href="/sell"
              className="btn-accent block w-full !py-4 text-lg mt-4 text-center"
            >
              See What Homes On My Street Sold For
            </Link>
          </div>

          <p className="text-neutral-600 text-sm mt-6">
            Free. Based on real TREB sold data. No obligation.
          </p>
        </div>
      </div>
    </section>
  );
}
