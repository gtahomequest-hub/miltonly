// Builds the creation order for the 250-page programme QUEUE item 7 opened.
//
// The population: slugs the widened gate admits (DB2 rows exist, entity floor passes) that have
// NO StreetContent row of any status. Ordered by DB2 row count descending, so the pages with the
// most evidence behind them are written first and reviewed first. A street with 20 recorded
// transactions is a better read, and a better test of the generator, than one with 1.
//
// Writes scratchpad/audit/066-creation-order.json as [{ n, slug, name, db2 }].
//
//   npx tsx --require ./scripts/_server-only-shim.cjs scripts/build-creation-order.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  const { resolveStreetName } = await import("@/lib/streetName");
  const reg = new Set(MILTON_STREET_REGISTRY.map((r: { slug: string }) => r.slug));
  const onFloor = (s: string) => reg.has(s) || OFF_REGISTRY_SET.has(s);
  const sd = getSoldDb()!;

  const db2 = (await sd`
    SELECT street_slug, COUNT(*)::int AS n
      FROM sold.sold_records WHERE perm_advertise = TRUE
     GROUP BY street_slug
  `) as Array<{ street_slug: string; n: number }>;

  const grouped = await prisma.listing.groupBy({ by: ["streetSlug", "status"], _count: { _all: true } });
  const db1 = new Map<string, { total: number; sold: number; active: number }>();
  for (const g of grouped) {
    const e = db1.get(g.streetSlug) ?? { total: 0, sold: 0, active: 0 };
    e.total += g._count._all;
    if (g.status === "sold") e.sold += g._count._all;
    if (g.status === "active") e.active += g._count._all;
    db1.set(g.streetSlug, e);
  }
  const failsDb1 = (s: string) => {
    const e = db1.get(s) ?? { total: 0, sold: 0, active: 0 };
    return e.total === 0 || (e.sold < 1 && e.active < 1);
  };

  const existing = new Set(
    (await prisma.streetContent.findMany({ select: { streetSlug: true } })).map((r) => r.streetSlug)
  );

  const candidates = db2
    .filter((r) => failsDb1(r.street_slug))
    .filter((r) => onFloor(r.street_slug))
    .filter((r) => !existing.has(r.street_slug))
    .sort((a, b) => b.n - a.n || a.street_slug.localeCompare(b.street_slug))
    .map((r, i) => ({ n: i + 1, slug: r.street_slug, name: resolveStreetName(r.street_slug).name, db2: r.n }));

  mkdirSync("scratchpad/audit", { recursive: true });
  writeFileSync("scratchpad/audit/066-creation-order.json", JSON.stringify(candidates, null, 1));
  console.log(`creation candidates: ${candidates.length}`);
  console.log(`  DB2 rows: max ${candidates[0]?.db2}, min ${candidates[candidates.length - 1]?.db2}`);
  const buckets: Record<string, number> = {};
  for (const c of candidates) {
    const k = c.db2 >= 10 ? "10+" : c.db2 >= 5 ? "5-9" : c.db2 >= 2 ? "2-4" : "1";
    buckets[k] = (buckets[k] ?? 0) + 1;
  }
  console.log(`  by DB2 rows: ${JSON.stringify(buckets)}`);
  console.log(`  first 50 span DB2 ${candidates[0]?.db2} down to ${candidates[49]?.db2}`);
  console.log("");
  console.log("first 10:");
  for (const c of candidates.slice(0, 10)) console.log(`  ${String(c.n).padStart(3)} ${c.slug.padEnd(38)} ${c.name.padEnd(28)} db2=${c.db2}`);
  process.exit(0);
})();
