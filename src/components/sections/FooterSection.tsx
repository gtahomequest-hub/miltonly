import Link from "next/link";

export default function FooterSection() {
  return (
    <>
      {/* Final CTA */}
      <section className="bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900/50 to-transparent pointer-events-none" />
        <div className="relative section-container py-16 lg:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            Ready to make your<br className="hidden sm:block" /> move in Milton?
          </h2>
          <p className="text-white/40 mt-4 text-lg max-w-lg mx-auto">
            Whether you&apos;re buying, selling, or investing — start here.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link href="/listings" className="btn-primary !px-8 !py-3.5 !text-base">
              Browse Homes
            </Link>
            <Link href="/sell" className="btn-outline-white !px-8 !py-3.5 !text-base">
              Get Home Value
            </Link>
            <Link href="/compare" className="btn-outline-white !px-8 !py-3.5 !text-base">
              Compare Areas
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-800">
        <div className="section-container py-14 lg:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="text-xl font-extrabold text-white">
                miltonly
              </Link>
              <p className="text-neutral-500 text-sm mt-4 max-w-xs leading-relaxed">
                Milton Ontario&apos;s only dedicated real estate platform. Street
                intelligence, school zones, GO commute data, and market reports.
              </p>
              <form className="mt-6 flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
                <button type="submit" className="px-4 py-2.5 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
                  Subscribe
                </button>
              </form>
            </div>

            {/* Site */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Site
              </h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/listings", label: "Buy" },
                  { href: "/listings/rent", label: "Rent" },
                  { href: "/sell", label: "Sell" },
                  { href: "/compare", label: "Compare" },
                  { href: "/map", label: "Map" },
                  { href: "/market-report", label: "Market Report" },
                  { href: "/blog", label: "Blog" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-neutral-500 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Neighbourhoods */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Neighbourhoods
              </h4>
              <ul className="space-y-2.5">
                {["Willmott", "Coates", "Clarke", "Beaty", "Dempsey", "Old Milton", "Hawthorne Village", "Scott", "Harrison"].map((n) => (
                  <li key={n}>
                    <Link href={`/neighbourhoods/${n.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm text-neutral-500 hover:text-white transition-colors">
                      {n}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Contact
              </h4>
              <ul className="space-y-2.5 text-sm text-neutral-500">
                <li>Milton, Ontario</li>
                <li><Link href="/book" className="hover:text-white transition-colors">Book a Call</Link></li>
                <li><Link href="/partners" className="hover:text-white transition-colors">Partner Network</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 pt-8 border-t border-white/[0.06]">
            <div className="flex flex-col sm:flex-row justify-between gap-4 text-xs text-neutral-600">
              <p>&copy; {new Date().getFullYear()} Miltonly.com. All rights reserved.</p>
              <div className="flex gap-5">
                <Link href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-neutral-400 transition-colors">Terms</Link>
                <Link href="/sitemap.xml" className="hover:text-neutral-400 transition-colors">Sitemap</Link>
              </div>
            </div>
            <p className="text-[11px] text-neutral-700 mt-4 leading-relaxed max-w-3xl">
              The listing data is provided under copyright by the Toronto Regional
              Real Estate Board (TREB). The data is deemed reliable but is not
              guaranteed to be accurate.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
