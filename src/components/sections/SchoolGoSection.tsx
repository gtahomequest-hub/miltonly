import Link from "next/link";

const schools = [
  "Craig Kielburger",
  "Bishop Reding",
  "Milton District",
  "Stuart E. Russel",
  "E.W. Foster",
  "Anne J. MacArthur",
];

export default function SchoolGoSection() {
  return (
    <section className="bg-neutral-50/70">
      <div className="section-container section-padding">
        <div className="text-center mb-10">
          <span className="section-label text-brand-500">Location Intelligence</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
            Schools &amp; GO Commute
          </h2>
          <p className="text-neutral-500 mt-3 max-w-lg mx-auto">
            No other Milton site lets you search by school zone or GO train walk time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* School Zone Search */}
          <div className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              <h3 className="text-xl font-extrabold text-navy">School Zone Search</h3>
            </div>
            <p className="text-neutral-500 text-sm mb-5">
              Find homes in the right school catchment area.
            </p>
            <div className="space-y-1.5">
              {schools.map((school) => (
                <Link
                  key={school}
                  href={`/listings?q=${encodeURIComponent(school)}`}
                  className="flex items-center justify-between p-3.5 bg-neutral-50 hover:bg-brand-50 rounded-xl text-sm font-medium text-neutral-700 hover:text-brand-600 transition-all group"
                >
                  {school}
                  <svg className="w-4 h-4 text-neutral-300 group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
              ))}
            </div>
          </div>

          {/* GO Commute */}
          <div className="card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <h3 className="text-xl font-extrabold text-navy">GO Train Commute</h3>
            </div>
            <p className="text-neutral-500 text-sm mb-5">
              Show homes within walking distance to Milton GO station.
            </p>
            <div className="space-y-1.5 mb-6">
              {[
                { time: "5 min walk", count: 42 },
                { time: "10 min walk", count: 128 },
                { time: "15 min walk", count: 215 },
                { time: "20 min walk", count: 340 },
              ].map((option) => (
                <Link
                  key={option.time}
                  href="/streets"
                  className="flex items-center justify-between p-3.5 bg-neutral-50 hover:bg-accent-50 rounded-xl text-sm transition-all group"
                >
                  <span className="font-medium text-neutral-700 group-hover:text-accent-700">
                    {option.time}
                  </span>
                  <span className="text-neutral-400 text-xs font-medium">
                    {option.count} homes
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/streets" className="btn-secondary w-full text-center block !rounded-xl">
              View All GO Commute Homes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
