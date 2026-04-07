import Link from "next/link";

export default function MapSection() {
  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="text-center mb-10">
          <span className="section-label text-brand-500">Interactive Map</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy mt-2">
            Explore Milton on the Map
          </h2>
          <p className="text-neutral-500 mt-3 max-w-xl mx-auto">
            Live listing pins, GO train walk times, school zones, and sold price
            heat maps. All in one interactive view.
          </p>
        </div>

        <div className="relative aspect-[16/9] lg:aspect-[21/9] bg-gradient-to-br from-navy-50 to-brand-50 rounded-2xl border border-neutral-200 overflow-hidden shadow-card">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
            <svg className="w-14 h-14 mb-3 text-brand-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-base font-semibold text-neutral-500">Interactive Mapbox Map</p>
            <p className="text-sm text-neutral-400 mt-1">Coming in Phase 6</p>
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-2">
            {["GO Stations", "Schools", "Parks", "Sold Heat Map"].map((layer) => (
              <button
                key={layer}
                className="px-3.5 py-2 text-xs font-semibold bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-neutral-200 text-neutral-600 hover:bg-white transition-colors"
              >
                {layer}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <Link href="/map" className="btn-secondary">
            Open Full Map
          </Link>
        </div>
      </div>
    </section>
  );
}
