export default function InvestorSection() {
  return (
    <section className="bg-navy">
      <div className="section-container section-padding">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left — copy */}
            <div>
              <span className="section-label text-gold-400 tracking-[0.2em]">
                For Investors
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 leading-tight">
                Investing in Milton?<br />Get the data first.
              </h2>
              <p className="text-white/40 mt-5 leading-relaxed">
                Download the free Milton Investor Report — rental yields by
                neighbourhood, best streets for appreciation, price growth
                trends, and cap rates.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  "Rental yield by neighbourhood",
                  "Best streets for price growth",
                  "New development zone map",
                  "Cap rate calculations",
                  "Owner vs. renter ratio data",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                    <span className="w-5 h-5 bg-gold-500/20 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — capture form */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-gold-400/20 to-gold-600/10 rounded-[20px] blur-lg" />
              <div className="relative bg-white/[0.05] backdrop-blur-sm rounded-2xl border border-white/10 p-7 sm:p-8">
                <div className="inline-flex items-center gap-2 bg-gold-500/15 text-gold-400 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase mb-4">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  Free Download
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1">
                  Milton Investor Report
                </h3>
                <p className="text-sm text-white/30 mb-6">
                  PDF delivered instantly to your inbox.
                </p>
                <form className="space-y-4">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="w-full px-5 py-4 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400/30 transition-all"
                  />
                  <button
                    type="submit"
                    className="w-full py-4 bg-gold-500 hover:bg-gold-600 text-white font-bold rounded-xl transition-all shadow-lg"
                  >
                    Download Free Report
                  </button>
                  <p className="text-xs text-white/20 text-center">
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
