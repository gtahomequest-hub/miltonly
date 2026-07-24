// scripts/registry-cleanup-db3.ts
// Finishes Step-4-proper: after entity deletes + sold reassignment, DB3 analytics
// still holds stale per-slug stats for deleted sources, so getStreetPageData renders
// them 200 (should 404). Delete orphaned analytics rows (+ orphaned DRAFT StreetContent)
// for slugs that have NEITHER a ResidentialStreet entity NOR any DB2 sold_records.
// Published StreetContent with no entity = the 22 deferred redirect sources → KEPT.
// Dry-run by default; --commit writes.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const COMMIT = process.argv.includes("--commit");
async function main() {
  const { PrismaClient } = await import("@prisma/client"); const { neon } = await import("@neondatabase/serverless");
  const p = new PrismaClient(); const an = neon(process.env.ANALYTICS_DATABASE_URL!); const sold = neon(process.env.SOLD_DATABASE_URL!);
  const entitySet = new Set((await p.residentialStreet.findMany({ select: { slug: true } })).map((r) => r.slug));
  const soldSet = new Set((await sold`SELECT DISTINCT street_slug FROM sold.sold_records WHERE street_slug IS NOT NULL` as any[]).map((r: any) => r.street_slug));
  // Guard: never touch a slug that backs a PUBLISHED page (would thin a live page).
  const pubSet = new Set((await p.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug));
  // "alive" = has an entity, OR DB2 sold, OR a published page. Only fully-dead slugs
  // (stale DB3 stats from the pre-normalization era + this pass's deleted sources) drop.
  const alive = (slug: string) => entitySet.has(slug) || soldSet.has(slug) || pubSet.has(slug);

  const statSlugs = (await an`SELECT street_slug FROM analytics.street_sold_stats` as any[]).map((r: any) => r.street_slug);
  const orphanStats = statSlugs.filter((s: string) => !alive(s));
  let monthlySlugs: string[] = []; try { monthlySlugs = (await an`SELECT DISTINCT street_slug FROM analytics.street_monthly_stats` as any[]).map((r: any) => r.street_slug); } catch { monthlySlugs = []; }
  const orphanMonthly = monthlySlugs.filter((s: string) => !alive(s));
  const draftOrphan = (await p.streetContent.findMany({ where: { status: { not: "published" } }, select: { streetSlug: true } })).filter((c) => !entitySet.has(c.streetSlug)).map((c) => c.streetSlug);

  console.log(`=== db3 orphan cleanup ${COMMIT ? "(COMMIT)" : "(DRY)"} ===`);
  console.log(`  entities=${entitySet.size} soldSlugs=${soldSet.size}`);
  console.log(`  orphaned street_sold_stats rows: ${orphanStats.length}`);
  console.log(`  orphaned street_monthly_stats slugs: ${orphanMonthly.length}`);
  console.log(`  orphaned DRAFT StreetContent rows: ${draftOrphan.length}`);
  console.log(`  sample orphan-stat slugs: ${orphanStats.slice(0, 12).join(", ")}`);
  if (COMMIT) {
    if (orphanStats.length) await an`DELETE FROM analytics.street_sold_stats WHERE street_slug = ANY(${orphanStats})`;
    if (orphanMonthly.length) { try { await an`DELETE FROM analytics.street_monthly_stats WHERE street_slug = ANY(${orphanMonthly})`; } catch (e) { console.log("(monthly delete skipped: " + (e as any).message + ")"); } }
    if (draftOrphan.length) await p.streetContent.deleteMany({ where: { streetSlug: { in: draftOrphan } } });
    console.log(`\n[commit] deleted: ${orphanStats.length} stat rows, ${orphanMonthly.length} monthly-slug rows, ${draftOrphan.length} draft content rows`);
  } else console.log("\n(dry run)");
  await p.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
