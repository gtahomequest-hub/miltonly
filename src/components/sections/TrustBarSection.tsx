export default function TrustBarSection() {
  return (
    <section className="bg-white border-b border-neutral-100">
      <div className="section-container py-10">
        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-neutral-500 mb-8">
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-accent-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
            </span>
            <span className="font-medium text-neutral-700">500+ Milton families helped</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-gold-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-gold-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            </span>
            <span className="font-medium text-neutral-700">4.9 Google rating</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </span>
            <span className="font-medium text-neutral-700">Live TREB data</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
            </span>
            <span className="font-medium text-neutral-700">Milton-only specialist</span>
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Avg. Sold Price", value: "$1,125,000", change: "+3.2%", up: true },
            { label: "Listed Today", value: "47", change: "New today", up: true },
            { label: "Avg. Days on Market", value: "18", change: "-2 days", up: false },
            { label: "Sold This Week", value: "23", change: "+5 vs last week", up: true },
          ].map((stat) => (
            <div key={stat.label} className="card p-5 text-center">
              <p className="text-3xl lg:text-4xl font-extrabold text-navy tracking-tight">
                {stat.value}
              </p>
              <p className="text-sm text-neutral-500 mt-2">{stat.label}</p>
              <span className={`inline-flex items-center gap-1 text-xs font-bold mt-2 ${stat.up ? "text-accent-500" : "text-brand-500"}`}>
                <svg className={`w-3 h-3 ${stat.up ? "" : "rotate-180"}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                {stat.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
