// Revalidate EVERY page that publishes a figure, after a data backfill.
//
// THE ORDER MATTERS AND IT IS NOT THE OBVIOUS ONE. A figure on a page has up to three caches in
// front of it, and revalidatePath clears only the outermost:
//
//   1. Upstash (`cached()` in src/lib/cache.ts, 1h TTL) — a Next.js path revalidation does not
//      touch it. Purge it FIRST, or every page below re-renders the stale number it already had.
//      That is exactly what happened on 2026-09-10: a cache MISS on / that still printed
//      sold-mtd 23 against a live source of 51.
//   2. the prerendered page — this script.
//   3. a module-level memo with no TTL (buildMiltonWideContext in src/lib/ai/buildHubInput.ts).
//      NOTHING here can clear it. Only a new deployment can. If a figure is still wrong after
//      this script runs, check that memo before concluding the data is wrong.
//
// Stored prose is a fourth consumer and is NOT a cache: a street page's figures were written at
// generation time and only a regeneration changes them. This script cannot and must not.
//
// Usage:
//   npx tsx --require ./scripts/_server-only-shim.cjs scripts/revalidate-figure-pages.ts
//   BATCH=25 npx tsx ... scripts/revalidate-figure-pages.ts
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

const BASE = process.env.BASE || "https://miltonly.com";
const BATCH = Number(process.env.BATCH || "20");

(async () => {
  // REVALIDATION_SECRET. Not CRON_SECRET, not REVALIDATE_SECRET. A wrong name 401s and a 401
  // does not fail anything loudly, so the whole sweep would report success having done nothing.
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) { console.error("REVALIDATION_SECRET unset. Refusing to run a sweep that would 401 silently."); process.exit(1); }

  const { prisma } = await import("@/lib/prisma");
  const { GUIDE_SLUGS } = await import("@/lib/guides/guides");

  const [hubs, streets, editions] = await Promise.all([
    prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } }),
    prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } }),
    prisma.marketEdition.findMany({ where: { status: "published" }, select: { weekOf: true }, orderBy: { weekOf: "desc" } }),
  ]);

  const groups: Array<[string, string[]]> = [
    ["core", ["/", "/sold", "/rentals", "/streets", "/neighbourhoods", "/listings", "/market-watch"]],
    ["guides", ["/guides", ...GUIDE_SLUGS.map((s: string) => `/guides/${s}`)]],
    ["editions", editions.map((e) => `/market-watch/${e.weekOf}`)],
    ["hubs", hubs.map((h) => `/neighbourhoods/${h.neighbourhoodSlug}`)],
    ["streets", streets.map((s) => `/streets/${s.streetSlug}`)],
  ];

  const total = groups.reduce((n, [, p]) => n + p.length, 0);
  console.log(`${BASE} — ${total} paths in ${groups.length} groups, batches of ${BATCH}`);
  for (const [name, paths] of groups) console.log(`  ${name.padEnd(9)} ${paths.length}`);
  console.log("");

  let ok = 0;
  const bad: Array<{ path: string; status: number | null }> = [];

  for (const [name, paths] of groups) {
    let gOk = 0;
    for (let i = 0; i < paths.length; i += BATCH) {
      const batch = paths.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (path) => {
        const status = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path }),
        }).then((r) => r.status).catch(() => null);
        return { path, status };
      }));
      for (const r of results) {
        if (r.status === 200) { ok++; gOk++; } else bad.push(r);
      }
      process.stdout.write(`\r  ${name}: ${gOk}/${paths.length}`);
    }
    console.log(`\r  ${name.padEnd(9)} ${gOk}/${paths.length} ok`);
  }

  console.log("");
  console.log(`200: ${ok} of ${total}; other: ${bad.length}`);
  for (const b of bad.slice(0, 20)) console.log(`  ${b.status} ${b.path}`);
  await prisma.$disconnect();
  process.exit(bad.length ? 1 : 0);
})();
