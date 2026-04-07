import Link from "next/link";

export default function FooterSection() {
  return (
    <>
      {/* Final CTA strip */}
      <section className="bg-brand-600">
        <div className="section-container py-12 lg:py-16 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            Ready to make your move in Milton?
          </h2>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link href="/listings" className="px-6 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-neutral-100 transition-colors">
              Browse Homes
            </Link>
            <Link href="/sell" className="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-colors">
              Get Home Value
            </Link>
            <Link href="/compare" className="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-colors">
              Compare Areas
            </Link>
            <Link href="/book" className="px-6 py-3 bg-accent-500 text-white font-semibold rounded-lg hover:bg-accent-600 transition-colors">
              Book a Free Call
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900">
        <div className="section-container py-12 lg:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="text-2xl font-bold text-white">
                Miltonly
              </Link>
              <p className="text-neutral-400 text-sm mt-3 max-w-sm">
                Milton Ontario&apos;s only dedicated real estate platform. Street
                intelligence, school zones, GO commute data, and market reports
                — updated daily.
              </p>
              {/* Newsletter */}
              <form className="mt-6 flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button type="submit" className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                  Subscribe
                </button>
              </form>
            </div>

            {/* Site links */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
                Site
              </h4>
              <ul className="space-y-2">
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
                    <Link href={link.href} className="text-sm text-neutral-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Neighbourhoods */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
                Neighbourhoods
              </h4>
              <ul className="space-y-2">
                {[
                  "Willmott", "Coates", "Clarke", "Beaty", "Dempsey",
                  "Old Milton", "Hawthorne Village", "Scott", "Harrison",
                ].map((n) => (
                  <li key={n}>
                    <Link
                      href={`/neighbourhoods/${n.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {n}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
                Contact
              </h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>Milton, Ontario</li>
                <li>
                  <Link href="/book" className="hover:text-white transition-colors">
                    Book a Call
                  </Link>
                </li>
                <li>
                  <Link href="/partners" className="hover:text-white transition-colors">
                    Partner Network
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-neutral-800">
            <div className="flex flex-col sm:flex-row justify-between gap-4 text-xs text-neutral-500">
              <p>
                &copy; {new Date().getFullYear()} Miltonly.com. All rights reserved.
              </p>
              <div className="flex gap-4">
                <Link href="/privacy" className="hover:text-neutral-300 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-neutral-300 transition-colors">
                  Terms
                </Link>
                <Link href="/sitemap.xml" className="hover:text-neutral-300 transition-colors">
                  Sitemap
                </Link>
              </div>
            </div>
            <p className="text-xs text-neutral-600 mt-4 leading-relaxed">
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
