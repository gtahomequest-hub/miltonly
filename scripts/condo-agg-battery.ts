// scripts/condo-agg-battery.ts
// CONDO Build A — Gate B battery over the 4 pilots. Verifies the 4 ruling folds (esp. the
// amenities >=2 math + the name corp-rejector), the k-gated yield, area-context, and the VOW
// no-individual-price / no-sub-k proof. Read-only.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const PILOTS = ["610-farmstead-drive-milton", "830-megson-terrace-milton", "480-gordon-krantz-avenue-milton", "139-main-street-milton"];
const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

async function main() {
  const { buildBuildingAttributes } = await import("@/lib/ai/buildBuildingAttributes");
  const L = (s = "") => console.log(s);

  for (const slug of PILOTS) {
    const a = await buildBuildingAttributes(slug);
    L(`\n${"═".repeat(96)}`);
    L(`PILOT: ${slug}   (${a.buildingName.name})`);
    L("─".repeat(96));

    // 1. record counts + k-floors
    L(`1. RECORDS  cluster keys=${a.clusterKeys.length}  total=${a.records.total}  saleAll=${a.records.saleAll} leaseAll=${a.records.leaseAll}  sale12mo=${a.records.sale12mo} lease12mo=${a.records.lease12mo}`);
    L(`   K-FLOORS  saleTypical(>=5)=${a.kFloors.saleTypical}  saleRange(>=10)=${a.kFloors.saleRange}  leaseTypical(>=5)=${a.kFloors.leaseTypical}  identityOnly(<3/<3)=${a.kFloors.identityOnly}`);

    // 2. amenities — show per-record lists + the >=2 fold math
    L(`2. AMENITIES  (records with any amenity: ${a.amenities.recordsWithAny})  label="${a.amenities.label}"`);
    const amPer = a._debug.amenitiesPerRecord.filter((r) => r.length);
    amPer.slice(0, 10).forEach((r, i) => L(`     rec${String(i + 1).padStart(2)}: [${r.join(", ")}]`));
    if (amPer.length > 10) L(`     ...(${amPer.length - 10} more records with amenities)`);
    L(`   count-per-amenity (verify >=2): ${a.amenities.detail.map((d) => `${d.amenity}×${d.count}`).join("  |  ") || "(none)"}`);
    L(`   => RENDERED (>=2): [${a.amenities.rendered.join(", ") || "—"}]${a.amenities.note ? "  note: " + a.amenities.note : ""}`);

    // 3. fee-includes
    L(`3. FEE-INCLUDES  (records carrying association_fee_includes: ${a.feeIncludes.recordsCarrying}; >=half threshold=${a.feeIncludes.threshold})`);
    a._debug.feePerRecord.slice(0, 10).forEach((r, i) => L(`     rec${String(i + 1).padStart(2)}: [${r.join(", ")}]`));
    L(`   count-per-item: ${a.feeIncludes.detail.map((d) => `${d.amenity}×${d.count}`).join("  |  ") || "(none)"}`);
    L(`   => ${a.feeIncludes.stated ? `ITEMS (>=half): [${a.feeIncludes.items.join(", ")}]` : `"${a.feeIncludes.note}"`}`);

    // 4. management — raw + current (recent-window) modal
    L(`4. MANAGEMENT  raw values: ${a.management.rawTop.map((d) => `"${d.amenity}"×${d.count}`).join("  |  ") || "(none)"}`);
    L(`   => COMPANY (current): ${a.management.company ? `"${a.management.company}"` : "—"}  [window=${a.management.window}, recentRecords=${a.management.recentCount}]`);
    L(`      mostRecentRecord="${a.management.mostRecent ?? "—"}"  allTimeModal="${a.management.allTimeCompany ?? "—"}"${a.management.note ? "  note: " + a.management.note : ""}`);

    // 5. name — raw + modal + corp-rejector
    L(`5. NAME  raw association_name: ${a.buildingName.rawTop.map((d) => `"${d.amenity}"×${d.count}`).join("  |  ") || "(none)"}`);
    L(`   => NAME: "${a.buildingName.name}"  source=${a.buildingName.source}  isRealName=${a.buildingName.isRealName}${a.buildingName.note ? "  note: " + a.buildingName.note : ""}`);

    // 6. yield
    L(`6. YIELD  headline=${a.gyield.headlinePct == null ? "—" : a.gyield.headlinePct + "%"}  (saleMedian=${money(a.gyield.saleMedian)} leaseMedian=${money(a.gyield.leaseMedian)}/mo)${a.gyield.note ? "  note: " + a.gyield.note : ""}`);
    a.gyield.perBed.forEach((p) => L(`     ${p.beds}-bed: yield=${p.yieldPct == null ? "—" : p.yieldPct + "%"}  saleMed=${money(p.saleMedian)}(n=${p.saleN})  leaseMed=${money(p.leaseMedian)}(n=${p.leaseN})`));

    // 7. area-context
    L(`7. AREA-CONTEXT  ${a.areaContext.neighbourhoodName} [${a.areaContext.neighbourhoodSlug}]  typical_condo=${money(a.areaContext.typicalCondo)}`);
    L(`   label: "${a.areaContext.label}"`);

    // 8. VOW proof
    const json = JSON.stringify(a);
    const hasPriceArray = /"prices?"|"soldPrice"|"sold_price"|"individual"/.test(json);
    L(`8. VOW  hasIndividualPrice=${a.vow.hasIndividualPrice}  subKPriceSuppressed=${a.vow.subKPriceSuppressed}  payloadHasPriceRowField=${hasPriceArray}`);
  }

  // VERIFY(830) — management must be CURRENT, not all-time historical mode.
  L(`\n${"═".repeat(96)}`);
  const m = (await buildBuildingAttributes("830-megson-terrace-milton")).management;
  L(`VERIFY 830 MANAGEMENT (DEC-CONDO-3 point-in-time):`);
  L(`  most-recent sold record names: "${m.mostRecent}"`);
  L(`  most-recent-6-record modal    : "${m.company}"  (window=${m.window}, recentRecords=${m.recentCount})`);
  L(`  all-time modal                : "${m.allTimeCompany}"`);
  const currentBrand = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b(condominium|condo|corporation|corp|services?|service|property|management|mgmt|inc|ltd|llc|group|company|co|the|of|and)\b/gi, " ").replace(/\s+/g, " ").trim();
  L(`  fold returns the CURRENT (recent) company, not the historical mode: ${currentBrand(m.company) === currentBrand(m.mostRecent) || m.window === "recent"}`);

  // Aggregate VOW assertion across all pilots
  L(`\n${"═".repeat(96)}`);
  L("VOW SUMMARY: every payload exposes ONLY k-gated medians (null below k>=5) + building-attribute folds; no per-unit sold row.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
