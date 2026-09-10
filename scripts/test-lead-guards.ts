// Prebuild regression test for the three things that decide whether a lead row is real:
// the honeypot, the rate limit, and the environment tag.
//
// Each one is here because it failed in production, not because it looked risky:
//   - /api/leads/create had NO honeypot and NO rate limit, and a plain curl against a
//     Vercel-protected preview deployment wrote a row into the production table.
//   - preview and production share one database, so an untagged preview submission is
//     indistinguishable from a real lead in every count and every alert.
//
// The behavioural half runs the real functions. The structural half reads the source, so a
// future edit that removes a guard from the ingest path fails here rather than in the data.
//
// Zero I/O: no Redis is configured under tsx, so checkRateLimit exercises its in-memory
// fallback, which is exactly the path a misconfigured deployment would take.

import { readFileSync } from "node:fs";
import { checkHoneypot, checkOrigin, checkRateLimit, hostAllowed, HONEYPOT_FIELD } from "@/lib/lead/guards";
import { resolveLeadEnv, isCountable } from "@/lib/lead/env";
import { normalizeIntent, isCanonicalIntent, leadValueFor } from "@/lib/lead/intent";
import { kindForSource } from "@/lib/lead/savedSearch";

let assertions = 0;
const failures: string[] = [];

function ok(cond: boolean, label: string) {
  assertions++;
  if (!cond) failures.push(label);
}
function eq<T>(actual: T, expected: T, label: string) {
  assertions++;
  if (actual !== expected) failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  // ── honeypot ──────────────────────────────────────────────────────────────────
  eq(checkHoneypot({}).ok, true, "honeypot: absent field passes");
  eq(checkHoneypot({ [HONEYPOT_FIELD]: "" }).ok, true, "honeypot: empty field passes");
  eq(checkHoneypot({ [HONEYPOT_FIELD]: "   " }).ok, true, "honeypot: whitespace passes");
  const trapped = checkHoneypot({ [HONEYPOT_FIELD]: "http://spam.example" });
  eq(trapped.ok, false, "honeypot: filled field is rejected");
  if (!trapped.ok) {
    eq(trapped.status, 200, "honeypot: answers 200, not 400 — a bot must not learn which field betrayed it");
    eq(trapped.reason, "honeypot", "honeypot: reason is recorded for the log");
  }

  // ── origin ────────────────────────────────────────────────────────────────────
  ok(hostAllowed("miltonly.com"), "origin: apex allowed");
  ok(hostAllowed("www.miltonly.com"), "origin: www allowed");
  ok(hostAllowed("miltonly-abc123-gtahomequest-hubs-projects.vercel.app"), "origin: preview host allowed");
  ok(hostAllowed("localhost:3000"), "origin: localhost allowed");
  ok(!hostAllowed("miltonly.com.evil.example"), "origin: suffix-spoofed host refused");
  ok(!hostAllowed("evil.example"), "origin: unrelated host refused");
  eq(checkOrigin(null, null).ok, false, "origin: no Origin and no Referer is refused");
  eq(checkOrigin("https://miltonly.com", null).ok, true, "origin: Origin alone is enough");
  eq(checkOrigin(null, "https://miltonly.com/streets/pine-street-milton").ok, true, "origin: Referer alone is enough");
  eq(checkOrigin("not a url", null).ok, false, "origin: unparseable Origin is refused");
  const foreign = checkOrigin("https://evil.example", null);
  eq(foreign.ok, false, "origin: foreign Origin is refused");
  if (!foreign.ok) eq(foreign.status, 403, "origin: refusal is a 403");

  // ── rate limit ────────────────────────────────────────────────────────────────
  // The in-memory fallback allows 5 per minute per key. Six calls from one IP must not all
  // pass, or the limiter is not wired at all.
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  let allowed = 0;
  for (let i = 0; i < 6; i++) {
    const v = await checkRateLimit({ ip });
    if (v.ok) allowed++;
  }
  ok(allowed < 6, "rate limit: six submissions from one IP are not all allowed");
  eq(allowed, 5, "rate limit: the fallback allows exactly five per window");
  const over = await checkRateLimit({ ip });
  eq(over.ok, false, "rate limit: the next call is still refused");
  if (!over.ok) eq(over.status, 429, "rate limit: refusal is a 429");

  // A different IP is unaffected — the limit is per key, not global.
  const freshIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  eq((await checkRateLimit({ ip: freshIp })).ok, true, "rate limit: a different IP is not affected");

  // The email dimension exists and is independent of the IP one.
  const addr = `guardtest${Date.now()}@example.com`;
  let emailAllowed = 0;
  for (let i = 0; i < 6; i++) {
    const v = await checkRateLimit({ ip: `192.0.2.${i + 1}`, email: addr });
    if (v.ok) emailAllowed++;
  }
  ok(emailAllowed < 6, "rate limit: one address submitted from six IPs is not allowed six times");

  // ── env tag ───────────────────────────────────────────────────────────────────
  const savedEnv = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    eq(resolveLeadEnv("miltonly.com"), "production", "env: production deployment tags production");
    // .env.local in this repo carries VERCEL_ENV="production", so the host is the only thing
    // that can tell a local dev server from the real one.
    eq(resolveLeadEnv("localhost:3000"), "development", "env: localhost is development even when VERCEL_ENV says production");
    eq(resolveLeadEnv("127.0.0.1:3000"), "development", "env: 127.0.0.1 is development");

    process.env.VERCEL_ENV = "preview";
    eq(resolveLeadEnv("miltonly-abc.vercel.app"), "preview", "env: preview deployment tags preview");
    eq(resolveLeadEnv(null), "preview", "env: preview without a host still tags preview");

    delete process.env.VERCEL_ENV;
    eq(resolveLeadEnv("miltonly.com"), "development", "env: no VERCEL_ENV is development, never production");
  } finally {
    if (savedEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedEnv;
  }

  eq(isCountable("production"), true, "env: only production is countable");
  eq(isCountable("preview"), false, "env: preview is not countable");
  eq(isCountable("development"), false, "env: development is not countable");

  // ── intent vocabulary ─────────────────────────────────────────────────────────
  eq(normalizeIntent("buyer"), "buy", "intent: buyer normalizes to buy");
  eq(normalizeIntent("seller"), "sell", "intent: seller normalizes to sell");
  eq(normalizeIntent("renter"), "rent", "intent: renter normalizes to rent");
  eq(normalizeIntent("home-valuation"), "sell", "intent: home-valuation normalizes to sell");
  eq(normalizeIntent(undefined), "buy", "intent: a missing token falls to buy, never to a 0 value");
  ok(leadValueFor("buyer") > 0, "intent: the token that used to score 0 now carries a value");
  eq(leadValueFor("seller"), 500, "intent: a seller is worth the seller value");
  eq(isCanonicalIntent("buyer"), false, "intent: buyer is not canonical");
  eq(isCanonicalIntent("buy"), true, "intent: buy is canonical");

  // ── watch kinds ───────────────────────────────────────────────────────────────
  eq(kindForSource("street-alert"), "street", "watch: a street alert makes a street watch");
  eq(kindForSource("street-exit-intent"), "street", "watch: the exit prompt makes a street watch");
  eq(kindForSource("condo-building-alert"), "hub", "watch: a building alert makes a hub watch");
  eq(kindForSource("daily-brief"), "brief", "watch: the daily brief makes a brief watch");
  eq(kindForSource("sold-home-valuation"), null, "watch: a valuation request is not an alert surface");

  // ── the env dimension reaches the watches, not just the lead rows ─────────────
  // Lead.env alone excluded a preview submission from the COUNTS and left it in the SENDS:
  // the alert cron runs on production and SavedSearch had no environment. A preview test
  // would have mailed a real address daily for as long as the watch lived.
  const watchSrc = readFileSync("src/lib/lead/savedSearch.ts", "utf-8");
  ok(watchSrc.includes("env: input.env"), "watch: the watch row carries the creating environment");
  ok(/findFirst\(\{[\s\S]*?env: input\.env/.test(watchSrc), "watch: the idempotency lookup is scoped to the environment");
  const sender = readFileSync("src/app/api/alerts/match/route.ts", "utf-8");
  ok(sender.includes("resolveLeadEnv("), "sender: resolves the environment it is running in");
  ok(/findMany\(\{[\s\S]*?env,/.test(sender), "sender: matches only watches from its own environment");
  const ingestSrc = readFileSync("src/lib/lead/ingest.ts", "utf-8");
  ok(/createWatchForLead\(\{[\s\S]*?env,/.test(ingestSrc), "wiring: ingest hands the env to the watch");

  // ── structural: the guards are actually wired into the one path ───────────────
  const ingest = readFileSync("src/lib/lead/ingest.ts", "utf-8");
  ok(ingest.includes("checkHoneypot("), "wiring: ingest calls checkHoneypot");
  ok(ingest.includes("checkOrigin("), "wiring: ingest calls checkOrigin");
  ok(ingest.includes("checkRateLimit("), "wiring: ingest calls checkRateLimit");
  ok(ingest.includes("resolveLeadEnv("), "wiring: ingest resolves the env tag");
  ok(ingest.includes("env,"), "wiring: ingest writes the env tag onto the row");

  // Every guard must run BEFORE the write, or a rejected submission still costs a row.
  const writeAt = ingest.indexOf("prisma.lead.create");
  ok(writeAt > 0, "wiring: ingest writes through prisma.lead.create");
  for (const guard of ["checkHoneypot(", "checkOrigin(", "checkRateLimit("]) {
    ok(ingest.indexOf(guard) < writeAt, `wiring: ${guard.slice(0, -1)} runs before the row is written`);
  }

  const route = readFileSync("src/app/api/leads/create/route.ts", "utf-8");
  ok(route.includes("ingestLead("), "wiring: the route delegates to the one ingest path");
  ok(!route.includes("prisma."), "wiring: the route does not write the database itself");
  ok(!route.includes("adsLead"), "wiring: the route no longer writes ads.leads");

  // The client helper and the server guard must agree on the field name.
  const client = readFileSync("src/lib/postLeadClient.ts", "utf-8");
  ok(client.includes('from "@/lib/lead/honeypot"'), "wiring: the client reads the honeypot name from the shared module");
  ok(client.includes("[HONEYPOT_FIELD]"), "wiring: the client sends the honeypot field");

  // No surface may hand-roll a fetch at the ingress any more.
  const surfaces = [
    "src/components/street/v2/StreetAlertCTA.tsx",
    "src/components/condo/CondoCTAs.tsx",
    "src/components/sold/SoldValuationCTA.tsx",
    "src/components/street/ExitIntent.tsx",
    "src/components/street/CornerWidget.tsx",
    "src/components/places/PlaceAlertForm.tsx",
    "src/components/lead/DailyBriefSignup.tsx",
  ];
  for (const f of surfaces) {
    const src = readFileSync(f, "utf-8");
    ok(!src.includes('fetch("/api/leads'), `${f}: no hand-rolled fetch at the ingress`);
    ok(src.includes('from "@/lib/postLeadClient"'), `${f}: uses the shared client helper`);
    ok(src.includes("honeypot"), `${f}: carries the honeypot`);
    ok(!/intent: "(buyer|seller|renter)"/.test(src), `${f}: sends the vocabulary the value model understands`);
  }

  if (failures.length > 0) {
    console.error(`[lead-guards] FAIL — ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[lead-guards] PASS — ${assertions} assertions across honeypot, origin, rate limit, env tag, intent, watches and wiring.`);
}

main().catch((err) => {
  console.error("[lead-guards] threw:", err);
  process.exit(1);
});
