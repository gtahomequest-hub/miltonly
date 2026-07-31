// Public payload types for the condo building attributes (Build A → Build B render).
// Server-free (no prisma / DB imports) so the 'use client' page can import the shape safely.
export interface AmenityCount {
  amenity: string;
  count: number;
}

export interface BuildingAttributes {
  slug: string;
  displayName: string;
  clusterKeys: string[];
  records: { total: number; saleAll: number; leaseAll: number; sale12mo: number; lease12mo: number };
  kFloors: { saleTypical: boolean; saleRange: boolean; leaseTypical: boolean; identityOnly: boolean };
  amenities: { rendered: string[]; detail: AmenityCount[]; recordsWithAny: number; note: string | null; label: string };
  feeIncludes: { items: string[]; detail: AmenityCount[]; recordsCarrying: number; threshold: number; stated: boolean; note: string | null };
  management: { company: string | null; allTimeCompany: string | null; window: "recent" | "all-time" | "none"; recentCount: number; mostRecent: string | null; rawTop: AmenityCount[]; note: string | null };
  buildingName: { name: string; source: "association_name" | "address"; isRealName: boolean; rawTop: AmenityCount[]; note: string | null };
  gyield: {
    headlinePct: number | null;
    saleMedian: number | null; // k-gated (null below k>=5)
    leaseMedian: number | null; // k-gated
    perBed: Array<{ beds: number; yieldPct: number | null; saleMedian: number | null; leaseMedian: number | null; saleN: number; leaseN: number }>;
    note: string | null;
  };
  areaContext: { neighbourhoodSlug: string | null; neighbourhoodName: string | null; typicalCondo: number | null; label: string };
  vow: { hasIndividualPrice: false; subKPriceSuppressed: boolean };
  // battery-only raw material (no prices) — lets the reviewer verify the folds by hand.
  _debug: { amenitiesPerRecord: string[][]; feePerRecord: string[][]; mgmtValues: string[]; nameValues: string[] };
}
