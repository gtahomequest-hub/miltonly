// Condo dedup DRY-RUN — READ-ONLY. Runs the exact grouping the wired
// ws3-backfill now uses (groupCondoClusters from src/lib/condoIdentity) over
// live DB2, joins DB1 content/entity state, and diffs the result against the
// SIGNED-OFF mapping (2026-06-07). No writes anywhere.
//
// Usage: npx tsx scripts/condo-dedup-dryrun.ts

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
// Same write-target the backfill uses — but opened READ-ONLY here (SELECTs only).
// ws5 worktree has no .env; .env.local DATABASE_URL points at the same prod host.
const DB1_URL = (prod.DIRECT_DATABASE_URL || prod.DATABASE_URL || local.DATABASE_URL || "").trim();
const db1Host = (DB1_URL.match(/@([^/?]+)/) || [])[1] || "";
if (!db1Host.startsWith("ep-patient-paper-aebh7f93")) {
  console.error(`❌ DB1 host ${db1Host} is not the expected prod host. Refusing.`);
  process.exit(1);
}

// ── SIGNED-OFF MAPPING (2026-06-07) — canonical -> expected member raw slugs ──
const APPROVED: Record<string, string[]> = {
  "1050-main-street-milton": ["1050-e-main-street-milton", "1050-main-street-milton"],
  "1105-leger-way-milton": ["1105-ledger-way-milton", "1105-leger-way-milton", "1105-leger-way-way-milton"],
  "1380-main-street-milton": ["1380-main-e-street-milton", "1380-main-street-milton"],
  "1460-main-street-milton": ["1460-e-main-street-milton", "1460-main-street-milton"],
  "460-gordon-krantz-avenue-milton": ["460-gordon-krantz-avenue-milton", "460-gordon-kranz-avenue-milton"],
  "470-gordon-krantz-avenue-milton": ["470-gordon-krantz-ave-avenue-milton", "470-gordon-krantz-avenue-milton", "470-sw-gordon-krantz-ave-sw-206-milton"],
  "480-gordon-krantz-avenue-milton": ["480-gordon-krantz-avenue-milton", "480-gordon-krantz-boulevard-milton"],
  "490-gordon-krantz-avenue-milton": ["418-490-gordon-krantz-avenue-milton", "490-gordon-krantz-avenue-milton", "490-gordon-krantz-milton"],
  "610-farmstead-drive-milton": ["610-farmstead-drive-milton", "610-farmstead-road-milton"],
  "6415-regional-road-25-milton": ["6415-reginal-road-milton", "6415-regional-rd-25-road-304-milton", "6415-regional-rd-25-road-306-milton", "6415-regional-rd-25-road-milton", "6415-regional-road-milton"],
  "716-main-street-milton": ["716-main-st-east-street-903-milton", "716-main-street-milton"],
  "720-whitlock-avenue-milton": ["720-whitlock-ave-d204-milton", "720-whitlock-ave-d707-milton", "720-whitlock-ave-d810-milton", "720-whitlock-avenue-milton"],
  "750-whitlock-avenue-milton": ["750-whitelock-avenue-milton", "750-whitlock-ave-sw-712-milton", "750-whitlock-avenue-milton"],
  "760-whitlock-avenue-milton": ["760-whitlock-ave-b412-milton", "760-whitlock-ave-b508-milton", "760-whitlock-ave-b801-milton", "760-whitlock-ave-b807-milton", "760-whitlock-ave-b808-milton", "760-whitlock-ave-nw-502-milton", "760-whitlock-avenue-milton"],
  "770-whitlock-avenue-milton": ["309-770-whitlock-avenue-milton", "770-whitlock-ave-a107-milton", "770-whitlock-ave-a112-milton", "770-whitlock-ave-a113-milton", "770-whitlock-ave-a313-milton", "770-whitlock-ave-a504-milton", "770-whitlock-ave-a509-milton", "770-whitlock-ave-a514-milton", "770-whitlock-ave-a711-milton", "770-whitlock-ave-a715-milton", "770-whitlock-avenue-milton"],
  "8010-derry-road-milton": ["8010-derry-rd-road-milton", "8010-derry-road-milton", "8010-s-derry-road-milton", "8010-w-derry-road-milton"],
  "8020-derry-road-milton": ["8020-derry-rd-drive-milton", "8020-derry-rd-na-w-608-milton", "8020-derry-rd-road-milton", "8020-derry-road-milton"],
  "21-court-street-milton": ["21-crt-street-milton"], // rename, no merge target
};

const K_THRESHOLDS = [5, 10] as const;

async function main(): Promise<void> {
  const sold = new pg.Client({ connectionString: SOLD_URL });
  const db1 = new pg.Client({ connectionString: DB1_URL });
  await Promise.all([sold.connect(), db1.connect()]);
  console.log(`DRY-RUN (read-only). DB2: ${(SOLD_URL.match(/@([^/?]+)/) || [])[1]}  DB1: ${(DB1_URL.match(/@([^/?]+)/) || [])[1]}`);

  try {
    // identical SELECT to the wired backfill's condo section
    const condoRows = (await sold.query(`
      SELECT street_number, street_slug, neighbourhood,
             MAX(street_name) name,
             COUNT(*)::int cnt,
             COUNT(*) FILTER (WHERE transaction_type='For Sale' AND sold_date>=NOW()-INTERVAL '12 months')::int sale12,
             COUNT(*) FILTER (WHERE transaction_type='For Lease' AND sold_date>=NOW()-INTERVAL '12 months')::int lease12,
             ARRAY_AGG(DISTINCT condo_corp_number) FILTER (WHERE condo_corp_number IS NOT NULL) corps
      FROM sold.sold_records
      WHERE property_type='condo' AND street_number IS NOT NULL AND street_slug IS NOT NULL
      GROUP BY street_number, street_slug, neighbourhood`)).rows as Array<{
        street_number: string; street_slug: string; neighbourhood: string; name: string;
        cnt: number; sale12: number; lease12: number; corps: string[] | null;
      }>;

    const rawEntities = new Set(condoRows.map((r) => `${r.street_number}-${r.street_slug}`));
    const { clusters, rejected } = groupCondoClusters(condoRows);
    console.log(`\nDB2 rows: ${condoRows.length}  raw entities: ${rawEntities.size}  canonical clusters: ${clusters.size}  rejected: ${rejected.length}`);
    for (const r of rejected) console.log(`  REJECTED: ${r.street_number} | ${r.street_slug}`);

    const content = (await db1.query(`SELECT "buildingSlug" slug, status FROM "CondoContent"`)).rows as Array<{ slug: string; status: string }>;
    const contentMap = new Map(content.map((c) => [c.slug, c.status]));
    const buildings = (await db1.query(`SELECT slug FROM "CondoBuilding"`)).rows as Array<{ slug: string }>;
    const db1Slugs = new Set(buildings.map((b) => b.slug));
    console.log(`DB1: CondoBuilding=${buildings.length}  CondoContent=${content.length} (published=${content.filter((c) => c.status === "published").length})`);

    // ── mapping + k-crossings ──
    let drift = 0;
    let publishedDupes = 0;
    const regenSet: string[] = [];
    const crossings: string[] = [];
    const seenApproved = new Set<string>();

    console.log("\n=== COMPUTED MAPPING (multi-member clusters + renames) ===");
    for (const c of [...clusters.values()].sort((a, b) => a.canonicalSlug.localeCompare(b.canonicalSlug))) {
      const members = [...c.memberSlugs.keys()].sort();
      const isRename = members.length === 1 && members[0] !== c.canonicalSlug;
      if (members.length === 1 && !isRename) continue; // clean single — skip print

      // per-member 12-mo aggregation
      const agg = (slugFilter: (raw: string) => boolean) => {
        let s = 0, l = 0;
        for (const r of c.rows) {
          const raw = `${r.street_number}-${r.street_slug}`;
          if (slugFilter(raw)) { s += Number(r.sale12); l += Number(r.lease12); }
        }
        return { s, l };
      };
      const merged = agg(() => true);
      const own = agg((raw) => raw === c.canonicalSlug);

      console.log(`\n${c.canonicalSlug}${db1Slugs.has(c.canonicalSlug) ? "" : "  [NEW ENTITY]"}  merged s12=${merged.s} l12=${merged.l} (own s12=${own.s} l12=${own.l})`);
      for (const m of members) {
        const status = contentMap.get(m) ?? "none";
        const mark = m === c.canonicalSlug ? "KEEP " : (isRename ? "RENAME" : "MERGE");
        if (m !== c.canonicalSlug && status === "published") publishedDupes++;
        console.log(`  ${mark}  ${m}  [content=${status}]`);
      }

      // approved-mapping diff
      const expected = APPROVED[c.canonicalSlug];
      if (!expected) {
        drift++;
        console.log(`  ⚠️ DRIFT: cluster not in the signed-off mapping`);
      } else {
        seenApproved.add(c.canonicalSlug);
        const exp = new Set(expected);
        const got = new Set(members);
        const missing = expected.filter((m) => !got.has(m));
        const extra = members.filter((m) => !exp.has(m));
        if (missing.length || extra.length) {
          drift++;
          if (missing.length) console.log(`  ⚠️ DRIFT — approved members missing: ${missing.join(", ")}`);
          if (extra.length) console.log(`  ⚠️ DRIFT — unapproved members appeared: ${extra.join(", ")}`);
        } else {
          console.log(`  ✓ matches signed-off mapping`);
        }
      }

      // k-crossings (K_ANON_PRICE=5, K_ANON_RANGE=10)
      for (const T of K_THRESHOLDS) {
        if (own.s < T && merged.s >= T) crossings.push(`${c.canonicalSlug}: SALE k${T} ${own.s}->${merged.s}`);
        if (own.l < T && merged.l >= T) crossings.push(`${c.canonicalSlug}: LEASE k${T} ${own.l}->${merged.l}`);
      }
      // regen set: published canonical whose counts change, or new canonical absorbing published members
      const dupeTradeCnt = [...c.memberSlugs.entries()].filter(([m]) => m !== c.canonicalSlug).reduce((s, [, n]) => s + n, 0);
      const canonicalPublished = contentMap.get(c.canonicalSlug) === "published";
      const anyMemberPublished = members.some((m) => contentMap.get(m) === "published");
      if ((canonicalPublished && dupeTradeCnt > 0) || (!db1Slugs.has(c.canonicalSlug) && anyMemberPublished)) regenSet.push(c.canonicalSlug);
    }

    const unseenApproved = Object.keys(APPROVED).filter((k) => !seenApproved.has(k));
    if (unseenApproved.length) {
      drift += unseenApproved.length;
      console.log(`\n⚠️ DRIFT — approved clusters NOT produced by the wired code: ${unseenApproved.join(", ")}`);
    }

    console.log(`\n=== K-THRESHOLD CROSSINGS ===`);
    console.log(crossings.length ? crossings.join("\n") : "(none)");

    console.log(`\n=== TALLY ===`);
    console.log(`canonical clusters: ${clusters.size}`);
    console.log(`published dupe content rows to delete: ${publishedDupes}`);
    const canonSet = new Set([...clusters.values()].map((c) => c.canonicalSlug));
    const junkDb1 = [...db1Slugs].filter((s) => !canonSet.has(s));
    console.log(`junk CondoBuilding rows to delete (DB1 slug not canonical): ${junkDb1.length}`);
    console.log(`new canonical entities to be created by backfill: ${[...canonSet].filter((s) => !db1Slugs.has(s)).length}`);
    console.log(`regen set (${regenSet.length}): ${regenSet.sort().join(", ")}`);
    console.log(`\nDRIFT vs signed-off mapping: ${drift === 0 ? "NONE — mapping matches exactly" : `${drift} ISSUE(S) — STOP, do not proceed to deletion`}`);
    process.exitCode = drift === 0 ? 0 : 1;
  } finally {
    await Promise.all([sold.end(), db1.end()]);
  }
}
main().catch((e) => { console.error("fatal:", e instanceof Error ? e.stack : e); process.exit(2); });
