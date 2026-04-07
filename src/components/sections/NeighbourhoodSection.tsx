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
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900">
            Explore Milton Neighbourhoods
          </h2>
          <p className="text-neutral-600 mt-2">
            Every neighbourhood at a glance — prices, schools, commute times, and
            active listings.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {neighbourhoods.map((n) => (
            <Link
              key={n.name}
              href={`/neighbourhoods/${n.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="group bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Photo placeholder */}
              <div className="aspect-[16/9] bg-gradient-to-br from-brand-100 to-brand-50 relative flex items-center justify-center">
                <span className="text-brand-300 text-lg font-semibold">
                  {n.name}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold text-neutral-900 group-hover:text-brand-600 transition-colors">
                  {n.name}
                </h3>
                <div className="grid grid-cols-2 gap-y-2 mt-3 text-sm">
                  <div>
                    <p className="text-neutral-400 text-xs">Avg. Price</p>
                    <p className="font-semibold text-neutral-800">{n.avgPrice}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 text-xs">Active Listings</p>
                    <p className="font-semibold text-neutral-800">{n.activeListings}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 text-xs">Top School</p>
                    <p className="font-medium text-neutral-700 text-xs">{n.topSchool}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 text-xs">GO Walk</p>
                    <p className="font-semibold text-neutral-800">{n.goWalkMin} min</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
