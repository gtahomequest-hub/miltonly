export default function BuyerAlertSection() {
  return (
    <section className="bg-gradient-to-br from-brand-50 via-white to-brand-50/50">
      <div className="section-container py-14 lg:py-16">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {/* Left — Listing alert */}
          <div className="card p-6 sm:p-8 border-brand-100">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              </span>
              <h3 className="text-xl font-extrabold text-navy">
                Never miss a new listing
              </h3>
            </div>
            <p className="text-neutral-500 text-sm leading-relaxed mb-6">
              Get alerted the moment a home matching your criteria hits the Milton
              market. Faster than Realtor.ca.
            </p>
            <form className="flex gap-3">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              />
              <button type="submit" className="btn-primary shrink-0 !rounded-xl">
                Alert Me
              </button>
            </form>
          </div>

          {/* Right — Saved search */}
          <div className="card p-6 sm:p-8 border-brand-100">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 bg-accent-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
              </span>
              <h3 className="text-xl font-extrabold text-navy">
                Save your search
              </h3>
            </div>
            <p className="text-neutral-500 text-sm leading-relaxed mb-6">
              Save your current filters and get instant alerts when matching homes
              list — plus price drop notifications.
            </p>
            <form className="flex gap-3">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              />
              <button type="submit" className="btn-accent shrink-0 !rounded-xl">
                Save Search
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
