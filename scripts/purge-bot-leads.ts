// ML-005: the sale-detail bot's rows, and what the new guards would have refused.
//
// DRY RUN BY DEFAULT. Pass --apply to delete anything.
//
// Two things, both over the last 30 days of public.Lead:
//
//   1. THE REFUSAL REPORT. Every row is replayed, in order, through the guards ML-005 added or
//      changed, against the fingerprint the row kept: the user-agent guard (a missing or quoted
//      User-Agent) and the rate limit with the collapsed per-inbox key and the daily windows,
//      simulated as sliding windows over the rows' own timestamps. The honeypot and the origin
//      check are not replayed: a row does not keep the honeypot field, and every stored row
//      passed the origin check that already existed. The count is by source and by guard, so
//      the reader sees what the rule buys and what it does not.
//
//   2. THE PURGE. Rows matching the bot's fingerprint EXACTLY: source "sale-detail", env
//      "production", a User-Agent that starts with a double quote, no consent text. Nothing
//      looser: not the names, not the Tor ranges, not the phones. LeadActivity cascades.
//      SavedSearch, User and VisitorProfile rows pointing at a purged lead are counted first and
//      the purge refuses to run if any exist, because those would be a person's rows.
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scripts/purge-bot-leads.ts
//   npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scripts/purge-bot-leads.ts --apply

import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

const APPLY = process.argv.includes("--apply");
const DAYS = 30;

type Row = {
  id: string;
  source: string;
  env: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  consentText: string | null;
  createdAt: Date;
};

(async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { checkUserAgent, emailLimitKey, RATE_LIMITS } = await import("@/lib/lead/guards");
  type RateBucket = keyof typeof RATE_LIMITS;
  const prisma = new PrismaClient();

  const since = new Date(Date.now() - DAYS * 86400e3);
  const rows: Row[] = await prisma.lead.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, source: true, env: true, email: true, ip: true, userAgent: true, consentText: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`purge-bot-leads — ${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} leads in the last ${DAYS} days (all environments)`);
  console.log("");

  // ── 1. the refusal report ──────────────────────────────────────────────────────
  const windowMs: Record<RateBucket, number> = { ip: 10 * 60e3, ipDay: 24 * 3600e3, email: 3600e3, emailDay: 24 * 3600e3 };
  const hits = new Map<string, number[]>();
  const take = (bucket: RateBucket, key: string, at: number): boolean => {
    const k = `${bucket}:${key}`;
    const arr = (hits.get(k) ?? []).filter((t) => at - t < windowMs[bucket]);
    if (arr.length >= RATE_LIMITS[bucket].tokens) {
      hits.set(k, arr);
      return true;
    }
    arr.push(at);
    hits.set(k, arr);
    return false;
  };
  const refused = new Map<string, Record<string, number>>(); // env/source -> guard -> n
  const note = (env: string, source: string, guard: string) => {
    const k = `${env}	${source}`;
    const r = refused.get(k) ?? {};
    r[guard] = (r[guard] ?? 0) + 1;
    r.total = (r.total ?? 0) + 1;
    refused.set(k, r);
  };
  const bySource = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.env}	${r.source}`;
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
    const ua = checkUserAgent(r.userAgent);
    if (!ua.ok) {
      note(r.env, r.source, `user agent (${ua.reason})`);
      continue;
    }
    const at = r.createdAt.getTime();
    const ip = r.ip ?? "unknown";
    if (take("ip", ip, at)) { note(r.env, r.source, "ip 10 min"); continue; }
    if (take("ipDay", ip, at)) { note(r.env, r.source, "ip day"); continue; }
    const key = emailLimitKey(r.email);
    if (key && take("email", key, at)) { note(r.env, r.source, "inbox 1 h"); continue; }
    if (key && take("emailDay", key, at)) { note(r.env, r.source, "inbox day"); continue; }
  }
  console.log("WOULD HAVE BEEN REFUSED, by environment, source and guard (replayed in order over the rows' own timestamps;");
  console.log("preview and development rows are the worktrees' own proof batches, listed so the rule's cost to a proof is visible):");
  for (const env of ["production", "preview", "development"]) {
    const keys = [...bySource.entries()].filter(([k]) => k.startsWith(env + "	")).sort((a, b) => b[1] - a[1]);
    if (keys.length === 0) continue;
    let envRows = 0;
    let envRefused = 0;
    console.log(`  ${env}`);
    for (const [k, n] of keys) {
      const source = k.split("	")[1];
      const r = refused.get(k);
      const parts = r ? Object.entries(r).filter(([g]) => g !== "total").map(([g, v]) => `${g} ${v}`).join(", ") : "";
      console.log(`    ${source.padEnd(30)} ${String(n).padStart(3)} rows  refused ${String(r?.total ?? 0).padStart(3)}${parts ? `  (${parts})` : ""}`);
      envRows += n;
      envRefused += r?.total ?? 0;
    }
    console.log(`    ${"TOTAL".padEnd(30)} ${String(envRows).padStart(3)} rows  refused ${String(envRefused).padStart(3)}`);
  }
  console.log("");

  // ── 2. the purge ───────────────────────────────────────────────────────────────
  const bot = rows.filter((r) => r.source === "sale-detail" && r.env === "production" && (r.userAgent ?? "").startsWith('"') && r.consentText == null);
  const ids = bot.map((r) => r.id);
  console.log(`BOT FINGERPRINT (source sale-detail, env production, User-Agent starting with a double quote, no consent text): ${bot.length} rows`);
  if (bot.length > 0) {
    console.log(`  first ${bot[0].createdAt.toISOString()}  last ${bot[bot.length - 1].createdAt.toISOString()}`);
    console.log(`  distinct IPs ${new Set(bot.map((r) => r.ip)).size}, distinct addresses ${new Set(bot.map((r) => r.email)).size}, distinct inboxes ${new Set(bot.map((r) => emailLimitKey(r.email))).size}`);
    const uas = new Set(bot.map((r) => r.userAgent));
    console.log(`  user agents: ${uas.size}`);
    for (const u of uas) console.log(`    ${u}`);
  }
  const [activity, watches, users, profiles] = await Promise.all([
    prisma.leadActivity.count({ where: { leadId: { in: ids } } }),
    prisma.savedSearch.count({ where: { leadId: { in: ids } } }),
    prisma.user.count({ where: { leadId: { in: ids } } }),
    prisma.visitorProfile.count({ where: { leadId: { in: ids } } }),
  ]);
  console.log(`  LeadActivity rows (cascade): ${activity}; SavedSearch ${watches}, User ${users}, VisitorProfile ${profiles} (must all be 0)`);

  if (!APPLY) {
    console.log("");
    console.log("dry run: nothing deleted. Re-run with --apply.");
    await prisma.$disconnect();
    return;
  }
  if (watches + users + profiles > 0) {
    console.error("refusing: a purged lead is referenced by a SavedSearch, User or VisitorProfile row");
    await prisma.$disconnect();
    process.exit(1);
  }
  const del = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  const left = await prisma.lead.count({ where: { source: "sale-detail", env: "production", userAgent: { startsWith: '"' } } });
  console.log("");
  console.log(`deleted ${del.count} leads (LeadActivity cascaded). Rows still matching the fingerprint: ${left}.`);
  await prisma.$disconnect();
})();
