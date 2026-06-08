// Condo dedup APPLY — DESTRUCTIVE, single transaction, count-asserted, rollback-on-mismatch.
// Deletes the 23 dupe CondoContent rows + 46 junk CondoBuilding rows whose slug is
// not the canonical cluster slug (computed by the SAME groupCondoClusters the wired
// backfill uses). Asserts exact pre/post counts; ANY mismatch => ROLLBACK, no partial.
//
// Guard: requires --prod --apply and the prod DB1 host. Without --apply it does a
// transactional rehearsal (BEGIN ... ROLLBACK) and reports what WOULD change.
//
// Usage (rehearsal): npx tsx scripts/condo-dedup-apply.ts --prod
//        (execute):   npx tsx scripts/condo-dedup-apply.ts --prod --apply

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { groupCondoClusters } from "../src/lib/condoIdentity";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv(name: string, into: Record<string, string>) {
  try {
    for (const line of readFileSync(resolve(__dirname, "..", name), "utf8").split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("="); if (eq === -1) continue;
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      into[k] = v;
    }
  } catch { /* ignore */ }
}
const local: Record<string, string> = {}; loadEnv(".env.local", local);
const prod: Record<string, string> = {}; loadEnv(".env", prod);
const SOLD_URL = (local.SOLD_DATABASE_URL || "").trim();
const DB1_URL = (prod.DIRECT_DATABASE_URL || prod.DATABASE_URL || local.DATABASE_URL || "").trim();
const db1Host = (DB1_URL.match(/@([^/?]+)/) || [])[1] || "";

// ── EXPECTED COUNTS (signed-off corrected mapping, 2026-06-07) ──
const EXPECT = { delContent: 23, delBuilding: 46, postContent: 58, postBuilding: 62, preContent: 81, preBuilding: 108 };

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  if (!process.argv.includes("--prod")) { console.error("❌ GUARD: requires --prod."); process.exit(1); }
  if (!db1Host.startsWith("ep-patient-paper-aebh7f93")) {
    console.error(`❌ GUARD: DB1 host ${db1Host} is not the expected prod host. Refusing.`); process.exit(1);
  }

  // ── compute canonical set from DB2 (identical to the wired backfill / dryrun) ──
  const sold = new pg.Client({ connectionString: SOLD_URL });
  await sold.connect();
  let canonSet: Set<string>;
  try {
    const condoRows = (await sold.query(`
      SELECT street_number, street_slug, neighbourhood,
             MAX(street_name) name, COUNT(*)::int cnt,
             COUNT(*) FILTER (WHERE transaction_type='For Sale' AND sold_date>=NOW()-INTERVAL '12 months')::int sale12,
             COUNT(*) FILTER (WHERE transaction_type='For Lease' AND sold_date>=NOW()-INTERVAL '12 months')::int lease12,
             ARRAY_AGG(DISTINCT condo_corp_number) FILTER (WHERE condo_corp_number IS NOT NULL) corps
      FROM sold.sold_records
      WHERE property_type='condo' AND street_number IS NOT NULL AND street_slug IS NOT NULL
      GROUP BY street_number, street_slug, neighbourhood`)).rows;
    const { clusters } = groupCondoClusters(condoRows);
    canonSet = new Set([...clusters.values()].map((c: any) => c.canonicalSlug));
  } finally { await sold.end(); }
  console.log(`canonical slugs: ${canonSet.size}`);

  const db1 = new pg.Client({ connectionString: DB1_URL });
  await db1.connect();
  console.log(`DB1: ${db1Host}  mode: ${APPLY ? "APPLY (will COMMIT on clean assert)" : "REHEARSAL (always ROLLBACK)"}`);

  const slugList = [...canonSet];
  let committed = false;
  try {
    await db1.query("BEGIN");

    const preC = Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoContent"`)).rows[0].n);
    const preB = Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoBuilding"`)).rows[0].n);

    const delC = await db1.query(`DELETE FROM "CondoContent"  WHERE "buildingSlug" <> ALL($1::text[])`, [slugList]);
    const delB = await db1.query(`DELETE FROM "CondoBuilding" WHERE slug           <> ALL($1::text[])`, [slugList]);

    const postC = Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoContent"`)).rows[0].n);
    const postB = Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoBuilding"`)).rows[0].n);

    const checks = [
      ["pre CondoContent",   preC,  EXPECT.preContent],
      ["pre CondoBuilding",  preB,  EXPECT.preBuilding],
      ["deleted CondoContent",  delC.rowCount, EXPECT.delContent],
      ["deleted CondoBuilding", delB.rowCount, EXPECT.delBuilding],
      ["post CondoContent",  postC, EXPECT.postContent],
      ["post CondoBuilding", postB, EXPECT.postBuilding],
    ] as Array<[string, number | null, number]>;

    console.log("\n=== ASSERTIONS ===");
    let ok = true;
    for (const [label, got, exp] of checks) {
      const pass = got === exp;
      if (!pass) ok = false;
      console.log(`  ${pass ? "✓" : "✗"} ${label}: got ${got}, expected ${exp}`);
    }

    if (ok && APPLY) {
      await db1.query("COMMIT");
      committed = true;
      console.log("\n✅ COMMITTED — all 6 assertions passed.");
    } else {
      await db1.query("ROLLBACK");
      console.log(ok
        ? "\n↩️  ROLLBACK — rehearsal only (pass --apply to commit). DB unchanged."
        : "\n❌ ROLLBACK — assertion mismatch. DB unchanged. No partial delete.");
      if (!ok) process.exitCode = 1;
    }
  } catch (e) {
    try { await db1.query("ROLLBACK"); } catch { /* ignore */ }
    console.error("❌ ERROR — ROLLBACK issued. DB unchanged.\n", e instanceof Error ? e.stack : e);
    process.exitCode = 2;
  } finally {
    await db1.end();
  }
  if (APPLY && !committed && process.exitCode == null) process.exitCode = 1;
}
main().catch((e) => { console.error("fatal:", e instanceof Error ? e.stack : e); process.exit(2); });
