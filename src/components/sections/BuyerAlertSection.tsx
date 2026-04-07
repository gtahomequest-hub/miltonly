export default function BuyerAlertSection() {
  return (
    <section className="bg-brand-600">
      <div className="section-container py-12 lg:py-16">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {/* Left — Listing alert */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              Never miss a new listing
            </h3>
            <p className="text-brand-100">
              Get alerted the moment a home matching your criteria hits the Milton
              market. Faster than Realtor.ca.
            </p>
            <form className="flex gap-3">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-neutral-100 transition-colors shrink-0"
              >
                Alert Me
              </button>
            </form>
          </div>

          {/* Right — Saved search */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              Save your search
            </h3>
            <p className="text-brand-100">
              Save your current filters and get instant alerts when matching homes
              list — plus price drop notifications on saved listings.
            </p>
            <form className="flex gap-3">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-neutral-100 transition-colors shrink-0"
              >
                Save Search
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
