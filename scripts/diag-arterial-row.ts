// scripts/diag-arterial-row.ts
// Dump the StreetContent row for a major Milton arterial we'd expect to
// have rich data, to see what fields are populated vs null/empty.

import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let value = m[2].replace(/\\n$/, "");
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[m[1]] = value;
      }
    }
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";

async function main() {
  // Try a few likely arterial slugs
  const probes = [
    "main-street-east-milton", "main-street-milton", "main-st-east-milton",
    "derry-road-milton", "derry-rd-milton",
    "bronte-street-south-milton", "bronte-street-milton",
    "trafalgar-road-milton", "james-snow-parkway-milton",
    "ontario-street-south-milton", "thompson-road-milton",
  ];
  for (const slug of probes) {
    const row = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });
    if (row) {
      console.log(`\n=== ${slug} ===`);
      console.log(`streetName:      ${row.streetName}`);
      console.log(`neighbourhood:   ${row.neighbourhood}`);
      console.log(`status:          ${row.status}`);
      console.log(`isVipHub:        ${row.isVipHub}`);
      console.log(`description.length: ${row.description.length}`);
      console.log(`marketDataHash:  ${row.marketDataHash ? row.marketDataHash.slice(0,12)+"..." : "null"}`);
      const stats = row.statsJson ? JSON.parse(row.statsJson) : null;
      console.log(`statsJson keys:  ${stats ? Object.keys(stats).join(", ") : "null"}`);
      if (stats) {
        console.log(`  totalSold12mo:    ${stats.totalSold12mo}`);
        console.log(`  avgListPrice:     ${stats.avgListPrice}`);
        console.log(`  medianListPrice:  ${stats.medianListPrice}`);
        console.log(`  avgDOM:           ${stats.avgDOM}`);
        console.log(`  activeCount:      ${stats.activeCount}`);
      }
    }
  }
  // Also pick any street where statsJson has totalSold12mo > 0, if it exists
  const allWithStats = await prisma.streetContent.findMany({
    where: { statsJson: { not: null } },
    select: { streetSlug: true, statsJson: true },
  });
  let withSales = 0;
  let zeroSales = 0;
  let firstWithSales: { slug: string; sales: number } | null = null;
  for (const r of allWithStats) {
    try {
      const s = JSON.parse(r.statsJson!);
      if ((s.totalSold12mo ?? 0) > 0) {
        withSales++;
        if (!firstWithSales) firstWithSales = { slug: r.streetSlug, sales: s.totalSold12mo };
      } else {
        zeroSales++;
      }
    } catch {}
  }
  console.log(`\n=== StreetContent.statsJson distribution ===`);
  console.log(`Rows with statsJson present:  ${allWithStats.length}`);
  console.log(`  with totalSold12mo > 0:     ${withSales}`);
  console.log(`  with totalSold12mo === 0:   ${zeroSales}`);
  if (firstWithSales) console.log(`  example with sales:         ${firstWithSales.slug} (${firstWithSales.sales} sales)`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(2); });
