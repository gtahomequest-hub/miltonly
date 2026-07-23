// scripts/board-run.ts — run the Board compute once: populate analytics.board_stats
// and print the evidence table. Usage: tsx scripts/board-run.ts
// (Prisma auto-loads .env for DATABASE_URL; we load .env.local for SOLD_/ANALYTICS_.)
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __d = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__d, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

import { computeAndWriteBoard } from "@/lib/board/computeBoard";

const money = (n: number | null) => (n === null ? "—" : "$" + Math.round(n).toLocaleString("en-CA"));
const pct = (n: number | null) => (n === null ? "—" : (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%");

async function main() {
  const tabs = await computeAndWriteBoard();
  console.log("\n=== analytics.board_stats — populated rows ===\n");
  for (const t of tabs) {
    console.log(`── ${t.label} (data through ${t.dataThrough}) ─────────────────────────`);
    console.log(`  TYPICAL PRICE : ${money(t.typical.value)}  (Δmo ${pct(t.typical.deltaMonth)} · Δyr ${pct(t.typical.deltaYear)})`);
    console.log(`                  window ${t.typical.window} · ${t.typical.sample} sales · mix adjusted`);
    console.log(`  SALES VOLUME  : ${t.salesVolume.value}  (${t.salesVolume.window}; Δmo ${pct(t.salesVolume.deltaMonth)} · Δyr ${pct(t.salesVolume.deltaYear)})`);
    console.log(`  DAYS TO SELL  : ${t.daysToSell.value === null ? "—" : Math.round(t.daysToSell.value)}  (${t.daysToSell.window}, n=${t.daysToSell.sample})`);
    console.log(`  SOLD TO ASK   : ${t.soldToAsk.value === null ? "—" : (t.soldToAsk.value * 100).toFixed(1) + "%"}  (${t.soldToAsk.window})`);
    console.log(`  MONTHS SUPPLY : ${t.monthsSupply.value === null ? "—" : t.monthsSupply.value.toFixed(1)}`);
    console.log(`  PRICE BAND    : ${t.priceBand ? `${money(t.priceBand.p5)} … [${money(t.priceBand.p25)}–${money(t.priceBand.p75)}] … ${money(t.priceBand.p95)}` : "suppressed"}`);
    if (t.suppressed.length) console.log(`  SUPPRESSED    : ${t.suppressed.map((c) => `${c.type}/${c.slug}(${c.count})`).join(", ")}`);
    console.log(`  WIDENED TO    : ${t.widenedTo}${t.suppressed.length ? `  · ${t.suppressed.length} cell(s) suppressed` : ""}`);
    console.log("");
  }

  // sanity
  const by = Object.fromEntries(tabs.map((t) => [t.tab, t]));
  const oV = by.overall.salesVolume.value!;
  const detT = by.detached.typical.value, ovT = by.overall.typical.value, coT = by.condo.typical.value;
  console.log("=== SANITY ===");
  console.log(`  Overall 12mo volume = ${oV}  vs hero 1,573 (all-Milton, 12mo). urban-only+lot-guard -> expect a bit lower. ${oV >= 1300 && oV <= 1573 ? "OK" : "CHECK"}`);
  console.log(`  Detached ${money(detT)} > Overall ${money(ovT)} > Condo ${money(coT)} : ${detT! > ovT! && ovT! > coT! ? "OK ✓" : "CHECK ✗"}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
