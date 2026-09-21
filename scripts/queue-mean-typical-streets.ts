// scripts/queue-mean-typical-streets.ts
//
// MC-027 item 3, the post-merge step. DEC-TYPICAL-MEDIAN moved every street typical from the mean
// to the K-gated median; a page whose stored prose states its old mean now states a figure its
// tiles do not. This lists those pages (the prose contains the mean in any of its printed forms and
// the median differs from it at $5,000) and, with --write, queues them for regeneration on the
// hourly cron. RUN IT AFTER THE MERGE: the cron generates with the code on production, and until
// the merge that code grounds prose on the mean, which would put the old figure straight back.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/queue-mean-typical-streets.ts            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/queue-mean-typical-streets.ts --write

import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { neon } from "@neondatabase/serverless";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; }
const WRITE = process.argv.includes("--write");
async function main() {
  const db1 = neon(process.env.DATABASE_URL!.trim()); const db2 = neon(process.env.SOLD_DATABASE_URL!.trim());
  const rows = (await db1`SELECT "streetSlug", "streetName", description, "faqJson" FROM public."StreetContent" WHERE status='published'`) as Array<{ streetSlug: string; streetName: string; description: string; faqJson: string | null }>;
  const agg = (await db2`SELECT street_slug s, COUNT(*)::int n, AVG(sold_price) avg, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW() GROUP BY 1`) as Array<{ s: string; n: number; avg: string; med: string }>;
  const full = (await db2`SELECT street_slug s, COUNT(*)::int n, AVG(sold_price) avg, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date <= NOW() AND sold_price IS NOT NULL GROUP BY 1`) as Array<{ s: string; n: number; avg: string; med: string }>;
  const by12 = new Map(agg.map((a) => [a.s, a])), byFull = new Map(full.map((a) => [a.s, a]));
  const fmt = (v: number) => [`$${Math.round(v).toLocaleString("en-CA")}`, `$${Math.round(v / 1000)}K`, `$${(v / 1e6).toFixed(2)}M`, `$${(v / 1e6).toFixed(1)}M`, `$${(Math.round(v / 5000) * 5000).toLocaleString("en-CA")}`, `$${Math.round(v / 5000) * 5}K`, `$${(Math.round(v / 1000)).toLocaleString("en-CA")},000`];
  const toQueue: string[] = [];
  for (const r of rows) {
    const a = by12.get(r.streetSlug); const f = byFull.get(r.streetSlug);
    const basis = a && a.n >= 5 ? a : f && f.n >= 5 ? f : null;
    if (!basis) continue;
    const mean = Number(basis.avg), med = Number(basis.med);
    if (Math.round(mean / 5000) === Math.round(med / 5000)) continue;
    const text = `${r.description} ${r.faqJson ?? ""}`;
    if (fmt(mean).some((s) => text.includes(s))) toQueue.push(r.streetSlug);
  }
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · pages whose prose states the mean typical (and the median differs at $5k): ${toQueue.length}`);
  console.log(toQueue.join(", "));
  if (WRITE) {
    let n = 0;
    for (const slug of toQueue) {
      const name = rows.find((r) => r.streetSlug === slug)!.streetName;
      await db1`INSERT INTO public."StreetQueue" ("id", "streetSlug", "streetName", "status", "attempts", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, ${slug}, ${name}, 'pending', 0, NOW(), NOW()) ON CONFLICT ("streetSlug") DO UPDATE SET status = 'pending', attempts = 0, "lastError" = NULL, "updatedAt" = NOW()`;
      n++;
    }
    console.log(`queued ${n}`);
  }
}
main();
