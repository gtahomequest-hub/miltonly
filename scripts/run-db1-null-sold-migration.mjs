// Phase 2.6 follow-up — one-off migration runner.
// Nullifies Listing.soldPrice and Listing.soldDate in DB1 per VOW compliance.
// Reads the SQL from migrations/db1/2026-04-17-null-sold-fields.sql so the
// executed statement matches the committed audit record exactly.
//
// Usage (from project root):
//   node scripts/run-db1-null-sold-migration.mjs

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = resolve(__dirname, "..", "migrations", "db1", "2026-04-17-null-sold-fields.sql");

async function main() {
  const prisma = new PrismaClient();
  try {
    const sql = readFileSync(SQL_PATH, "utf8");
    console.log(`[migration] file: ${SQL_PATH}`);
    console.log("[migration] sql:\n" + sql);

    // Pre-count — how many rows currently carry legacy sold data.
    const preCount = await prisma.listing.count({
      where: { OR: [{ soldPrice: { not: null } }, { soldDate: { not: null } }] },
    });
    console.log(`[migration] rows with legacy sold fields BEFORE: ${preCount}`);

    // Execute the committed SQL verbatim.
    const rowsAffected = await prisma.$executeRawUnsafe(sql);
    console.log(`[migration] rows affected by UPDATE: ${rowsAffected}`);

    // Post-count — must be zero.
    const postCount = await prisma.listing.count({
      where: { OR: [{ soldPrice: { not: null } }, { soldDate: { not: null } }] },
    });
    console.log(`[migration] rows with legacy sold fields AFTER: ${postCount}`);

    if (postCount !== 0) {
      throw new Error(`Post-migration count is ${postCount}, expected 0`);
    }
    console.log("[migration] ✓ verified: zero rows remain with legacy sold data");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[migration] FAILED:", e);
  process.exit(1);
});
