// src/lib/ai/condoView.ts
// Server-side sanitizer: turns the full Build A payload into a MINIMAL, display-safe view model
// for the client page. CRITICAL: the client component's props are serialized into the page HTML,
// so ONLY compliance-safe values may cross this boundary — k-gated medians, proportions, banded
// velocity, and the resolved strings we actually render. NO raw transaction counts (saleN/leaseN/
// sale12mo…), NO rawTop/detail arrays, NO thresholds that name a small count, NO management/name
// raw variants. Everything a viewer could read in "view source" is decided here.
import type { BuildingAttributes } from "./buildingAttributes.types";

type Attrs = Omit<BuildingAttributes, "_debug">;

export type Ownership =
  | { mode: "split"; ownerPct: number; rentPct: number }
  | { mode: "qual"; rentHeavy: boolean }
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
  ownership: Ownership;
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

function ownership(a: Attrs): Ownership {
  const s = a.records.saleAll, l = a.records.leaseAll, t = s + l;
  if (t < 10) return { mode: "none" };
  if (Math.min(s, l) >= 5) { const ownerPct = Math.round((s / t) * 100); return { mode: "split", ownerPct, rentPct: 100 - ownerPct }; }
  return { mode: "qual", rentHeavy: l > s };
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
    ownership: ownership(a),
    saleVelo: a.kFloors.saleTypical ? velo(a.records.sale12mo) : "Rarely",
    leaseVelo: a.records.lease12mo >= 1 ? velo(a.records.lease12mo) : "Rarely",
    totalTradesLabel: total >= 10 ? total : null,
    perBed: a.gyield.perBed
      .filter((p) => p.yieldPct != null)
      .map((p) => ({ beds: p.beds, yieldPct: p.yieldPct as number, buy: p.saleMedian, rent: p.leaseMedian })),
    amenities: a.amenities.rendered,
    amenitiesRecords: a.amenities.recordsWithAny >= 5 ? a.amenities.recordsWithAny : null,
    feeStated: a.feeIncludes.stated,
    feeItems: a.feeIncludes.stated ? a.feeIncludes.items : [],
    management: a.management.company,
    narrative,
  };
}
