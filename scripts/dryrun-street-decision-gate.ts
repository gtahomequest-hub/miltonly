// QUEUE item 7 dry run. NO WRITES: makeStreetDecision marks rows "ineligible" as a side
// effect, so this never calls it. It re-implements the gate's clauses as pure counts over
// the same population the cron drains, once with the old three DB1 clauses and once with
// the DB2 existence clause added, and reports the difference.
//
// It also checks the newly admitted set against the entity floor, because a wider gate that
// admits a street absent from both the registry and the off-registry allowlist would breach
// "publish floor = entity floor".
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

(async () => {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const { MILTON_STREET_REGISTRY } = await import("@/data/miltonStreetRegistry");
  const { OFF_REGISTRY_SET } = await import("@/data/offRegistryStreets");
  const { resolveSiblingSlugs } = await import("@/lib/street-data");
  const sd = getSoldDb()!;

  // The population the cron actually looks at: every StreetQueue row it would drain, plus
  // the ineligible ones the old gate struck off (those are exactly what should come back).
  const queue = await prisma.streetQueue.findMany({
    select: { streetSlug: true, streetName: true, status: true },
  });
  console.log(`StreetQueue rows: ${queue.length}`);
  const byStatus: Record<string, number> = {};
  for (const q of queue) byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
  console.log(`  by status: ${JSON.stringify(byStatus)}`);

  // DB1 clauses, in bulk rather than three counts per street.
  const grouped = await prisma.listing.groupBy({
    by: ["streetSlug", "status"],
    _count: { _all: true },
  });
  const db1 = new Map<string, { total: number; sold: number; active: number }>();
  for (const g of grouped) {
    const e = db1.get(g.streetSlug) ?? { total: 0, sold: 0, active: 0 };
    e.total += g._count._all;
    if (g.status === "sold") e.sold += g._count._all;
    if (g.status === "active") e.active += g._count._all;
    db1.set(g.streetSlug, e);
  }

  const failsDb1 = (slug: string) => {
    const e = db1.get(slug) ?? { total: 0, sold: 0, active: 0 };
    return e.total === 0 || (e.sold < 1 && e.active < 1);
  };

  const oldSkipped = queue.filter((q) => failsDb1(q.streetSlug));
  console.log(`\nOLD gate (DB1 only) — skip_low_data: ${oldSkipped.length}`);

  // The DB2 existence clause, exactly as countRecordedTransactions runs it: sibling-slug
  // union, perm_advertise, COUNT(*) only, no window.
  const registry = new Set(MILTON_STREET_REGISTRY.map((r: { slug: string }) => r.slug));
  const rescued: { slug: string; name: string; n: number; onFloor: boolean }[] = [];
  const offFloorWithRows: { slug: string; n: number }[] = [];
  let done = 0;
  for (const q of oldSkipped) {
    const siblings = await resolveSiblingSlugs(q.streetSlug);
    const rows = (await sd`
      SELECT COUNT(*)::int AS n FROM sold.sold_records
       WHERE street_slug = ANY(${siblings}::text[]) AND perm_advertise = TRUE
    `) as Array<{ n: number }>;
    const n = Number(rows[0]?.n) || 0;
    // The gate probes DB2 only for a slug on the entity floor, so an off-floor slug with DB2
    // rows is refused rather than rescued. Counted separately.
    const onFloor = registry.has(q.streetSlug) || OFF_REGISTRY_SET.has(q.streetSlug);
    if (n > 0 && !onFloor) offFloorWithRows.push({ slug: q.streetSlug, n });
    if (n > 0 && onFloor) rescued.push({ slug: q.streetSlug, name: q.streetName, n, onFloor });
    if (++done % 100 === 0) console.log(`  ...probed ${done}/${oldSkipped.length}`);
  }

  const newSkipped = oldSkipped.length - rescued.length;
  console.log(`\nNEW gate (DB1 + DB2 existence) — skip_low_data: ${newSkipped}`);
  console.log(`Rescued (refresh on the cron instead of being struck ineligible): ${rescued.length}`);

  console.log(`
ENTITY FLOOR: refused despite carrying DB2 rows (on neither the registry
    nor the off-registry allowlist, so the gate never probes DB2 for them): ${offFloorWithRows.length}`);
  if (offFloorWithRows.length) {
    console.log(`  ${offFloorWithRows.map((r) => `${r.slug}(${r.n})`).join(", ")}`);
  }

  const published = await prisma.streetContent.count({ where: { status: "published" } });
  const rescuedWithPage = await prisma.streetContent.count({
    where: { streetSlug: { in: rescued.map((r) => r.slug) }, status: "published" },
  });
  console.log(`\nOf the rescued, already published: ${rescuedWithPage}; new build candidates: ${rescued.length - rescuedWithPage}`);
  console.log(`Published StreetContent overall: ${published}`);
  console.log(`\nTop rescued by DB2 rows: ${rescued.sort((a, b) => b.n - a.n).slice(0, 10).map((r) => `${r.slug}(${r.n})`).join(", ")}`);
  process.exit(0);
})();
