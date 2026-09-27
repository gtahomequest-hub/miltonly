// The VOW erasure path, run by the desk (MP-007, from MC-044's review). Anonymises a consumer
// on a removal request without erasing the 180-day record PropTx can ask for, and purges rows
// that are past that window.
//
//   pnpm tsx scripts/vow-erasure.ts anonymise someone@example.com
//   pnpm tsx scripts/vow-erasure.ts purge [--apply]      (dry run without --apply)
//
// anonymise: strips the non-mandated personal data, blocks sign-in, and deletes the row's
//   SavedSearch rows, keeping the name, email, username, password record and the access and
//   consent trail (Appendix B(b), Rule 8.06). Prints the row before and after.
// purge: hard-deletes credentialed rows past 180 days after their password expired; the trail
//   cascades with them, which is allowed once the window has passed. Dry run lists them; --apply
//   deletes. See src/lib/portal/erasure.ts for the rules.

import fs from "node:fs";
import path from "node:path";
import { anonymiseUpdate, isPurgeable } from "../src/lib/portal/erasure";

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
  const [op, target] = process.argv.slice(2);
  const now = new Date();

  const SEL = {
    id: true, email: true, firstName: true, verified: true, phone: true, savedListings: true,
    homeStreetSlug: true, passwordHash: true, passwordSetAt: true, erasureRequestedAt: true,
    vowAcknowledgementVersion: true,
  } as const;
  const show = async (label: string, id: string) => {
    const u = await prisma.user.findUnique({ where: { id }, select: SEL });
    console.log(label, JSON.stringify(u && { ...u, passwordHash: u.passwordHash ? `${u.passwordHash.slice(0, 7)}…` : null }));
  };

  if (op === "anonymise") {
    if (!target) throw new Error("anonymise needs an email");
    const u = await prisma.user.findUnique({ where: { email: target.toLowerCase() }, select: { id: true } });
    if (!u) {
      console.error(`no such consumer: ${target}`);
      await prisma.$disconnect();
      process.exit(1);
    }
    await show("before:", u.id);
    const deletedSearches = await prisma.savedSearch.deleteMany({ where: { userId: u.id } });
    await prisma.user.update({ where: { id: u.id }, data: anonymiseUpdate(now) });
    await show("after: ", u.id);
    const consents = await prisma.vowConsent.count({ where: { userId: u.id } });
    const access = await prisma.vowAccessLog.count({ where: { userId: u.id } });
    console.log(`kept the record and the trail: ${consents} consent rows, ${access} access rows. Removed ${deletedSearches.count} saved searches. Sign-in blocked; the row is purged after 180 days past the password's expiry.`);
    await prisma.$disconnect();
    return;
  }

  if (op === "purge") {
    const apply = process.argv.includes("--apply");
    // Credentialed rows only; the retention gate is in isPurgeable().
    const rows = await prisma.user.findMany({ where: { passwordHash: { not: null } }, select: { id: true, email: true, passwordHash: true, passwordSetAt: true, erasureRequestedAt: true } });
    const purgeable = rows.filter((r) => isPurgeable(r, now));
    console.log(`[vow-erasure] ${purgeable.length} of ${rows.length} credentialed rows are past 180 days after password expiry`);
    for (const r of purgeable) console.log(`  ${r.email}  passwordSetAt=${r.passwordSetAt?.toISOString().slice(0, 10)}  erasureRequested=${r.erasureRequestedAt?.toISOString().slice(0, 10) ?? "no"}`);
    if (apply && purgeable.length) {
      const del = await prisma.user.deleteMany({ where: { id: { in: purgeable.map((r) => r.id) } } });
      console.log(`[vow-erasure] purged ${del.count} rows (VowConsent, VowAccessLog and VowThrottle cascade)`);
    } else if (!apply) {
      console.log("[vow-erasure] dry run; pass --apply to delete");
    }
    await prisma.$disconnect();
    return;
  }

  console.error("usage: vow-erasure.ts anonymise <email> | purge [--apply]");
  await prisma.$disconnect();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
