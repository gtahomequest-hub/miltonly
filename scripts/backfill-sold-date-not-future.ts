// Backfill for DEC-SOLD-DATE-NOT-FUTURE (2026-09-10).
//
// The sync no longer writes a future sold_date, but 245 rows written before the fix still
// carry one: CloseDate, the agreed COMPLETION date, standing in for the date the sale
// happened. This repairs them in place using resolveSoldDate — the SAME function the sync
// calls, so a backfilled row is byte-identical to what the next sync would write.
//
// DRY RUN BY DEFAULT. Pass --write to touch anything.
//
// What it does NOT do:
//   - it never invents a date. A row resolveSoldDate cannot date is reported and left alone,
//     not deleted. Deleting a real transaction to satisfy a date rule is the wrong trade.
//   - it never touches close_date, which keeps CloseDate so the completion date survives.
//   - it never touches a row whose sold_date is already today or earlier.
//
// Usage:
//   npx tsx --require ./scripts/_server-only-shim.cjs scripts/backfill-sold-date-not-future.ts
//   npx tsx --require ./scripts/_server-only-shim.cjs scripts/backfill-sold-date-not-future.ts --write
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

const WRITE = process.argv.includes("--write");

type Row = {
  mls_number: string;
  street_slug: string;
  transaction_type: string;
  sold_date: Date;
  close_date: Date | null;
  contract_date: Date | null;
  sold_price: string;
};

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);
const day = (d: Date | string | null): string => (d ? new Date(d).toISOString().slice(0, 10) : "null");

(async () => {
  const { getSoldDb } = await import("@/lib/db");
  const { resolveSoldDate } = await import("@/lib/vow-sync");
  const sd = getSoldDb();
  if (!sd) { console.error("SOLD_DATABASE_URL is not configured"); process.exit(1); }

  console.log(`DEC-SOLD-DATE-NOT-FUTURE backfill — ${WRITE ? "WRITE" : "DRY RUN"}`);
  console.log("");

  // ── k-anonymity sample sizes BEFORE, so crossings can be reported against measured state
  // rather than predicted. 12-month For Sale, per street, exactly as street-data.ts counts it.
  const kBefore = new Map<string, number>();
  for (const r of (await sd`
    SELECT street_slug, COUNT(*)::int AS n
      FROM sold.sold_records
     WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
       AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
     GROUP BY street_slug
  `) as Array<{ street_slug: string; n: number }>) kBefore.set(r.street_slug, r.n);

  const rows = (await sd`
    SELECT mls_number, street_slug, transaction_type, sold_date, close_date, contract_date, sold_price
      FROM sold.sold_records
     WHERE sold_date > CURRENT_DATE
     ORDER BY sold_date DESC
  `) as Row[];

  console.log(`rows carrying a future sold_date: ${rows.length}`);
  if (rows.length === 0) {
    console.log("");
    console.log("Nothing to repair. Re-run reports 0.");
    process.exit(0);
  }

  const byTxn: Record<string, number> = {};
  for (const r of rows) byTxn[r.transaction_type] = (byTxn[r.transaction_type] ?? 0) + 1;
  console.log(`  by transaction_type: ${JSON.stringify(byTxn)}`);

  const repairable: Array<{ row: Row; to: string }> = [];
  const undatable: Row[] = [];
  for (const r of rows) {
    const resolved = resolveSoldDate(iso(r.close_date) ?? iso(r.sold_date), iso(r.contract_date));
    if (resolved === null) { undatable.push(r); continue; }
    repairable.push({ row: r, to: resolved });
  }

  console.log(`  repairable (resolveSoldDate returns a date): ${repairable.length}`);
  console.log(`  undatable (left alone, never deleted):       ${undatable.length}`);
  if (undatable.length) {
    for (const r of undatable.slice(0, 10)) {
      console.log(`    ${r.mls_number} ${r.street_slug} sold_date=${day(r.sold_date)} contract=${day(r.contract_date)}`);
    }
  }

  console.log("");
  console.log("10 samples (mls · street · txn · sold_date BEFORE -> AFTER · close_date kept · price):");
  for (const { row, to } of repairable.slice(0, 10)) {
    console.log(
      `  ${row.mls_number}  ${row.street_slug.padEnd(34)} ${row.transaction_type.padEnd(9)}` +
      ` ${day(row.sold_date)} -> ${day(to)}   close=${day(row.close_date)}  $${Number(row.sold_price).toLocaleString()}`
    );
  }

  if (!WRITE) {
    console.log("");
    console.log(`DRY RUN. Nothing written. ${repairable.length} rows would be repaired.`);
    console.log("Re-run with --write to apply.");
    process.exit(0);
  }

  console.log("");
  console.log(`Writing ${repairable.length} rows...`);
  let written = 0, failed = 0;
  for (const { row, to } of repairable) {
    try {
      // sold_date only. close_date, sold_price and every other column are untouched.
      await sd`UPDATE sold.sold_records SET sold_date = ${to}::timestamptz WHERE mls_number = ${row.mls_number}`;
      written++;
      if (written % 50 === 0) console.log(`  ...${written}/${repairable.length}`);
    } catch (e) {
      failed++;
      console.error(`  FAILED ${row.mls_number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`written ${written}, failed ${failed}`);

  // ── Idempotency: re-run the selection. Must be 0 (minus any undatable rows, which stay).
  const after = (await sd`
    SELECT COUNT(*)::int AS n FROM sold.sold_records WHERE sold_date > CURRENT_DATE
  `) as Array<{ n: number }>;
  console.log("");
  console.log(`RE-RUN: rows still carrying a future sold_date: ${after[0].n}` +
    (undatable.length ? ` (expected ${undatable.length}, the undatable set)` : " (expected 0)"));

  // ── k crossings, measured.
  const kAfter = new Map<string, number>();
  for (const r of (await sd`
    SELECT street_slug, COUNT(*)::int AS n
      FROM sold.sold_records
     WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
       AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
     GROUP BY street_slug
  `) as Array<{ street_slug: string; n: number }>) kAfter.set(r.street_slug, r.n);

  const slugs = new Set([...kBefore.keys(), ...kAfter.keys()]);
  const k5: Array<[string, number, number]> = [];
  const k10: Array<[string, number, number]> = [];
  let changed = 0;
  for (const slug of slugs) {
    const b = kBefore.get(slug) ?? 0, a = kAfter.get(slug) ?? 0;
    if (a !== b) changed++;
    if (b < 5 && a >= 5) k5.push([slug, b, a]);
    if (b < 10 && a >= 10) k10.push([slug, b, a]);
  }
  console.log("");
  console.log(`streets whose 12-month For Sale sample changed: ${changed}`);
  console.log(`CROSSED k5 (a typical point becomes publishable): ${k5.length}`);
  for (const [s, b, a] of k5.sort((x, y) => x[0].localeCompare(y[0]))) console.log(`  ${s.padEnd(38)} ${b} -> ${a}`);
  console.log(`CROSSED k10 (a range becomes publishable): ${k10.length}`);
  for (const [s, b, a] of k10.sort((x, y) => x[0].localeCompare(y[0]))) console.log(`  ${s.padEnd(38)} ${b} -> ${a}`);
  process.exit(0);
})();
