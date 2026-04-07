export default function TrustBarSection() {
  return (
    <section className="bg-neutral-50 border-y border-neutral-100">
      <div className="section-container py-8">
        {/* Row 1 — Trust indicators */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-neutral-600 mb-6">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
            500+ Milton families helped
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            4.9 Google rating
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 011 1v3a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Live TREB data
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
            Milton-only specialist
          </span>
        </div>

        {/* Row 2 — Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Avg. Sold Price", value: "$1,125,000", change: "+3.2%" },
            { label: "Listed Today", value: "47", change: "New" },
            { label: "Avg. Days on Market", value: "18", change: "-2 days" },
            { label: "Sold This Week", value: "23", change: "+5" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 bg-white rounded-lg border border-neutral-100"
            >
              <p className="text-2xl lg:text-3xl font-bold text-neutral-900">
                {stat.value}
              </p>
              <p className="text-sm text-neutral-500 mt-1">{stat.label}</p>
              <span className="text-xs font-medium text-accent-600 mt-1 inline-block">
                {stat.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
