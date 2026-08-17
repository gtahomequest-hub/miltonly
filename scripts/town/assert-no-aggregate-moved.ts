// scripts/town/assert-no-aggregate-moved.ts
// CONSTRAINT 2, asserted rather than argued: geometry decides which hub a page links to and takes
// context from, and NO published hub figure may change value because of it.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/town/assert-no-aggregate-moved.ts --save before.json
//   ...run the assignment...
//   npx tsx --tsconfig tsconfig.test.json scripts/town/assert-no-aggregate-moved.ts --compare before.json
//
// Snapshots every figure the hub tier publishes, straight off the real builders (buildHubInput /
// buildRuralHubInput), for all 22 published hubs: typical price, sale count, price range, DOM,
// lease count, active listings, and the whole by-type and quarterly breakdown. Then re-reads them
// and demands byte equality.
//
// It ALSO records the street-side numbers that geometry legitimately could move — projected
// street count, VIP count, published-ladder count — separately, so a change there is visible and
// labelled rather than hidden inside a pass. Those are links, not figures; the assertion is on
// the figures.
import { readFileSync, writeFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const SAVE = process.argv.includes("--save") ? process.argv[process.argv.indexOf("--save") + 1] : null;
const COMPARE = process.argv.includes("--compare") ? process.argv[process.argv.indexOf("--compare") + 1] : null;
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { buildHubInput, buildRuralHubInput, resetMiltonWideContextCache, buildMiltonWideContext } = await import("@/lib/ai/buildHubInput");
  const L = (s = "") => console.log(s);

  const published = (await prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } })).map((h) => h.neighbourhoodSlug);
  const nbhds = await prisma.neighbourhood.findMany({ where: { slug: { in: published } } });
  if (!nbhds.length) throw new Error("no published hubs read — check the credential, not the data");

  resetMiltonWideContextCache();
  const milton = await buildMiltonWideContext(true);

  const snap: Record<string, unknown> = {};
  const links: Record<string, unknown> = {};
  for (const n of nbhds.sort((a, b) => a.slug.localeCompare(b.slug))) {
    const input = n.profile === "urban_hub" ? await buildHubInput(n.slug) : await buildRuralHubInput(n.slug);
    // THE FIGURES — every published number, nothing about streets.
    snap[n.slug] = {
      typicalPrice: input.aggregates.typicalPrice,
      salesCount: input.aggregates.salesCount,
      leasesCount: input.aggregates.leasesCount,
      txCount: input.aggregates.txCount,
      priceRange: input.aggregates.priceRange,
      daysOnMarket: input.aggregates.daysOnMarket,
      kAnonLevel: input.aggregates.kAnonLevel,
      byType: input.byType,
      quarterlyTrend: input.quarterlyTrend,
      activeListingsCount: input.activeListingsCount,
      activeByType: input.activeByType,
    };
    // THE LINKS — what geometry is allowed to touch. Recorded, not asserted.
    links[n.slug] = {
      projectedStreets: input.projectedStreets.length,
      vipStreetCount: input.vipStreetCount,
      streetCount: input.streetCount,
    };
  }
  snap.__milton = {
    typicalPrice: milton.aggregates.typicalPrice,
    salesCount: milton.aggregates.salesCount,
    priceRange: milton.aggregates.priceRange,
    daysOnMarket: milton.aggregates.daysOnMarket,
    quarterlyTrend: milton.quarterlyTrend,
    activeListingsCount: milton.activeListingsCount,
    neighbourhoodCount: milton.neighbourhoodCount,
  };

  if (SAVE) {
    writeFileSync(SAVE, JSON.stringify({ figures: snap, links }, null, 0));
    L(`saved ${nbhds.length} published hubs + Milton-wide -> ${SAVE}`);
    L(`  hubs: ${nbhds.map((n) => n.slug).join(", ")}`);
    await prisma.$disconnect();
    return;
  }

  if (!COMPARE) { console.error("usage: --save <file> | --compare <file>"); process.exit(2); }
  const before = JSON.parse(readFileSync(COMPARE, "utf8")) as { figures: Record<string, unknown>; links: Record<string, unknown> };

  L("═".repeat(100));
  L("CONSTRAINT 2 — NO HUB AGGREGATE MOVED");
  L("═".repeat(100));
  L(`    hubs in the BEFORE snapshot ...... ${Object.keys(before.figures).length - 1}`);
  L(`    hubs read NOW .................... ${nbhds.length}`);
  L();
  L(`    ${pad("hub", 26)} ${lp("typical", 12)} ${lp("sales", 7)} ${lp("range", 6)} ${lp("dom", 5)} ${lp("byType", 7)} ${lp("qtrs", 6)} ${pad("verdict", 10)}`);
  L(`    ${"-".repeat(26)} ${"-".repeat(12)} ${"-".repeat(7)} ${"-".repeat(6)} ${"-".repeat(5)} ${"-".repeat(7)} ${"-".repeat(6)} ${"-".repeat(10)}`);

  let moved = 0, missing = 0;
  const details: string[] = [];
  for (const slug of Object.keys(before.figures)) {
    const a = before.figures[slug] as Record<string, unknown> | undefined;
    const b = snap[slug] as Record<string, unknown> | undefined;
    if (!b) { missing++; details.push(`${slug}: present BEFORE, absent NOW`); continue; }
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) {
      moved++;
      for (const k of Object.keys(a ?? {})) {
        const av = JSON.stringify((a as Record<string, unknown>)[k]), bv = JSON.stringify(b[k]);
        if (av !== bv) details.push(`${slug}.${k}: ${av} -> ${bv}`);
      }
    }
    if (slug === "__milton") {
      L(`    ${pad("(Milton-wide)", 26)} ${lp(String((b as { typicalPrice: unknown }).typicalPrice), 12)} ${lp(String((b as { salesCount: unknown }).salesCount), 7)} ${lp("-", 6)} ${lp("-", 5)} ${lp("-", 7)} ${lp("-", 6)} ${pad(same ? "same" : "MOVED", 10)}`);
      continue;
    }
    const bb = b as { typicalPrice: number | null; salesCount: number; priceRange: unknown; daysOnMarket: unknown; byType: Record<string, unknown>; quarterlyTrend: unknown[] };
    L(`    ${pad(slug, 26)} ${lp(bb.typicalPrice ?? "null", 12)} ${lp(bb.salesCount, 7)} ${lp(bb.priceRange ? "yes" : "null", 6)} ${lp(String(bb.daysOnMarket ?? "null"), 5)} ${lp(Object.keys(bb.byType).length, 7)} ${lp(bb.quarterlyTrend.length, 6)} ${pad(same ? "same" : "MOVED", 10)}`);
  }
  const extra = Object.keys(snap).filter((k) => !(k in before.figures));

  L();
  L(`    ASSERT hubs whose published figures moved : ${moved}  (expected 0)`);
  L(`    ASSERT hubs missing from NOW             : ${missing}  (expected 0)`);
  L(`    ASSERT hubs appearing that were not there: ${extra.length}  (expected 0)${extra.length ? ` [${extra.join(", ")}]` : ""}`);
  for (const d of details.slice(0, 30)) L(`        ${d}`);

  // The link side, reported not asserted.
  L();
  L(`    STREET-SIDE COUNTS (links, not figures — geometry MAY move these):`);
  L(`    ${pad("hub", 26)} ${lp("projected", 11)} ${lp("vip", 5)} ${lp("streetCount", 12)}`);
  let linkMoved = 0;
  for (const slug of Object.keys(before.links)) {
    const a = before.links[slug] as Record<string, number>;
    const b = links[slug] as Record<string, number> | undefined;
    if (!b) continue;
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) linkMoved++;
    const arrow = (k: string) => (a[k] === b[k] ? `${b[k]}` : `${a[k]}->${b[k]}`);
    if (!same) L(`    ${pad(slug, 26)} ${lp(arrow("projectedStreets"), 11)} ${lp(arrow("vipStreetCount"), 5)} ${lp(arrow("streetCount"), 12)}   CHANGED`);
  }
  L(`    hubs whose street-side counts changed: ${linkMoved}${linkMoved ? "" : " (none)"}`);

  const ok = moved === 0 && missing === 0 && extra.length === 0;
  L();
  L(`═══ ${ok ? "PASS" : "FAIL"} — constraint 2 ═══`);
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
