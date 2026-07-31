// src/lib/ai/condoView.ts
// Server-side sanitizer: turns the full Build A payload into a MINIMAL, display-safe view model
// for the client page. CRITICAL: the client component's props are serialized into the page HTML,
// so ONLY compliance-safe values may cross this boundary — k-gated medians, proportions, banded
// velocity, and the resolved strings we actually render. NO raw transaction counts (saleN/leaseN/
// sale12mo…), NO rawTop/detail arrays, NO thresholds that name a small count, NO management/name
// raw variants. Everything a viewer could read in "view source" is decided here.
import type { BuildingAttributes } from "./buildingAttributes.types";

type Attrs = Omit<BuildingAttributes, "_debug">;

// ACTIVITY (Ruling 2) — the past-12-month sale-vs-lease TRANSACTION mix, labeled as activity, NOT
// occupancy/tenure (sold != owner-occupied). % split only when BOTH sides clear 5 (so no sub-5
// count is back-derivable); approximate counts only when >=5; otherwise qualitative.
export type Activity =
  | { mode: "split"; salesPct: number; leasesPct: number; salesApprox: number; leasesApprox: number }
  | { mode: "qual"; leaseHeavy: boolean }
  | { mode: "none" };

export interface CondoView {
  name: string;
  neighbourhood: string;
  identityOnly: boolean;
  saleTypical: boolean;
  saleRange: boolean;
  leaseTypical: boolean;
  hasBridge: boolean;
  hasTrades: boolean;
  // k-gated figures only (null below k>=5)
  buy: number | null;
  rent: number | null;
  yieldPct: number | null;
  area: number | null;
  // aggregate viz (proportions / bands only)
  activity: Activity;
  saleVelo: string; // banded word, never a count
  leaseVelo: string;
  totalTradesLabel: number | null; // only when >=10 (safe aggregate)
  // per-bed: ONLY fully-qualified rows (yield present => both sides cleared k>=5); no raw N
  perBed: Array<{ beds: number; yieldPct: number; buy: number | null; rent: number | null }>;
  amenities: string[];
  amenitiesRecords: number | null; // only when >=5
  feeStated: boolean;
  feeItems: string[];
  management: string | null;
  narrative: string | null;
}

// qualitative velocity band — computed here from the raw count, but only the WORD leaves the server.
function velo(n: number): string {
  if (n >= 12) return "Briskly";
  if (n >= 6) return "Steadily";
  if (n >= 1) return "Occasionally";
  return "Rarely";
}

// Amenity synonym-merge (Fix 2). Build A vets amenities at >=2 sales but leaves TREB synonyms as
// separate strings (Gym / Exercise Room, BBQs Allowed / Community BBQ, Party Room / Meeting Room /
// combined). Collapse each real amenity to one canonical label, deduped, first-seen order (which is
// count-desc from Build A).
const AMENITY_CANON: Array<{ canon: string; syn: string[] }> = [
  { canon: "Gym", syn: ["gym", "exercise room", "fitness", "fitness centre", "fitness center", "workout room", "gym/exercise room"] },
  { canon: "Party & Meeting Room", syn: ["party room", "meeting room", "party room/meeting room", "party/meeting room", "party & meeting room", "party rm", "meeting rm"] },
  { canon: "BBQ Area", syn: ["bbq", "bbqs allowed", "community bbq", "barbeque", "barbecue", "bbq area"] },
  { canon: "Rooftop Deck", syn: ["rooftop deck", "roof deck", "rooftop terrace", "rooftop patio", "sundeck", "rooftop deck/garden"] },
  { canon: "Garden", syn: ["garden", "courtyard"] },
  { canon: "Media Room", syn: ["media room", "theatre", "theater", "screening room"] },
  { canon: "Game Room", syn: ["game room", "games room", "billiards", "billiard room"] },
  { canon: "Recreation Room", syn: ["recreation room", "rec room"] },
  { canon: "Pool", syn: ["pool", "indoor pool", "outdoor pool", "swimming pool", "lap pool"] },
  { canon: "Bike Storage", syn: ["bike storage", "bicycle storage"] },
  { canon: "Elevator", syn: ["elevator", "elevators", "lift"] },
  { canon: "Guest Suites", syn: ["guest suites", "guest suite"] },
  { canon: "Concierge", syn: ["concierge"] },
  { canon: "Security", syn: ["security guard", "security system", "24 hour security", "gatehouse", "security"] },
  { canon: "Car Wash", syn: ["car wash"] },
  { canon: "Visitor Parking", syn: ["visitor parking"] },
  { canon: "Sauna", syn: ["sauna"] },
];
const AMEN_LOOKUP = new Map<string, string>();
for (const g of AMENITY_CANON) for (const s of g.syn) AMEN_LOOKUP.set(s, g.canon);
const normAmen = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]+/g, "").replace(/\s+/g, " ").trim();

export function canonicalizeAmenities(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const canon = AMEN_LOOKUP.get(normAmen(it)) ?? it.trim();
    const k = canon.toLowerCase();
    if (!canon || seen.has(k)) continue;
    seen.add(k);
    out.push(canon);
  }
  return out;
}

function activity(a: Attrs): Activity {
  const s = a.records.sale12mo, l = a.records.lease12mo, t = s + l;
  if (s >= 5 && l >= 5) {
    const salesPct = Math.round((s / t) * 100);
    return { mode: "split", salesPct, leasesPct: 100 - salesPct, salesApprox: s, leasesApprox: l };
  }
  if (Math.max(s, l) >= 5) return { mode: "qual", leaseHeavy: l > s };
  return { mode: "none" };
}

export function toCondoView(a: Attrs, narrative: string | null): CondoView {
  const total = a.records.saleAll + a.records.leaseAll;
  return {
    name: a.buildingName.name,
    neighbourhood: a.areaContext.neighbourhoodName ?? "Milton",
    identityOnly: a.kFloors.identityOnly,
    saleTypical: a.kFloors.saleTypical,
    saleRange: a.kFloors.saleRange,
    leaseTypical: a.kFloors.leaseTypical,
    hasBridge: a.records.total > 1 && (a.records.saleAll > 0 || a.records.leaseAll > 0),
    hasTrades: a.records.total > 1,
    buy: a.gyield.saleMedian,
    rent: a.gyield.leaseMedian,
    yieldPct: a.gyield.headlinePct,
    area: a.areaContext.typicalCondo,
    activity: activity(a),
    saleVelo: a.kFloors.saleTypical ? velo(a.records.sale12mo) : "Rarely",
    leaseVelo: a.records.lease12mo >= 1 ? velo(a.records.lease12mo) : "Rarely",
    totalTradesLabel: total >= 10 ? total : null,
    perBed: a.gyield.perBed
      .filter((p) => p.yieldPct != null)
      .map((p) => ({ beds: p.beds, yieldPct: p.yieldPct as number, buy: p.saleMedian, rent: p.leaseMedian })),
    amenities: canonicalizeAmenities(a.amenities.rendered), // synonym-merged + deduped (Fix 2)
    amenitiesRecords: a.amenities.recordsWithAny >= 5 ? a.amenities.recordsWithAny : null,
    feeStated: a.feeIncludes.stated,
    feeItems: a.feeIncludes.stated ? a.feeIncludes.items : [],
    management: a.management.company,
    narrative,
  };
}
