import Link from "next/link";

const neighbourhoods = [
  { name: "Willmott", avgPrice: "$1,125,000", activeListings: 24, topSchool: "Craig Kielburger", goWalkMin: 12 },
  { name: "Coates", avgPrice: "$985,000", activeListings: 18, topSchool: "E.W. Foster", goWalkMin: 20 },
  { name: "Clarke", avgPrice: "$1,275,000", activeListings: 15, topSchool: "Milton District", goWalkMin: 8 },
  { name: "Beaty", avgPrice: "$1,050,000", activeListings: 12, topSchool: "Stuart E. Russel", goWalkMin: 15 },
  { name: "Dempsey", avgPrice: "$895,000", activeListings: 21, topSchool: "Anne J. MacArthur", goWalkMin: 25 },
  { name: "Old Milton", avgPrice: "$825,000", activeListings: 9, topSchool: "Milton District", goWalkMin: 5 },
  { name: "Hawthorne Village", avgPrice: "$1,190,000", activeListings: 16, topSchool: "Bishop Reding", goWalkMin: 18 },
  { name: "Scott", avgPrice: "$920,000", activeListings: 14, topSchool: "Craig Kielburger", goWalkMin: 22 },
  { name: "Harrison", avgPrice: "$1,050,000", activeListings: 11, topSchool: "Bishop Reding", goWalkMin: 30 },
];

export default function NeighbourhoodSection() {
  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="text-center mb-12">
          <span className="section-label text-brand-500">Neighbourhoods</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
            Explore Milton Neighbourhoods
          </h2>
          <p className="text-neutral-500 mt-3 max-w-lg mx-auto">
            Every neighbourhood at a glance — prices, schools, commute times, and
            active listings.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {neighbourhoods.map((n) => (
            <Link
              key={n.name}
              href={`/neighbourhoods/${n.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="group relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[3/2]"
            >
              {/* Background gradient (photo placeholder) */}
              <div className="absolute inset-0 bg-gradient-to-br from-navy via-brand-800 to-navy-700 transition-all duration-500 group-hover:scale-105" />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-all duration-300" />

              {/* Content overlaid */}
              <div className="relative h-full flex flex-col justify-between p-5 sm:p-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    {n.name}
                  </h3>
                  <p className="text-white/60 text-sm mt-1">
                    {n.activeListings} active listings
                  </p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white">
                    {n.avgPrice}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                    <span>{n.topSchool}</span>
                    <span>{n.goWalkMin} min to GO</span>
                  </div>
                </div>
              </div>

              {/* Hover arrow */}
              <div className="absolute top-5 right-5 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
