// Prebuild gate for the weekly leads digest: the window, the slot, the surfaces list, the
// copy rules and the wiring.
//
// Each block is here for the same reason the brief's blocks are: the failure it guards
// against shows up in a Monday email, not in an error. A window off by four hours reports
// the wrong week's leads under the right heading. A surfaces list that drifts from the code
// reports a live surface as quiet or forgets a new one. A cron that fires at the wrong UTC
// hour sends at 08:00 for half the year. None of those fail a build on their own.
//
// The behavioural half runs the real functions. The structural half reads the source.
// Zero I/O beyond reading files. No database, no network, no env.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { digestWindow, isDigestSlot, localHour, DIGEST_HOUR } from "@/lib/digest/window";
import { LIVE_SOURCES, RETIRED_SOURCES, isLiveSource } from "@/lib/lead/sources";

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

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** Every .ts/.tsx file under `dir`, skipping node_modules and any retired/ folder. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "retired") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

async function main() {
  // ── the window: a Monday 07:00 EDT send ────────────────────────────────────────
  // 2026-09-14 is a Monday. 07:00 Toronto in EDT is 11:00 UTC.
  const mon = digestWindow(new Date("2026-09-14T11:00:00Z"));
  eq(mon.sentOn, "2026-09-14", "window: computed on the Monday");
  eq(mon.asOf, "2026-09-13", "window: reports through the Sunday, not into the sending day");
  eq(mon.week.firstDate, "2026-09-07", "window: the week is the seven days Monday to Sunday");
  eq(mon.week.days, 7, "window: seven days");
  eq(mon.week.start.toISOString(), "2026-09-07T04:00:00.000Z", "window: the week starts at Toronto midnight on the instant basis");
  eq(mon.week.end.toISOString(), "2026-09-14T04:00:00.000Z", "window: and ends at Toronto midnight Monday");
  eq(mon.week.dateStartUtc.toISOString(), "2026-09-07T00:00:00.000Z", "window: the date basis starts at UTC midnight of the first date");
  eq(mon.week.dateEndExclusiveUtc.toISOString(), "2026-09-14T00:00:00.000Z", "window: and ends, exclusive, at UTC midnight of the day after the last");
  eq(mon.month.firstDate, "2026-08-17", "window: the 28 days are four whole weeks ending the same Sunday");
  eq(mon.month.lastDate, "2026-09-13", "window: both periods end on the same day");
  eq(mon.month.days, 28, "window: twenty-eight days");
  eq(mon.month.start.toISOString(), "2026-08-17T04:00:00.000Z", "window: the 28-day instant basis starts at Toronto midnight");

  // Across the clock change. 2026-11-02 is the Monday after the fall-back Sunday; 07:00 EST
  // is 12:00 UTC. The week it reports starts in EDT and ends in EST, so its two instants
  // sit four and five hours after UTC midnight respectively, and the date basis does not move.
  const dst = digestWindow(new Date("2026-11-02T12:00:00Z"));
  eq(dst.week.firstDate, "2026-10-26", "window: the clock-change week starts on the right date");
  eq(dst.week.start.toISOString(), "2026-10-26T04:00:00.000Z", "window: its start is EDT midnight");
  eq(dst.week.end.toISOString(), "2026-11-02T05:00:00.000Z", "window: its end is EST midnight");
  eq(dst.week.dateStartUtc.toISOString(), "2026-10-26T00:00:00.000Z", "window: the date basis does not move on the clock change");
  eq(dst.week.dateEndExclusiveUtc.toISOString(), "2026-11-02T00:00:00.000Z", "window: nor does its end");

  // The instant and date bases disagree by exactly the offset, which is why both exist. A
  // Lead.createdAt of 2026-09-13T23:30 Toronto (03:30 UTC Monday) is inside the week on the
  // instant basis and would be outside it on the date basis. The view files that lead under
  // the 14th; the window states this rather than hiding it.
  const lateSunday = new Date("2026-09-14T03:30:00Z");
  ok(lateSunday >= mon.week.start && lateSunday < mon.week.end, "window: a late-Sunday lead is inside the week on the instant basis");
  ok(!(lateSunday < mon.week.dateEndExclusiveUtc), "window: and outside it on the date basis, which is the view's basis");

  // ── the slot: Monday 07:00 Toronto, from two UTC crons ──────────────────────────
  eq(DIGEST_HOUR, 7, "slot: the digest sends at 07:00");
  eq(localHour(new Date("2026-09-14T11:00:00Z")), 7, "slot: 11:00 UTC is 07:00 Toronto in EDT");
  eq(localHour(new Date("2026-11-09T12:00:00Z")), 7, "slot: 12:00 UTC is 07:00 Toronto in EST");
  ok(isDigestSlot(new Date("2026-09-14T11:00:00Z")).ok, "slot: the EDT firing at 11:00 UTC runs");
  ok(!isDigestSlot(new Date("2026-09-14T12:00:00Z")).ok, "slot: the EDT firing at 12:00 UTC is refused, it is 08:00");
  ok(isDigestSlot(new Date("2026-11-09T12:00:00Z")).ok, "slot: the EST firing at 12:00 UTC runs");
  ok(!isDigestSlot(new Date("2026-11-09T11:00:00Z")).ok, "slot: the EST firing at 11:00 UTC is refused, it is 06:00");
  ok(!isDigestSlot(new Date("2026-09-15T11:00:00Z")).ok, "slot: a Tuesday at 07:00 is not the slot");
  // The changeover Monday itself: 2026-11-02, EST since 02:00 Sunday. 12:00 UTC is 07:00.
  ok(isDigestSlot(new Date("2026-11-02T12:00:00Z")).ok && !isDigestSlot(new Date("2026-11-02T11:00:00Z")).ok, "slot: the first Monday in EST picks the 12:00 firing");

  const cron = JSON.parse(readFileSync("vercel.json", "utf-8")) as { crons: Array<{ path: string; schedule: string }> };
  const digestCrons = cron.crons.filter((c) => c.path.startsWith("/api/digest/leads")).map((c) => c.schedule).sort();
  eq(digestCrons.join(" | "), "0 11 * * 1 | 0 12 * * 1", "wiring: both UTC firings are registered, Mondays only");

  // ── the surfaces list is held to the code ───────────────────────────────────────
  // Every live source must still be sent by a mounted file. The lead layer itself names
  // every source (the confirmation copy, the watch kinds), so it is excluded, as is anything
  // under retired/. A surface unmounted without being moved to RETIRED fails here by name.
  const files = walk("src").filter((p) => !p.startsWith(join("src", "lib") + sep));
  const mounted = new Map<string, string>();
  for (const p of files) mounted.set(p, stripComments(readFileSync(p, "utf-8")));
  const quoted = (source: string) => new RegExp(`["'\`]${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`);
  const seen = new Set<string>();
  for (const s of LIVE_SOURCES) {
    ok(!seen.has(s.source), `sources: "${s.source}" is listed once`);
    seen.add(s.source);
    ok(s.where.length > 0, `sources: "${s.source}" says where it lives`);
    const re = quoted(s.source);
    const hit = Array.from(mounted.entries()).some(([, src]) => re.test(src));
    ok(hit, `sources: "${s.source}" is still sent by a mounted file under src/ (outside src/lib and retired/)`);
  }
  for (const r of Array.from(RETIRED_SOURCES)) {
    ok(!isLiveSource(r), `sources: retired "${r}" is not also live`);
    const re = quoted(r);
    const hit = Array.from(mounted.entries()).find(([, src]) => re.test(src));
    ok(!hit, `sources: retired "${r}" is not sent by a mounted file${hit ? ` (${hit[0]})` : ""}`);
  }
  // Every source the confirmation copy names is accounted for, one way or the other.
  const notify = stripComments(readFileSync(join("src", "lib", "lead", "notify.ts"), "utf-8"));
  const cases = Array.from(notify.matchAll(/case "([a-z0-9-]+)":/g)).map((m) => m[1]);
  ok(cases.length >= 20, "sources: the confirmation copy still names its sources by case");
  for (const c of Array.from(new Set(cases))) {
    ok(isLiveSource(c) || RETIRED_SOURCES.has(c), `sources: notify.ts names "${c}", which is neither live nor retired`);
  }
  // The four surfaces the forms gate lists as retired are retired here too.
  for (const r of ["street-exit-intent", "street-corner-widget"]) ok(RETIRED_SOURCES.has(r), `sources: "${r}" is retired`);

  // ── the compose reads the view on the date basis and everything else on the instants ──
  const compose = stripComments(readFileSync(join("src", "lib", "digest", "compose.ts"), "utf-8"));
  const viewQuery = compose.slice(compose.indexOf("FROM public.lead_daily_by_page") - 600, compose.indexOf("FROM public.lead_daily_by_page") + 200);
  ok(/day >= \$\{weekFrom\}::date AND day < \$\{weekTo\}::date/.test(viewQuery), "compose: the view's day is bounded by dates, half-open");
  ok(/day >= \$\{monthFrom\}::date AND day < \$\{monthTo\}::date/.test(viewQuery), "compose: for both periods");
  ok(!/day\s*[<>]=?\s*\$\{(week|month)\.(start|end)\}/.test(compose), "compose: the view's day is never bounded by an instant");
  ok(/createdAt: \{ gte: month\.start, lt: month\.end \}/.test(compose), "compose: the delivery log is read on the instants");
  ok(/createdAt: \{ gte: week\.start, lt: week\.end \}/.test(compose), "compose: and so is the cross-check count");
  ok(compose.includes('env: "production"'), "compose: subscriber, watch and delivery reads are production only");
  ok(compose.includes('lead: { env: "production" }'), "compose: the delivery log is joined to production leads");
  ok(!/\bmedian\b/i.test(compose), "compose: the copy never says median");
  ok(!compose.includes("\u2014"), "compose: no em-dashes in the copy");
  for (const word of ["best", "top-rated", "unbeatable", "fastest", "most popular"]) {
    ok(!new RegExp(`\\b${word}\\b`, "i").test(compose), `compose: no superlative "${word}"`);
  }
  ok(compose.includes("Counts, not rates"), "compose: the digest says it reports counts, not rates");
  ok(compose.includes("UTC calendar day"), "compose: the digest states the view's day basis");

  // ── the delivery log exists and never costs a lead ──────────────────────────────
  const notifyRaw = readFileSync(join("src", "lib", "lead", "notify.ts"), "utf-8");
  ok(notifyRaw.includes("prisma.leadActivity.createMany("), "log: send attempts are written to LeadActivity");
  ok(/email_sent/.test(notifyRaw) && /email_failed/.test(notifyRaw), "log: sent and failed are distinct types");
  ok(/outcome !== "skipped"/.test(notifyRaw), "log: a skipped send leaves no row");
  const recordFn = notifyRaw.slice(notifyRaw.indexOf("export async function recordDeliveries"));
  ok(/try \{[\s\S]*createMany[\s\S]*\} catch/.test(recordFn), "log: a write failure is caught, so the log cannot fail a lead");
  const ingest = stripComments(readFileSync(join("src", "lib", "lead", "ingest.ts"), "utf-8"));
  ok(ingest.includes("recordDeliveries(leadId, [confirmation, alert])"), "log: the ingest path records both sends");
  ok(/kind: "confirmation", outcome: "failed"/.test(ingest) && /kind: "ops_alert", outcome: "failed"/.test(ingest), "log: a thrown send is a failed attempt, not a skipped one");

  // ── the route ───────────────────────────────────────────────────────────────────
  const route = stripComments(readFileSync(join("src", "app", "api", "digest", "leads", "route.ts"), "utf-8"));
  ok(route.includes("process.env.CRON_SECRET"), "route: guarded by CRON_SECRET");
  ok(route.includes("process.env.LEADS_DIGEST_TO || process.env.ALERT_EMAIL_TO"), "route: the recipient is LEADS_DIGEST_TO, falling back to the desk alert address");
  ok(route.includes("isDigestSlot(") && route.includes("force"), "route: the slot guard runs, and force lifts it for a proof");
  ok(/env === "production" \? digest\.subject : `\[\$\{env\}\] \$\{digest\.subject\}`/.test(route), "route: a non-production send is labelled in the subject");
  ok(!route.includes("prisma."), "route: the route reads through compose, not the database");

  if (failures.length > 0) {
    console.error(`[leads-digest] FAIL — ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[leads-digest] PASS — ${assertions} assertions across window, slot, sources, compose, delivery log and route.`);
}

main().catch((err) => {
  console.error("[leads-digest] threw:", err);
  process.exit(1);
});
