export default function InvestorSection() {
  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left — copy */}
            <div>
              <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">
                For Investors
              </span>
              <h2 className="text-3xl font-bold text-neutral-900 mt-3">
                Investing in Milton? Get the data first.
              </h2>
              <p className="text-neutral-600 mt-4">
                Download the free Milton Investor Report — rental yields by
                neighbourhood, best streets for appreciation, price growth
                trends, new development map, and cap rates.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Rental yield by neighbourhood",
                  "Best streets for price growth",
                  "New development zone map",
                  "Cap rate calculations",
                  "Owner vs. renter ratio data",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-neutral-700">
                    <svg className="w-5 h-5 text-accent-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — capture form */}
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6 lg:p-8">
              <h3 className="text-lg font-bold text-neutral-900 mb-2">
                Free Milton Investor Report
              </h3>
              <p className="text-sm text-neutral-500 mb-6">
                PDF delivered instantly to your inbox.
              </p>
              <form className="space-y-4">
                <input
                  type="email"
                  placeholder="Your email address"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="btn-primary w-full"
                >
                  Download Free Report
                </button>
                <p className="text-xs text-neutral-400 text-center">
                  No spam. Unsubscribe anytime.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
