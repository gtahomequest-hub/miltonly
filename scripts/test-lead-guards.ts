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
// The rate-limit block runs against whatever store is configured: the in-memory fallback
// locally, the real Upstash one on a Vercel build. Its keys carry per-run entropy for that
// reason, and it asserts only what holds of both. See the comment on that block.

import { readFileSync } from "node:fs";
import { checkHoneypot, checkOrigin, checkRateLimit, hostAllowed, HONEYPOT_FIELD } from "@/lib/lead/guards";
import { resolveLeadEnv, isCountable } from "@/lib/lead/env";
import { normalizeIntent, isCanonicalIntent, leadValueFor } from "@/lib/lead/intent";
import { kindForSource } from "@/lib/lead/savedSearch";
import { scoreLead } from "@/lib/lead/score";
import { normalizePhone, bedroomToInt, budgetToBand, propertyTypeFor, sanitizeText, mlsNumberFor } from "@/lib/lead/fields";
import { briefWindow, isSendingDay } from "@/lib/brief/window";

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
  //
  // THE STORE IS NOT THE SAME IN BOTH PLACES THIS TEST RUNS, and the original version of this
  // block assumed it was. Locally no Upstash variables are set, so checkRateLimit falls through
  // to the in-memory limiter and allows exactly 5 per key per minute. ON VERCEL THE UPSTASH
  // VARIABLES ARE SET, so the build runs against the real shared store with a 10-minute sliding
  // window and keys that outlive the process. The key was a random address out of 200, so two
  // builds inside ten minutes could collide on it: a preview failed with
  // "expected 5, got 3" on code that passes locally, which is a gate that cannot be trusted.
  //
  // Two changes. The key now carries enough entropy that no two runs can share one, and the
  // assertion states what is true of BOTH stores: the first call passes, the sixth does not,
  // and a refusal is a 429. The exact token count belongs to one implementation, not to the
  // behaviour being guarded.
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const ip = `203.0.113.${runId}`;
  eq((await checkRateLimit({ ip })).ok, true, "rate limit: the first submission from a fresh key passes");
  let allowed = 1;
  for (let i = 0; i < 5; i++) {
    const v = await checkRateLimit({ ip });
    if (v.ok) allowed++;
  }
  ok(allowed < 6, `rate limit: six submissions from one key are not all allowed (allowed ${allowed})`);
  ok(allowed >= 5, `rate limit: the window is not narrower than the five it advertises (allowed ${allowed})`);
  const over = await checkRateLimit({ ip });
  eq(over.ok, false, "rate limit: the next call is still refused");
  if (!over.ok) eq(over.status, 429, "rate limit: refusal is a 429");

  // A different key is unaffected — the limit is per key, not global.
  eq((await checkRateLimit({ ip: `198.51.100.${runId}` })).ok, true, "rate limit: a different IP is not affected");

  // The email dimension exists and is independent of the IP one.
  const addr = `guardtest${runId}@example.com`;
  let emailAllowed = 0;
  for (let i = 0; i < 6; i++) {
    const v = await checkRateLimit({ ip: `192.0.2.${i}.${runId}`, email: addr });
    if (v.ok) emailAllowed++;
  }
  ok(emailAllowed < 6, `rate limit: one address submitted from six IPs is not allowed six times (allowed ${emailAllowed})`);

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
  eq(kindForSource("alert"), "price-band", "watch: the rentals alert strip makes a price-band watch");
  eq(kindForSource("new-match-alert"), "price-band", "watch: the quiz alert makes a price-band watch");
  eq(kindForSource("homepage-newsletter"), null, "watch: the pre-footer promises a Sunday brief no sender sends, so it leaves no watch");

  // ── scoring: one rule, reproducing every score the four old branches produced ──
  // The generic branch was the odd one out. It gave 30 points for a phone and 0 without one,
  // on a scale where the other three used 25/50/75, so a homepage lead and an ads lead with
  // identical contact details sorted differently in the same admin list.
  eq(scoreLead({ intent: "sell", hasPhone: false }).score, "hot", "score: a seller is hot with or without a phone");
  eq(scoreLead({ intent: "sell", hasPhone: false }).points, 75, "score: a seller is 75 points");
  eq(scoreLead({ intent: "sell", hasPhone: false }).temperature, "Hot", "score: the admin column agrees with the score");
  eq(scoreLead({ intent: "buy", hasPhone: true, preApproved: "yes", timeline: "asap" }).score, "hot", "score: a pre-approved buyer in a hurry is hot");
  eq(scoreLead({ intent: "buy", hasPhone: true, preApproved: "yes", timeline: "1-3months" }).score, "hot", "score: pre-approved inside three months is hot");
  eq(scoreLead({ intent: "buy", hasPhone: true, preApproved: "yes", timeline: "browsing" }).score, "warm", "score: pre-approved but browsing is warm, not hot");
  eq(scoreLead({ intent: "buy", hasPhone: true, preApproved: "no", timeline: "asap" }).score, "warm", "score: not pre-approved is warm on the phone alone");
  eq(scoreLead({ intent: "rent", hasPhone: true }).score, "warm", "score: a reachable renter is warm");
  eq(scoreLead({ intent: "rent", hasPhone: true }).points, 50, "score: warm is 50 points, not the old generic 30");
  eq(scoreLead({ intent: "buy", hasPhone: false }).score, "cold", "score: an email and nothing else is cold");
  eq(scoreLead({ intent: "buy", hasPhone: false }).points, 25, "score: cold is 25 points, not the old generic 0");

  // ── field mappings: the four copies the monolith kept, reconciled ──────────────
  eq(normalizePhone("(647) 555-0123"), "+16475550123", "fields: ten digits are North American E.164");
  eq(normalizePhone("447911123456"), "+447911123456", "fields: a longer number is already country-coded");
  eq(normalizePhone("555-0123"), null, "fields: fewer than ten digits is no phone at all");
  eq(bedroomToInt("studio"), 0, "fields: a studio is 0 bedrooms, not no answer");
  eq(bedroomToInt("4+"), 4, "fields: 4+ is four");
  eq(bedroomToInt(undefined), null, "fields: no answer is null");
  // THE DEFECT THIS REPLACES: budgetToInt read "$2K–$2.5K" as null, so a rental quiz lead
  // stored no budget while the realtor email carried the token intact.
  eq(budgetToBand("$2K–$2.5K").min, 2000, "fields: a K range reads its lower end");
  eq(budgetToBand("$2K–$2.5K").max, 2500, "fields: a K range reads its upper end");
  eq(budgetToBand("$900K – $1.2M").min, 900000, "fields: K and M mix inside one range");
  eq(budgetToBand("$900K – $1.2M").max, 1200000, "fields: the M end is millions");
  eq(budgetToBand("Under $700K").max, 700000, "fields: an open lower end is an upper bound");
  eq(budgetToBand("Under $700K").min, null, "fields: under means no lower bound");
  eq(budgetToBand("$2M+").min, 2000000, "fields: a plus is a lower bound");
  eq(budgetToBand("$2M+").max, null, "fields: a plus has no upper bound");
  eq(budgetToBand("3500").max, 3500, "fields: a plain number is an upper bound");
  eq(budgetToBand("0").max, null, "fields: zero is honest about no budget specified");
  eq(budgetToBand(undefined).max, null, "fields: no budget is null, never 0");
  eq(propertyTypeFor("Semi-detached"), "semi", "fields: the form token maps to the canonical type");
  eq(propertyTypeFor("Any"), null, "fields: any is no filter, not a type");
  eq(propertyTypeFor("chalet"), null, "fields: an unknown token stores nothing rather than a guess");
  eq(sanitizeText("<script>x</script> hello"), "x hello", "fields: tags are stripped from free text");
  eq(sanitizeText("   "), null, "fields: whitespace-only free text is null");
  eq(mlsNumberFor("W12345678"), "W12345678", "fields: a well-formed MLS number is kept");
  eq(mlsNumberFor("not-an-mls"), null, "fields: a malformed MLS number stores nothing and never refuses the lead");

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
  // The full surface sweep lives in scripts/test-lead-forms.ts, which walks src/ rather than
  // reading a list. These seven stay here because they are the Phase 1 set and this test is
  // where their regression was first caught.
  const surfaces = [
    "src/components/street/v2/StreetAlertCTA.tsx",
    "src/components/condo/CondoCTAs.tsx",
    "src/components/sold/SoldValuationCTA.tsx",
    // Retired 2026-09-10 to retired/ (not mounted by any page, and not being added to street
    // pages). Still asserted: a retired file is dead, not exempt, and if it is ever remounted
    // it must come back already holding the ingress contract rather than the 2026 monolith
    // fetch it originally shipped with.
    "src/components/street/retired/ExitIntent.tsx",
    "src/components/street/retired/CornerWidget.tsx",
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

  // ── the daily brief: the window, and the rules its copy is held to ────────────
  //
  // The window is the part most likely to rot silently. A wrong boundary does not throw; it
  // publishes yesterday's Milton under today's date, or drops a day entirely.

  // A Tuesday reports one local day. Noon UTC is morning in Toronto either side of a clock
  // change, so the local date is unambiguous.
  const tue = briefWindow(new Date("2026-09-15T13:15:00Z"));
  eq(tue.days, 1, "brief: a Tuesday edition covers one day");
  eq(tue.date, "2026-09-14", "brief: a Tuesday edition reports Monday");
  eq(tue.label, "yesterday", "brief: a Tuesday edition calls it yesterday");
  eq(tue.start.toISOString(), "2026-09-14T04:00:00.000Z", "brief: the window starts at local midnight, not UTC midnight");
  eq(tue.end.toISOString(), "2026-09-15T04:00:00.000Z", "brief: the window ends at the next local midnight");

  // A MONDAY COVERS THE WEEKEND. Sending Monday to Friday and reporting a literal "yesterday"
  // would mean Saturday's activity was never reported to anybody: Sunday's edition does not
  // exist and Monday's would cover Sunday.
  const mon = briefWindow(new Date("2026-09-14T13:15:00Z"));
  eq(mon.days, 2, "brief: a Monday edition covers two days");
  eq(mon.label, "over the weekend", "brief: a Monday edition names the period it actually read");
  eq(mon.start.toISOString(), "2026-09-12T04:00:00.000Z", "brief: a Monday edition reaches back to Saturday");
  eq(mon.date, "2026-09-13", "brief: a Monday edition is dated by its last day");

  // The clock change. On 2026-11-02 (the Monday after the fall-back) the window has to cross a
  // boundary where local noon is UTC-5 and the Saturday it reaches back to was UTC-4.
  const dst = briefWindow(new Date("2026-11-02T14:15:00Z"));
  eq(dst.start.toISOString(), "2026-10-31T04:00:00.000Z", "brief: a window crossing the clock change starts at the correct local midnight");
  eq(dst.end.toISOString(), "2026-11-02T05:00:00.000Z", "brief: and ends at the correct one on the other side");

  eq(isSendingDay(new Date("2026-09-14T13:15:00Z")), true, "brief: Monday is a sending day");
  eq(isSendingDay(new Date("2026-09-18T13:15:00Z")), true, "brief: Friday is a sending day");
  eq(isSendingDay(new Date("2026-09-19T13:15:00Z")), false, "brief: Saturday is not");
  eq(isSendingDay(new Date("2026-09-20T13:15:00Z")), false, "brief: Sunday is not");
  // 00:30 UTC on a Saturday is 20:30 Friday in Toronto, which is still a sending day.
  eq(isSendingDay(new Date("2026-09-19T00:30:00Z")), true, "brief: the sending day is local, not UTC");

  // ── the brief's copy rules, read off the source ────────────────────────────────
  const compose = readFileSync("src/lib/brief/compose.ts", "utf-8");
  ok(compose.includes("K_ANON_PRICE"), "brief: the typical price is gated by the shared k floor, not a restated number");
  ok(/K_ANON_PRICE\s*\?[\s\S]{0,80}:\s*null/.test(compose), "brief: suppression is null, never 0");
  ok(compose.includes("changed price"), "brief: a price movement is reported as changed");
  ok(!/dropped/i.test(compose), "brief: never says dropped — lastPriceChangeAt cannot tell a cut from a rise");
  ok(compose.includes("resolveStreetName("), "brief: a street name comes from the one resolver");
  ok(compose.includes("publishedStreetPageSlugs"), "brief: a street is only linked when it has a published page");
  ok(compose.includes("shouldSend"), "brief: an edition with nothing in it is not sent");

  const briefSender = readFileSync("src/app/api/brief/send/route.ts", "utf-8");
  ok(briefSender.includes("resolveLeadEnv("), "brief sender: resolves the environment it is running in");
  ok(/findMany\(\{[\s\S]*?env,/.test(briefSender), "brief sender: reads only watches from its own environment");
  ok(/kind: "brief"/.test(briefSender), "brief sender: reads the brief watches");
  ok(briefSender.includes("isSendingDay("), "brief sender: Monday to Friday");
  ok(briefSender.includes("unsubscribeUrl("), "brief sender: every edition carries an unsubscribe link");
  ok(briefSender.includes("List-Unsubscribe"), "brief sender: and the one-click header a mail client reads");
  ok(briefSender.includes("byEmail"), "brief sender: one email per subscriber, not one per watch");
  ok(briefSender.includes("lastAlertAt"), "brief sender: stamps the send so a retry cannot repeat an edition");
  ok(
    briefSender.includes("BRIEF_UNSUBSCRIBE_SECRET") && briefSender.includes("CRON_SECRET"),
    "brief sender: refuses to send a commercial email it cannot sign an unsubscribe link for",
  );

  const unsub = readFileSync("src/lib/brief/unsubscribe.ts", "utf-8");
  ok(unsub.includes("createHmac("), "unsubscribe: the link is signed, so it cannot be forged or scanned");
  ok(unsub.includes("timingSafeEqual("), "unsubscribe: the token comparison is constant time");
  ok(/throw new Error\(/.test(unsub), "unsubscribe: an unsignable link throws rather than shipping one that will not verify");

  const cron = JSON.parse(readFileSync("vercel.json", "utf-8")) as { crons: Array<{ path: string; schedule: string }> };
  const briefCron = cron.crons.find((c) => c.path.startsWith("/api/brief/send"));
  ok(Boolean(briefCron), "brief: the sender has a cron entry — the alert job had none for months");
  ok(briefCron?.schedule.endsWith("1-5") ?? false, "brief: the cron runs Monday to Friday");
  // It has to run after the sold sync and the stats compute, or "yesterday" is half-filled.
  const soldSync = cron.crons.find((c) => c.path === "/api/sync/sold");
  ok(Boolean(soldSync), "brief: the sold sync it depends on still exists");

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
