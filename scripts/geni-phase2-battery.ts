// scripts/geni-phase2-battery.ts
// GENI Phase 2 Gate B — the can't-hallucinate proof for the deterministic matcher.
// Feeds constructed GeniParseResult objects (deterministic; no LLM) into matchNeighbourhoods
// and verifies count-parity vs an INDEPENDENT SQL count, the rural guard, determinism, etc.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

type Crit = Record<string, unknown>;
const proceed = (criteria: Crit, declined: unknown[] = [], neutralized: unknown[] = []) =>
  ({ outcome: (declined.length ? "proceed_with_note" : "proceed"), criteria, declined, neutralized } as any);

async function main() {
  const { matchNeighbourhoods } = await import("@/lib/geni/matchNeighbourhoods");
  const { NEIGHBOURHOOD_SEED } = await import("@/lib/neighbourhood");
  const { prisma } = await import("@/lib/prisma");
  const rawFor = (slug: string) => NEIGHBOURHOOD_SEED.find((s) => s.slug === slug)?.rawStrings ?? [];
  const money = (v: number | null) => (v === null ? "·" : `$${v.toLocaleString()}`);
  const card = (m: any) => `${m.slug.padEnd(16)} live=${String(m.liveCount).padStart(3)} typical=${money(m.typical).padEnd(11)} go=${m.distGoKm ?? "·"} met=${m.metCount}/${m.applicableCount} tags=[${m.tags.map((t: any) => `${t.key}:${t.met ? "Y" : "n"}`).join(",")}]${m.aboveTypicalBudget ? " [entry-level]" : ""}${m.typicalLowConfidence ? " [ruralLowConf]" : ""}`;

  async function run(label: string, pr: any, showTop = 8) {
    const r = await matchNeighbourhoods(pr);
    console.log(`\n═══ ${label} ═══`);
    console.log(`  thresholds: nearGoKm=${r.thresholds.nearGoKm} townMedianDOM=${r.thresholds.townMedianDom} townMedianVol=${r.thresholds.townMedianVol} | ${r.matches.length} candidates`);
    r.matches.slice(0, showTop).forEach((m: any, i: number) => console.log(`  ${String(i + 1).padStart(2)}. ${card(m)}`));
    if (r.notes.length) r.notes.forEach((nn: string) => console.log(`  NOTE: ${nn}`));
    return r;
  }

  // A — count parity
  const A = await run("A. detached under $1.1M near the GO", proceed({ maxPrice: 1100000, propertyType: "detached", nearGO: true }));
  console.log("  -- COUNT PARITY: matcher liveCount vs INDEPENDENT SQL count (neighbourhood, detached, <=1.1M, active, For Sale) --");
  for (const m of A.matches.slice(0, 3)) {
    const indep = await prisma.listing.count({ where: { neighbourhood: { in: rawFor(m.slug) }, propertyType: "detached", price: { lte: 1100000 }, status: "active", permAdvertise: true, transactionType: "For Sale" } });
    console.log(`     ${m.slug.padEnd(16)} matcher=${m.liveCount}  independentSQL=${indep}  MATCH=${m.liveCount === indep}`);
  }

  // B — typical == table exactly
  const B = await run("B. 3 bed townhouse under $900k", proceed({ maxPrice: 900000, propertyType: "townhouse", bedrooms: 3 }));
  console.log("  -- TYPICAL PARITY: card typical vs table typical_town --");
  const { neon } = await import("@neondatabase/serverless"); const an = neon(process.env.ANALYTICS_DATABASE_URL!);
  for (const m of B.matches.slice(0, 3)) {
    const t = (await an`SELECT typical_town FROM analytics.neighbourhood_match_stats WHERE neighbourhood_slug=${m.slug}` as any[])[0]?.typical_town;
    console.log(`     ${m.slug.padEnd(16)} card=${m.typical}  table.typical_town=${t}  MATCH=${Number(m.typical) === Number(t)}`);
  }

  // C — deep-links
  const C = await run("C. condo 2 bed under $700k", proceed({ maxPrice: 700000, propertyType: "condo", bedrooms: 2 }));
  console.log("  -- DEEP-LINKS (first 2) --");
  C.matches.slice(0, 2).forEach((m: any) => console.log(`     ${m.slug}: ${m.listingsUrl}`));

  // D — rural guard
  const D = await run("D. RURAL GUARD: detached under $900k", proceed({ maxPrice: 900000, propertyType: "detached" }), 24);
  const rtRank = D.matches.findIndex((m: any) => m.slug === "rural-trafalgar");
  console.log(`  -- rural-trafalgar (table typical_detached ~$4.26M): rank=${rtRank < 0 ? "ABSENT (0 matching inventory)" : rtRank + 1}  => NOT a top match: ${rtRank < 0 || rtRank >= 3}`);

  // E — empty state (genuinely-impossible criteria: 8-bed detached under $50k)
  const E = await run("E. EMPTY STATE: 8-bed detached under $50k (no such inventory)", proceed({ maxPrice: 50000, propertyType: "detached", bedrooms: 8 }));
  console.log(`  -- empty result (no fabricated match): ${E.matches.length === 0}`);

  // F — refuses declined
  const F = await matchNeighbourhoods({ outcome: "declined", criteria: {}, declined: [{ field: "_safety", reason: "x" }], neutralized: [] } as any);
  console.log(`\n═══ F. REFUSES DECLINED ═══\n  matches=${F.matches.length} (expect 0)  notes=${JSON.stringify(F.notes)}`);

  // G — determinism
  const g1 = JSON.stringify((await matchNeighbourhoods(proceed({ maxPrice: 1100000, propertyType: "detached", nearGO: true }))).matches);
  const g2 = JSON.stringify((await matchNeighbourhoods(proceed({ maxPrice: 1100000, propertyType: "detached", nearGO: true }))).matches);
  console.log(`\n═══ G. DETERMINISM (criterion A twice) ═══\n  byte-identical: ${g1 === g2}`);

  // H — size/lot acknowledged-not-honored
  const H = await run("H. SIZE/LOT: detached under $1M at least 2000 sqft", proceed({ maxPrice: 1000000, propertyType: "detached", minSqft: 2000 }, [{ field: "minSqft", reason: "size not available" }]));
  const hNote = H.notes.some((s: string) => /size.*isn't available/i.test(s));
  const hSameUrl = H.matches[0]?.listingsUrl && !/sqft/i.test(H.matches[0].listingsUrl);
  console.log(`  -- size acknowledged-not-honored note present: ${hNote} · link omits sqft (consistent): ${hSameUrl}`);

  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
