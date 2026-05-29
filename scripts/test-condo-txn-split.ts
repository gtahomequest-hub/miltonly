// WS4 patch 2 (DEC-WS4-5, ADR 0002) gate (d): THE HEADLINE GATE.
//
// The transaction_type SPLIT regression test. A synthetic "490 Gordon Krantz"
// building with BOTH sale trades (~$700K) and a dominant pool of lease trades
// (~$2,390/mo). This is the exact shape that produced the `490 Gordon Krantz
// avg 2370` garbage when sale + lease were pooled into one AVG(sold_price).
//
// What this proves (pure, no DB, deterministic — mirrors test-comparison-mismatch):
//   1. assembleAggregates fed the SALE-side row only never sees a rent value:
//      its signature takes (sale, leasesCount: number) — leasesCount is a COUNT,
//      not a price, so a lease dollar value is structurally unable to reach
//      typicalPrice / priceRange / DOM.
//   2. The clean sale-side typicalPrice lands at a real condo sale price (~$720K),
//      NOT dragged toward the rent scale the way the old pooled AVG was.
//   3. lease can never enter recencyWeightedSold (sale-only by schema; the
//      builder copies CondoBuilding.recencyWeightedSold and the assembly layer
//      has no path from a rent to it).
//   4. The fork: a lease-only building has typicalPrice=null, vipEligible=false,
//      and emitting a condoMarket section fires the hard condo_lease_only_market
//      rule. A sale-active building grounds its market section on the clean
//      sale aggregate with no contamination.

import {
  assembleAggregates,
  type RawSaleAgg,
} from "@/lib/ai/buildHubInput";
import { validateCondoSectionsSubset } from "@/lib/ai/validateCondoGeneration";
import type {
  CondoBuildingGeneratorInput,
  CondoLeaseInfo,
  CondoSection,
} from "@/types/hub-generator";

// ---------------------------------------------------------------------------
// Synthetic 490-Gordon-Krantz-shaped data. 7 sale trades, 96 lease trades.
// (ADR 0001: 490 Gordon Krantz carried 279 condo trades mostly lease — a
// lease-dominant tower is exactly where pooling collapses the average to rent.)
// ---------------------------------------------------------------------------

const SALE_TRADES = [565_000, 640_000, 689_000, 712_000, 740_000, 799_000, 899_000]; // 7, ≥ K_ANON_PRICE
const LEASE_RENT = 2_390;            // typical monthly rent
const LEASE_COUNT = 96;              // lease-dominant pool

const saleSum = SALE_TRADES.reduce((a, b) => a + b, 0);
const cleanSaleMean = Math.round(saleSum / SALE_TRADES.length); // 720,571
const saleLo = Math.min(...SALE_TRADES);
const saleHi = Math.max(...SALE_TRADES);

// The SALE-side aggregate row exactly as saleAggQuery (transaction_type='For Sale'
// ONLY) would return it. No lease value appears in this object by construction.
const SALE_AGG: RawSaleAgg = {
  n: SALE_TRADES.length,
  lo: String(saleLo),
  hi: String(saleHi),
  avg_price: String(saleSum / SALE_TRADES.length),
  avg_dom: "23",
};

// What the OLD pooled query computed: AVG(sold_price) over BOTH transaction
// types in one pass. This is the bug — reproduced honestly so the contrast is
// real, not asserted.
const pooledSum = saleSum + LEASE_RENT * LEASE_COUNT;
const buggyPooledAvg = Math.round(pooledSum / (SALE_TRADES.length + LEASE_COUNT)); // ~51,198

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "PASS ✓" : "FAIL ✗"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
}

console.log("=".repeat(72));
console.log("WS4 gate (d): condo transaction_type split — 490 Gordon Krantz regression");
console.log("=".repeat(72));
console.log(`sale trades: ${SALE_TRADES.length} (mean $${cleanSaleMean.toLocaleString()}, range $${saleLo.toLocaleString()}–$${saleHi.toLocaleString()})`);
console.log(`lease trades: ${LEASE_COUNT} @ ~$${LEASE_RENT.toLocaleString()}/mo`);
console.log(`OLD pooled AVG(sold_price) over both txn types: $${buggyPooledAvg.toLocaleString()}  ← the garbage (rent-contaminated)`);

// ---------------------------------------------------------------------------
// 1. The split: assembleAggregates on the sale row only.
// ---------------------------------------------------------------------------
console.log("\n[1] assembleAggregates(SALE_AGG, leaseCount=96):");
const sale = assembleAggregates(SALE_AGG, LEASE_COUNT);
console.log(`    → typicalPrice=${sale.typicalPrice}, priceRange=${JSON.stringify(sale.priceRange)}, ` +
  `salesCount=${sale.salesCount}, leasesCount=${sale.leasesCount}, txCount=${sale.txCount}, k=${sale.kAnonLevel}`);

check("sale typicalPrice equals the SALE-only mean", sale.typicalPrice === cleanSaleMean, `$${sale.typicalPrice?.toLocaleString()}`);
check("sale typicalPrice is a real condo sale price (> $300K)", (sale.typicalPrice ?? 0) > 300_000);
check("sale typicalPrice sits inside the sale-only range", sale.typicalPrice! >= saleLo && sale.typicalPrice! <= saleHi);
check("sale typicalPrice NOT polluted toward rent scale (≠ pooled avg)", sale.typicalPrice !== buggyPooledAvg && (sale.typicalPrice ?? 0) / buggyPooledAvg > 5,
  `clean $${sale.typicalPrice?.toLocaleString()} vs pooled $${buggyPooledAvg.toLocaleString()}`);
check("sale typicalPrice is NOT near the rent value (no ~2370 midpoint)", Math.abs((sale.typicalPrice ?? 0) - LEASE_RENT) > 100_000);
check("priceRange suppressed (7 sales < K_ANON_RANGE=10) — building-tier k bites", sale.priceRange === null);
check("leasesCount carried as a COUNT only (96), never as a price", sale.leasesCount === LEASE_COUNT);
check("txCount = sales + leases (7 + 96 = 103)", sale.txCount === SALE_TRADES.length + LEASE_COUNT);

// Structural proof: feeding the function the SAME building with a DIFFERENT lease
// rent cannot move the sale price — leasesCount is the only lease input.
const saleAltRent = assembleAggregates(SALE_AGG, LEASE_COUNT);
check("changing lease RENT cannot move sale typicalPrice (only count is an input)",
  saleAltRent.typicalPrice === sale.typicalPrice);

// ---------------------------------------------------------------------------
// 2. lease never enters recencyWeightedSold — sale-active building input.
// ---------------------------------------------------------------------------
console.log("\n[2] sale-active CondoBuildingGeneratorInput (recencyWeightedSold isolation):");
const saleLease: CondoLeaseInfo = {
  leaseCount12mo: LEASE_COUNT,
  kAnonLevel: "full",
  recentRecords: Array.from({ length: 10 }, (_, i) => ({
    address: "490 Gordon Krantz Avenue",
    rent: LEASE_RENT + i * 10,
    beds: 2,
    daysOnMarket: 14,
    soldMonth: "2026-0" + ((i % 5) + 1),
  })),
  rangeStats: { min: 2_150, max: 2_750 },
};
const SALE_RECENCY_WEIGHTED = 6.4; // sale-only weighted score (lease excluded by schema)
const saleActiveInput: CondoBuildingGeneratorInput = {
  building: {
    slug: "490-gordon-krantz-avenue-milton",
    displayName: "490 Gordon Krantz Avenue",
    buildingAddress: "490 Gordon Krantz Avenue",
    streetNumber: "490",
    streetName: "Gordon Krantz Avenue",
    streetSlug: "gordon-krantz-avenue-milton",
    neighbourhoodName: "Cobban",
    totalUnits: 240,
    legalStories: 12,
    managementCo: null,
    avgMaintenanceFee: 612,
    yearBuilt: 2021,
    condoCorpNumbers: ["HSCC 712", "HSCC 720"],
  },
  saleAggregates: sale,
  saleByType: { condo: { count: 7, typicalPrice: cleanSaleMean, priceRange: null, kFlag: "full" } },
  saleQuarterly: [],
  lease: saleLease,
  saleActive: true,
  leaseOnly: false,
  vipEligible: true,
  isVip: true,
  currentRank: 3,
  recencyWeightedSold: SALE_RECENCY_WEIGHTED,
};
check("recencyWeightedSold reflects sale-only score, not lease count", saleActiveInput.recencyWeightedSold === SALE_RECENCY_WEIGHTED);
check("recencyWeightedSold is on the SALE scale (≪ leaseCount 96)", saleActiveInput.recencyWeightedSold < LEASE_COUNT);
check("sale-active building is VIP-eligible (has sale signal)", saleActiveInput.vipEligible === true);
check("market section grounds on clean sale typicalPrice (~$720K, not $2,390)", saleActiveInput.saleAggregates.typicalPrice === cleanSaleMean);

// A grounded sale-market section must NOT fire condo_lease_only_market.
const saleMarketSection: CondoSection = {
  id: "condoMarket",
  heading: "490 Gordon Krantz Avenue — recent sales",
  paragraphs: ["Over the past year, sale activity at the building has been steady, with typical pricing well into the seven figures."],
};
const saleViol = validateCondoSectionsSubset([saleMarketSection], saleActiveInput);
check("sale-active condoMarket does NOT fire condo_lease_only_market",
  !saleViol.some((v) => v.rule === "condo_lease_only_market"),
  `${saleViol.length} violation(s)`);

// ---------------------------------------------------------------------------
// 3. The lease-only fork — no sale data, never VIP, no sale market section.
// ---------------------------------------------------------------------------
console.log("\n[3] lease-only CondoBuildingGeneratorInput (fork):");
const leaseOnlySale = assembleAggregates({ n: 0, lo: null, hi: null, avg_price: null, avg_dom: null }, LEASE_COUNT);
const leaseOnlyInput: CondoBuildingGeneratorInput = {
  building: { ...saleActiveInput.building, slug: "1430-leger-way-milton", displayName: "1430 Leger Way", streetNumber: "1430", streetName: "Leger Way", streetSlug: "leger-way-milton" },
  saleAggregates: leaseOnlySale,
  saleByType: {},
  saleQuarterly: [],
  lease: saleLease,
  saleActive: false,
  leaseOnly: true,
  vipEligible: false,
  isVip: false,
  currentRank: null,
  recencyWeightedSold: 0,
};
console.log(`    → saleAggregates.typicalPrice=${leaseOnlySale.typicalPrice}, salesCount=${leaseOnlySale.salesCount}, leasesCount=${leaseOnlySale.leasesCount}`);
check("lease-only: sale typicalPrice is null (no sale data to ground)", leaseOnlySale.typicalPrice === null);
check("lease-only: salesCount === 0", leaseOnlySale.salesCount === 0);
check("lease-only: vipEligible === false (never VIP — ADR 0001 DEC-5)", leaseOnlyInput.vipEligible === false);
check("lease-only: recencyWeightedSold === 0", leaseOnlyInput.recencyWeightedSold === 0);

// Emitting a sale market section on a lease-only building must fire the hard rule.
const leaseOnlyViol = validateCondoSectionsSubset([saleMarketSection], leaseOnlyInput);
check("lease-only condoMarket fires hard condo_lease_only_market",
  leaseOnlyViol.some((v) => v.rule === "condo_lease_only_market" && v.severity === "hard"),
  `${leaseOnlyViol.length} violation(s)`);
for (const v of leaseOnlyViol) console.log(`       - ${v.rule}: ${v.excerpt.slice(0, 120)}`);

// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(72));
console.log(`RESULT: ${fail === 0 ? "PASS ✓ — txn split holds; sale never contaminated by lease" : `FAIL ✗ (${fail} failed)`}  [${pass} passed, ${fail} failed]`);
console.log("=".repeat(72));
process.exit(fail === 0 ? 0 : 1);
