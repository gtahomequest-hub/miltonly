// Purge the unverified User rows the sign-in bot left behind (MP-002).
//
// MP-001 found the User table held 162 rows, every one unverified, none with a session or a
// saved listing, all dotted-Gmail aliases posted by the same bot that walks /signin and the
// listing-detail form. Nothing reads an unverified row: getSession() returns null for it and
// no watch points at it. The rows are deleted so the table starts at zero real accounts.
//
// Dry run by default. `--apply` deletes. The rule is deliberately narrower than "unverified":
// a row is purged only if it has never verified, never logged in, and owns no SavedSearch.
// A real person mid-signup loses nothing but a code they can resend.
//
//   pnpm tsx scripts/purge-bot-users.ts            # dry run, counts only
//   pnpm tsx scripts/purge-bot-users.ts --apply    # deletes

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const f = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

async function main() {
  loadEnvLocal();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const apply = process.argv.includes("--apply");

  // MP-006, Appendix B(b): a row with a password is a credential record and is never
  // hard-deleted here, whatever else is true of it (credentialRetainUntil in
  // src/lib/portal/passwordRule.ts). An unverified bot row never has one.
  const where = {
    verified: false,
    lastLoginAt: null,
    vowAcknowledgedAt: null,
    passwordHash: null,
    savedSearches: { none: {} },
  } as const;

  const total = await prisma.user.count();
  const candidates = await prisma.user.findMany({ where, select: { id: true, email: true, createdAt: true } });
  const kept = total - candidates.length;

  console.log(`[purge-bot-users] ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`  User rows: ${total}`);
  console.log(`  purge candidates (unverified, never logged in, no acknowledgement, no watch): ${candidates.length}`);
  console.log(`  rows kept: ${kept}`);
  if (candidates.length) {
    const first = candidates.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
    const last = candidates.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    console.log(`  createdAt range: ${first.createdAt.toISOString().slice(0, 10)} to ${last.createdAt.toISOString().slice(0, 10)}`);
    console.log(`  sample: ${candidates.slice(0, 3).map((c) => c.email).join(", ")}`);
  }

  if (apply && candidates.length) {
    const res = await prisma.user.deleteMany({ where: { id: { in: candidates.map((c) => c.id) } } });
    const after = await prisma.user.count();
    console.log(`  deleted: ${res.count}`);
    console.log(`  User rows after: ${after}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
