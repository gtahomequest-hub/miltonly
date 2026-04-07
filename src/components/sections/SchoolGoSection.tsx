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
    <section className="bg-neutral-50">
      <div className="section-container section-padding">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Left — School Zone Search */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900">
                School Zone Search
              </h3>
            </div>
            <p className="text-neutral-600 text-sm mb-6">
              Find homes in the right school catchment. See which homes feed into
              the school you want.
            </p>
            <div className="space-y-2">
              {schools.map((school) => (
                <Link
                  key={school}
                  href={`/school-zones/${school.toLowerCase().replace(/[\s.]+/g, "-")}`}
                  className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-brand-50 rounded-lg text-sm font-medium text-neutral-700 hover:text-brand-700 transition-colors group"
                >
                  {school}
                  <svg className="w-4 h-4 text-neutral-400 group-hover:text-brand-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Right — GO Commute Filter */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-neutral-900">
                GO Train Commute
              </h3>
            </div>
            <p className="text-neutral-600 text-sm mb-6">
              Show homes within walking distance to Milton GO station. Filter by
              walk time.
            </p>

            {/* Walk time options */}
            <div className="space-y-3 mb-6">
              {[
                { time: "5 min walk", count: 42 },
                { time: "10 min walk", count: 128 },
                { time: "15 min walk", count: 215 },
                { time: "20 min walk", count: 340 },
              ].map((option) => (
                <Link
                  key={option.time}
                  href={`/go-train?maxWalk=${option.time.split(" ")[0]}`}
                  className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-accent-50 rounded-lg text-sm transition-colors group"
                >
                  <span className="font-medium text-neutral-700 group-hover:text-accent-700">
                    {option.time}
                  </span>
                  <span className="text-neutral-400 text-xs">
                    {option.count} homes
                  </span>
                </Link>
              ))}
            </div>

            <Link href="/go-train" className="btn-secondary w-full text-center block">
              View All GO Commute Homes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
