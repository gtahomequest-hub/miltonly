// Export the VOW audit trail for a window, as the CSV PropTx would receive (MP-006, VOW
// Policy 19). Reads the same table and the same columns as /api/admin/vow-access?format=csv,
// from a shell, so the export does not depend on the site being up or on the admin cookie.
//
//   pnpm tsx scripts/export-vow-access-log.ts --from 2026-09-01 --to 2026-10-01 --out vow.csv
//   pnpm tsx scripts/export-vow-access-log.ts --suspicious --days 7
//   pnpm tsx scripts/export-vow-access-log.ts --consumer someone@example.com --out one.csv
//
// `--to` is exclusive. Without `--out` the CSV goes to stdout. `--suspicious` prints the review
// list instead (R-8.09(b)(iii)): people past a threshold in the window, or carrying a flag.
// `--consumer <email|userId>` prints the per-consumer record and trail (MP-007, Appendix B(b)),
// in the same column format as /api/admin/vow-access?consumer=… and as Homesly's audit report,
// so PropTx gets one format from both the site and the shell.

import fs from "node:fs";
import path from "node:path";
import { isSuspicious, csvCell, ACCESS_CSV_HEADER } from "../src/lib/vow-audit-rules";
import { buildConsumerReport, consumerReportCsv, CONSUMER_ROW_SELECT } from "../src/lib/vow/consumer-report";

function loadEnvLocal() {
  const f = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  loadEnvLocal();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  if (process.argv.includes("--suspicious")) {
    const days = Math.max(1, parseInt(arg("days") || "1", 10) || 1);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.vowAccessLog.findMany({ where: { at: { gte: since } }, select: { userId: true, kind: true, scope: true } });
    const by = new Map<string, { reads: number; scopes: Set<string> }>();
    for (const r of rows) {
      const cur = by.get(r.userId) ?? { reads: 0, scopes: new Set<string>() };
      cur.reads++;
      cur.scopes.add(`${r.kind}:${r.scope ?? ""}`);
      by.set(r.userId, cur);
    }
    const flagged = await prisma.user.findMany({ where: { reviewFlag: { not: null } }, select: { id: true, email: true, reviewFlag: true, reviewFlaggedAt: true } });
    console.log(`[vow-access] review list, last ${days} day(s)`);
    for (const f of flagged) {
      const v = by.get(f.id);
      console.log(`  ${f.email}  flag=${f.reviewFlag} since ${f.reviewFlaggedAt?.toISOString().slice(0, 10)}  reads=${v?.reads ?? 0} scopes=${v?.scopes.size ?? 0}`);
    }
    const heavy = Array.from(by.entries()).filter(([, v]) => isSuspicious(v.scopes.size, v.reads, days));
    for (const [id, v] of heavy) {
      if (flagged.some((f) => f.id === id)) continue;
      const u = await prisma.user.findUnique({ where: { id }, select: { email: true } });
      console.log(`  ${u?.email ?? id}  over threshold  reads=${v.reads} scopes=${v.scopes.size}`);
    }
    if (flagged.length === 0 && heavy.length === 0) console.log("  nobody");
    await prisma.$disconnect();
    return;
  }

  // The per-consumer record and trail (MP-007), aligned to Homesly's shape via the pure
  // buildConsumerReport — the same builder the site uses, so the two CSVs cannot drift.
  const consumer = arg("consumer");
  if (consumer) {
    const user = await prisma.user.findUnique({
      where: consumer.includes("@") ? { email: consumer.toLowerCase() } : { id: consumer },
      select: CONSUMER_ROW_SELECT,
    });
    if (!user) {
      console.error(`[vow-access] no such consumer: ${consumer}`);
      await prisma.$disconnect();
      process.exit(1);
    }
    const [access, consents, throttles] = await Promise.all([
      prisma.vowAccessLog.findMany({ where: { userId: user.id }, select: { at: true, kind: true, scope: true, path: true, recordCount: true, ip: true, userAgent: true }, orderBy: { at: "asc" } }),
      prisma.vowConsent.findMany({ where: { userId: user.id }, select: { at: true, version: true, ip: true, userAgent: true }, orderBy: { at: "asc" } }),
      prisma.vowThrottle.findMany({ where: { userId: user.id }, select: { at: true, limit: true, count: true, max: true, ip: true }, orderBy: { at: "asc" } }),
    ]);
    const csv = consumerReportCsv(buildConsumerReport(user, { access, consents, throttles }));
    const out = arg("out");
    if (out) {
      fs.writeFileSync(out, csv, "utf8");
      console.log(`[vow-access] consumer ${user.email}: ${access.length} reads, ${consents.length} agreements, ${throttles.length} throttles, written to ${out}`);
    } else {
      process.stdout.write(csv);
    }
    await prisma.$disconnect();
    return;
  }

  const from = new Date(`${arg("from") || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`);
  const to = new Date(`${arg("to") || new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`);
  const rows = await prisma.vowAccessLog.findMany({
    where: { at: { gte: from, lt: to } },
    orderBy: { at: "asc" },
    include: { user: { select: { id: true, email: true, firstName: true, isRegistrant: true, reviewFlag: true } } },
  });
  const esc = csvCell;
  const head = [...ACCESS_CSV_HEADER];
  const csv =
    [head.join(","), ...rows.map((r) => [r.at, r.user.id, r.user.email, r.user.firstName, r.user.isRegistrant, r.user.reviewFlag, r.kind, r.scope, r.path, r.recordCount, r.ip, r.userAgent].map(esc).join(","))].join("\n") + "\n";
  const out = arg("out");
  if (out) {
    fs.writeFileSync(out, csv, "utf8");
    console.log(`[vow-access] ${rows.length} rows, ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)} (exclusive), written to ${out}`);
  } else {
    process.stdout.write(csv);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
