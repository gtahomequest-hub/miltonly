// scripts/delete-ads-lead.ts
// Deletes ads.leads rows BY EXPLICIT ID, one id per argument. No pattern, no source
// filter, no date range: a test row and a real lead differ only by intent, and a tool
// that can select rows by shape is a tool that can delete a real lead by accident.
//
// Mirrors what scripts/verify-leads-pipeline.ts:121 already does for its own row.
// DRY RUN BY DEFAULT. --write is required.
//
// Usage: npx tsx scripts/delete-ads-lead.ts <uuid> [<uuid> ...] --write
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = process.argv.slice(2).filter((a) => UUID_RE.test(a));

async function main() {
  if (ids.length === 0) throw new Error("no valid uuid arguments given");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const id of ids) {
      const row = await prisma.adsLead.findUnique({
        where: { id },
        select: { id: true, createdAt: true, source: true, email: true },
      });
      if (!row) {
        console.log(`MISS\t${id}\t(no such row)`);
        continue;
      }
      const label = `${row.source}\t${row.email ?? "(no email)"}\t${row.createdAt.toISOString()}`;
      if (!WRITE) {
        console.log(`WOULD DELETE\t${row.id}\t${label}`);
        continue;
      }
      await prisma.adsLead.delete({ where: { id: row.id } });
      console.log(`DELETED\t${row.id}\t${label}`);
    }
    const remaining = await prisma.adsLead.count();
    console.log(`REMAINING ${remaining}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("delete-ads-lead failed:", err);
  process.exit(1);
});
