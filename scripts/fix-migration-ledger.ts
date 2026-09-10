// Clear the one stale row in _prisma_migrations.
//
// 20260910180000_street_content_created_at was created 2026-09-10 to add StreetContent.createdAt,
// failed immediately with 42701 because that column already existed, and was marked rolled back.
// Its directory was then deleted. What remains is a ledger row for a migration that applied ZERO
// steps and no longer exists on disk, which prisma migrate status reports as drift:
// "The migration from the database are not found locally".
//
// Deleting it is safe in the strictest sense: applied_steps_count is 0 and rolled_back_at is set,
// so the row describes nothing that was ever done to the schema. Guarded anyway — this refuses to
// delete a row that applied any step or that is not marked rolled back.
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try { const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v; } } } catch {}
}
loadEnvLocal();

const NAME = "20260910180000_street_content_created_at";
const WRITE = process.argv.includes("--write");

(async () => {
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const rows = (await p.$queryRawUnsafe(
    `SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
       FROM _prisma_migrations WHERE migration_name = $1`, NAME)) as Array<{
    migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; applied_steps_count: number;
  }>;

  if (rows.length === 0) { console.log(`No row for ${NAME}. Nothing to do.`); await p.$disconnect(); return; }
  const r = rows[0];
  console.log(`row: applied_steps_count=${r.applied_steps_count} finished_at=${r.finished_at} rolled_back_at=${r.rolled_back_at}`);

  if (Number(r.applied_steps_count) !== 0) {
    console.error("REFUSING: applied_steps_count is not 0, so this migration changed the schema.");
    process.exit(1);
  }
  if (!r.rolled_back_at) {
    console.error("REFUSING: not marked rolled back.");
    process.exit(1);
  }
  if (!WRITE) { console.log("DRY RUN. Pass --write to delete."); await p.$disconnect(); return; }

  const n = await p.$executeRawUnsafe(
    `DELETE FROM _prisma_migrations WHERE migration_name = $1 AND applied_steps_count = 0 AND rolled_back_at IS NOT NULL`, NAME);
  console.log(`deleted ${n} row(s)`);
  await p.$disconnect();
})();
