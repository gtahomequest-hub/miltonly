// Re-queue the QUEUE item 7 creation programme for the hourly cron.
//
// WHAT WAS WRONG. The 249 candidates in scratchpad/audit/066-creation-order.json were never the
// cron's to build. Of the 244 without a page: 167 were not in StreetQueue at all (nothing
// enqueues a registry street whose only history is DB2: the detect cron enqueues on DB1 listing
// events). 68 were "ineligible", struck between May and August by the three-source gate
// DEC-GATE-PARITY replaced on 2026-09-10, and the cron never re-read that status
// (DEC-QUEUE-REEVAL now does, after 30 days). 9 were
// "failed" at attempts=3 and so never retried: 5 on an Anthropic credit-balance 400, 4 on a
// NoCentroidError the Town-centreline step has since fixed. The 5 pages that exist were built
// by scripts/create-street-pages-local.ts, not by the cron.
//
// WHAT THIS DOES. Every candidate without a StreetContent row is upserted to `pending`,
// attempts 0, lastError null, with createdAt set in programme order so the cron's createdAt
// ordering drains them in the reviewed order. The entity floor applies: a slug on neither the
// Town registry nor the off-registry allowlist is refused, not queued. Dry run by default;
// --write applies. DEC-NEW-PAGE-CAP still governs the rate: 20 new pages a day.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/requeue-creation-programme.ts [--write]
import { readFileSync } from "node:fs";
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { OFF_REGISTRY_SET } from "@/data/offRegistryStreets";

function loadEnvLocal(): void {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].replace(/\r$/, "");
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}
loadEnvLocal();

const MILTON_STREET_REGISTRY_SLUGS = new Set(MILTON_STREET_REGISTRY.map((r) => r.slug));
const ORDER = process.env.REGEN_ORDER || "scratchpad/audit/066-creation-order.json";
const WRITE = process.argv.includes("--write");

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const order = JSON.parse(readFileSync(ORDER, "utf8")) as Array<{ n: number; slug: string; name: string }>;
  const slugs = order.map((o) => o.slug);

  const existing = new Set(
    (await prisma.streetContent.findMany({ where: { streetSlug: { in: slugs } }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );
  const queued = new Map(
    (await prisma.streetQueue.findMany({ where: { streetSlug: { in: slugs } }, select: { streetSlug: true, status: true, attempts: true } })).map((r) => [r.streetSlug, r]),
  );

  const base = Date.now();
  let toQueue = 0, hasPage = 0, offFloor = 0;
  const before: Record<string, number> = {};
  for (const o of order) {
    if (existing.has(o.slug)) { hasPage++; continue; }
    if (!MILTON_STREET_REGISTRY_SLUGS.has(o.slug) && !OFF_REGISTRY_SET.has(o.slug)) { offFloor++; console.log(`REFUSED (entity floor): ${o.slug}`); continue; }
    const prior = queued.get(o.slug)?.status ?? "absent";
    before[prior] = (before[prior] ?? 0) + 1;
    toQueue++;
    if (!WRITE) continue;
    // createdAt in programme order, one second apart, so the cron drains in the reviewed order.
    const createdAt = new Date(base + o.n * 1000);
    await prisma.streetQueue.upsert({
      where: { streetSlug: o.slug },
      create: { streetSlug: o.slug, streetName: o.name, status: "pending", attempts: 0, createdAt },
      update: { streetName: o.name, status: "pending", attempts: 0, lastError: null, processedAt: null, createdAt },
    });
  }
  console.log(`[requeue] ${order.length} candidates: ${hasPage} already have a page, ${offFloor} refused at the entity floor, ${toQueue} ${WRITE ? "queued as pending" : "would be queued (dry run, pass --write)"}`);
  console.log(`[requeue] prior queue state of those ${toQueue}:`, before);
  if (WRITE) {
    const now = await prisma.streetQueue.count({ where: { status: "pending" } });
    console.log(`[requeue] pending rows now: ${now}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
