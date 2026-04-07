import Link from "next/link";

export default function MapSection() {
  return (
    <section className="bg-white">
      <div className="section-container section-padding">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-neutral-900">
            Explore Milton on the Map
          </h2>
          <p className="text-neutral-600 mt-2">
            Live listing pins, GO train walk times, school zones, and sold price
            heat maps. All in one view.
          </p>
        </div>

        {/* Map placeholder */}
        <div className="relative aspect-[16/9] lg:aspect-[21/9] bg-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-lg font-medium">Interactive Map</p>
            <p className="text-sm mt-1">Mapbox integration coming in Phase 6</p>
          </div>

          {/* Map layer toggle buttons (visual preview) */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            {["GO Stations", "Schools", "Parks", "Sold Heat Map"].map((layer) => (
              <button
                key={layer}
                className="px-3 py-1.5 text-xs font-medium bg-white rounded-md shadow-sm border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              >
                {layer}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/map" className="btn-secondary">
            Open Full Map
          </Link>
        </div>
      </div>
    </section>
  );
}
