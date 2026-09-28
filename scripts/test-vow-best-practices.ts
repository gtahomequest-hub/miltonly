// Prebuild test for MP-006, the PropTx VOW Best Practices on the portal:
//   1. the 90-day password (R-8.06): the clock, the renewal, the gate that holds on it;
//   2. the 60-minute inactivity timeout (R-8.13): the session claims, the touch, the ceiling;
//   3. the credential record (Appendix B(b)): the 180-day retention rule, the purge's refusal,
//      the unique username;
//   4. the nine Terms of Use clauses (Appendix B(c)): each present in VOW_TERMS_CLAUSES by its
//      required words, the text versioned, an older version owing re-consent, the privacy
//      clause bold on the card, the privacy page boldly saying PropTx;
//   5. the audit trail (VOW Policy 19): the row shape, every VOW surface writing it, the export;
//   6. the bona fide controls (R-8.09(b)): the registrant question, its refusal, the review flag
//      that refuses nothing.
// The behavioural half runs the pure functions. The structural half reads the source, so a
// future edit that drops a clause, a write, or the touch fails the build.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  judgeSession,
  signSessionToken,
  parseSessionToken,
  touchedClaims,
  freshClaims,
  SESSION_MAX_DAYS,
  INACTIVITY_MINUTES,
  COOKIE_NAME,
} from "@/lib/auth";
import { planAcknowledgement, cleanName } from "@/lib/portal/acknowledge";
import {
  PASSWORD_MAX_DAYS,
  CREDENTIAL_RETENTION_DAYS,
  passwordExpiresAt,
  passwordExpired,
  credentialRetainUntil,
} from "@/lib/portal/passwordRule";
import { VOW_TERMS_CLAUSES, VOW_TERMS_VERSION, VOW_ACKNOWLEDGEMENT_TEXT } from "@/lib/vow-acknowledgement";
import { canSeeVowRecords, vowStepsLeft, termsCurrent } from "@/lib/vow-access";
import { buildAccessRow, VOW_ACCESS_KINDS, SUSPICIOUS_SCOPES_PER_DAY, SUSPICIOUS_READS_PER_DAY, accessCsv } from "@/lib/vow-audit";
import { isSuspicious, csvCell } from "@/lib/vow-audit-rules";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  assertions++;
  if (!cond) failures.push(label);
}
function eq<T>(actual: T, expected: T, label: string) {
  assertions++;
  if (actual !== expected) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const now = new Date("2026-09-21T12:00:00Z");

  // ── 1. the 90-day password ────────────────────────────────────────────────────
  eq(PASSWORD_MAX_DAYS, 90, "the password lives 90 days (R-8.06)");
  eq(passwordExpiresAt(null), null, "no password, no expiry");
  eq(passwordExpiresAt(now)?.getTime(), now.getTime() + 90 * DAY, "expiry is set-at plus 90 days");
  ok(!passwordExpired(new Date(now.getTime() - 89 * DAY), now), "89 days old: not expired");
  ok(passwordExpired(new Date(now.getTime() - 90 * DAY), now), "90 days old: expired");
  ok(passwordExpired(new Date(now.getTime() - 200 * DAY), now), "200 days old: expired");
  ok(!passwordExpired(null, now), "no password is unset, not expired");
  const fresh = {
    verified: true,
    vowAcknowledgedAt: now,
    vowAcknowledgementVersion: VOW_TERMS_VERSION,
    passwordHash: "$2a$12$x",
    passwordSetAt: new Date(now.getTime() - 10 * DAY),
    isRegistrant: false,
    reviewFlag: null,
  };
  ok(canSeeVowRecords(fresh, now), "a fresh, agreed, non-registrant row sees records");
  {
    const old = { ...fresh, passwordSetAt: new Date(now.getTime() - 91 * DAY) };
    ok(!canSeeVowRecords(old, now), "a 91-day-old password sees no records");
    const s = vowStepsLeft(old, now);
    ok(s.needsPasswordRenewal && !s.needsPassword && !s.needsAcknowledgement, "an expired password owes a renewal, not a new set-up");
  }
  const ack = readFileSync("src/app/api/auth/acknowledge-vow/route.ts", "utf8");
  ok(ack.includes("planAcknowledgement(") && ack.includes('plan.password.kind === "reconfirm"') && ack.includes("{ passwordSetAt: now }"), "the route writes what the plan decides; a reconfirmation resets the clock and keeps the hash");
  // The plan itself, run: the same password reconfirms, a different one is judged and replaces,
  // a missing one is refused, and nothing else is asked of a row that only owes the renewal.
  const rowBase = {
    id: "u1",
    email: "person@example.com",
    firstName: "Aamir",
    verified: true,
    vowAcknowledgedAt: now,
    vowAcknowledgementVersion: VOW_TERMS_VERSION,
    vowAcknowledgementText: VOW_ACKNOWLEDGEMENT_TEXT,
    vowAcknowledgementIp: "1.1.1.1",
    vowAcknowledgementUserAgent: "ua",
    passwordHash: "$2a$12$x",
    passwordSetAt: new Date(now.getTime() - 10 * DAY),
    isRegistrant: false,
    reviewFlag: null,
    reviewFlaggedAt: null,
  };
  const ctx = { ip: "203.0.113.7", userAgent: "Mozilla/5.0 test", now };
  const ops = (matches: boolean, streets: string[] = ["pine-street-milton"]) => ({
    streetExists: async (slug: string) => streets.includes(slug),
    passwordMatches: async () => matches,
  });
  {
    const expired = { ...rowBase, passwordSetAt: new Date(now.getTime() - 91 * DAY) };
    const same = await planAcknowledgement(expired, { password: "correct horse battery" }, ops(true), ctx);
    ok(same.ok && same.password.kind === "reconfirm" && !same.agreement && same.consents.length === 0, "renewal: the same password reconfirms and nothing else is written");
    const other = await planAcknowledgement(expired, { password: "a different long passphrase" }, ops(false), ctx);
    ok(other.ok && other.password.kind === "replace" && other.password.password === "a different long passphrase", "renewal: a different password replaces");
    const short = await planAcknowledgement(expired, { password: "short" }, ops(false), ctx);
    ok(!short.ok && short.status === 400, "renewal: a different, short password is refused");
    const none = await planAcknowledgement(expired, {}, ops(false), ctx);
    ok(!none.ok && /Confirm your password/.test(none.error), "renewal: no password is refused with the renewal words");
    const fine = await planAcknowledgement(rowBase, {}, ops(false), ctx);
    ok(fine.ok && fine.password.kind === "none" && !fine.agreement, "a row that owes nothing writes nothing");
  }
  const login = readFileSync("src/app/api/auth/login/route.ts", "utf8");
  ok(login.includes("passwordSetAt: true") && !/passwordExpired\(/.test(login), "login still signs an expired password in; the gate, not the door, holds the renewal");

  // ── 2. the 60-minute inactivity timeout ───────────────────────────────────────
  eq(INACTIVITY_MINUTES, 60, "the inactivity timeout is 60 minutes (R-8.13)");
  eq(SESSION_MAX_DAYS, 90, "the ceiling is 90 days");
  const t = 1_800_000_000;
  eq(judgeSession({ userId: "u", exp: t + 100, act: t + 100 }, t), "ok", "active and under the ceiling: ok");
  eq(judgeSession({ userId: "u", exp: t + 100, act: t }, t), "inactive", "act reached: inactive");
  eq(judgeSession({ userId: "u", exp: t + 100, act: t - 1 }, t), "inactive", "act passed: inactive");
  eq(judgeSession({ userId: "u", exp: t, act: t + 100 }, t), "expired", "exp reached: expired, even with act ahead");
  eq(judgeSession({ userId: "u", exp: t - 1, act: t - 1 }, t), "expired", "both passed: expired wins");
  eq(judgeSession({ userId: "u", exp: t + 100 }, t), "invalid", "a token with no act (pre-MP-006) is invalid");
  eq(judgeSession(null, t), "invalid", "no claims: invalid");
  {
    // Through auth.ts's own functions, with this deployment's secret: a sign-in's claims, the
    // token they make, the claims read back, a touch, and the judge on each.
    const t0 = Math.floor(Date.now() / 1000);
    const fresh0 = freshClaims("u", t0);
    eq(fresh0.exp, t0 + SESSION_MAX_DAYS * 86400, "a sign-in's ceiling is 90 days out");
    eq(fresh0.act, t0 + INACTIVITY_MINUTES * 60, "a sign-in's hour is 60 minutes out");
    const token = await signSessionToken(fresh0);
    const back = await parseSessionToken(token);
    ok(!!back && back.userId === "u" && back.exp === fresh0.exp && back.act === fresh0.act, "the token carries userId, exp and act and reads back through parseSessionToken");
    ok((await parseSessionToken(token + "x")) === null, "a tampered token reads as nothing");
    const noAct = await new (await import("jose")).SignJWT({ userId: "u" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(fresh0.exp).sign(new TextEncoder().encode(process.env.JWT_SECRET || "miltonly-dev-secret-change-in-production"));
    const legacy = await parseSessionToken(noAct);
    eq(judgeSession(legacy, t0), "invalid", "a pre-MP-006 token (no act) is invalid, not active");
    const t1 = t0 + 1800;
    const touched = touchedClaims(back!, t1);
    eq(touched.exp, fresh0.exp, "a touch keeps the original exp");
    eq(touched.act, t1 + 3600, "a touch moves act an hour from the touch");
    const token2 = await signSessionToken(touched);
    const back2 = await parseSessionToken(token2);
    ok(!!back2 && back2.exp === fresh0.exp && back2.act === t1 + 3600, "the touched token reads back with the original exp");
    eq(judgeSession(back2, t1 + 3599), "ok", "59 minutes after the touch: ok");
    eq(judgeSession(back2, t1 + 3600), "inactive", "60 minutes after the touch: inactive");
    eq(judgeSession(back2, fresh0.exp), "expired", "at the ceiling: expired, however recent the touch");
    ok((await parseSessionToken(token2, new Date((fresh0.exp + 1) * 1000))) === null, "jose refuses the token past exp");
  }
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  ok(auth.includes("const next = touchedClaims(claims, now);") && auth.includes("setCookie(await signSessionToken(next), next.exp)"), "touchSession uses touchedClaims and re-signs");
  ok(auth.includes("const claims = freshClaims(userId, nowSeconds());"), "createSession uses freshClaims");
  ok(!/exp: now \+ SESSION_SECONDS/.test(auth.split("export async function touchSession")[1] || ""), "touchSession never re-issues exp");
  const provider = readFileSync("src/components/UserProvider.tsx", "utf8");
  ok(provider.includes("usePathname()") && provider.includes("}, [refresh, pathname]);"), "UserProvider refetches /me on every client navigation, so a soft navigation winds the clock");
  ok(auth.includes('judgeSession(claims, nowSeconds()) !== "ok"'), "getSession refuses inactive and expired tokens through judgeSession");
  const me = readFileSync("src/app/api/auth/me/route.ts", "utf8");
  ok(me.includes("await touchSession()"), "/api/auth/me winds the clock on every page mount");
  eq(COOKIE_NAME, "miltonly_session", "one cookie, the name the battery's vow-fields check uses");

  // ── 3. the credential record ──────────────────────────────────────────────────
  eq(CREDENTIAL_RETENTION_DAYS, 180, "credential records are kept 180 days past the password's expiry (Appendix B(b))");
  eq(credentialRetainUntil(now)?.getTime(), now.getTime() + (90 + 180) * DAY, "retain-until is expiry plus 180 days");
  eq(credentialRetainUntil(null), null, "no password, no retention clock");
  const purge = readFileSync("scripts/purge-bot-users.ts", "utf8");
  ok(purge.includes("passwordHash: null,"), "the purge never deletes a row with a password");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  ok(/email\s+String\s+@unique/.test(schema), "User.email is unique: one address, one username (Appendix B(b))");
  ok(/model VowConsent \{/.test(schema) && /model VowAccessLog \{/.test(schema), "the consent history and the access trail have tables");
  const door = readFileSync("src/lib/portal/door.ts", "utf8");
  ok(door.includes("export function normalizeEmail") && door.includes(".trim().toLowerCase()"), "the username is normalised, so case and whitespace cannot make two of one address");
  for (const f of ["src/app/api/auth/login/route.ts", "src/app/api/auth/verify/route.ts", "src/lib/portal/door.ts"]) {
    ok(readFileSync(f, "utf8").includes("normalizeEmail("), `${f} normalises the address`);
  }

  // ── 4. the nine clauses ───────────────────────────────────────────────────────
  eq(VOW_TERMS_VERSION, 4, "the terms are version 4");
  // Each clause by its operative words, negations included, so a rewording that drops "not"
  // or the object of the clause fails here.
  const REQUIRED: Array<[string, RegExp[]]> = [
    ["i", [/I am entering into a lawful broker-consumer relationship with Aamir Yaqoob/, /RE\/MAX Realty Specialists Inc\., Brokerage/, /Trust in Real Estate Services Act, 2002/]],
    ["ii", [/All MLS® data I obtain through this VOW is for my personal, non-commercial use only\./]],
    ["iii", [/I have a bona fide interest in the purchase, sale or lease of real estate/]],
    ["iv", [/I will not copy, redistribute, retransmit or otherwise use any of the data or information provided/, /except in connection with my consideration of the purchase, sale or lease of an individual property/]],
    ["v", [/I acknowledge that PropTx Innovations Inc\. \(PropTx\) owns, and holds the copyright in, the MLS® database, the data, the MLS® System and the Listing Information/]],
    ["vi", [/I will not display, post, disseminate, distribute, publish, broadcast, transfer, sell or sublicense any of the information/, /I will not screen scrape, database scrape or data mine this VOW/]],
    ["vii", [/by a mouse click or a tap, is sufficient to acknowledge these terms/, /impose no financial obligation on me/, /do not create a representation agreement/]],
    ["viii", [/I expressly authorize PropTx and other PropTx Members to access this VOW to verify compliance/, /monitor the display of Members' listings/]],
    ["ix", [/I have read the privacy policy at miltonly\.com\/privacy/, /I consent to the collection, use and disclosure of my personal information/, /may be shared with PropTx for auditing and\/or legal purposes/]],
    ["signin", [/My username is my email address and my password is mine alone; I will not share them/, /My password expires 90 days after I set it and I renew or reconfirm it then/, /A sign-in ends after 60 minutes without activity/]],
  ];
  eq(VOW_TERMS_CLAUSES.map((c) => c.key).join(","), "i,ii,iii,iv,v,vi,vii,viii,ix,signin", "the clauses are in the Appendix's order, the sign-in sentence last");
  // The text is bound to the version: a change to any clause without a bump fails here, so a
  // row that agreed to the old words cannot stay current by accident. Bump VOW_TERMS_VERSION
  // and this hash together.
  const TEXT_SHA256_AT_VERSION: Record<number, string> = { 4: "79f97c782450be8c5d3ac6704a7039ec5ed62952e1e181a930cb2d79997ac88a" };
  eq(createHash("sha256").update(VOW_ACKNOWLEDGEMENT_TEXT).digest("hex"), TEXT_SHA256_AT_VERSION[VOW_TERMS_VERSION], `the terms text is the one recorded for version ${VOW_TERMS_VERSION} (a change needs a version bump and a new hash here)`);  for (const [key, patterns] of REQUIRED) {
    const clause = VOW_TERMS_CLAUSES.find((c) => c.key === key);
    ok(!!clause, `clause (${key}) is present`);
    for (const p of patterns) ok(!!clause && p.test(clause.text), `clause (${key}) says ${p}`);
    ok(!!clause && VOW_ACKNOWLEDGEMENT_TEXT.includes(clause.text), `clause (${key}) is in the stored text`);
  }
  eq(VOW_TERMS_CLAUSES.filter((c) => c.bold).map((c) => c.key).join(","), "ix", "the privacy clause, and only it, is bold (Appendix B(c)(ix): boldly)");
  ok(/^1\. /.test(VOW_ACKNOWLEDGEMENT_TEXT) && VOW_ACKNOWLEDGEMENT_TEXT.split("\n").length === VOW_TERMS_CLAUSES.length, "the stored text is the clauses, numbered, one per line");
  ok(!/—/.test(VOW_ACKNOWLEDGEMENT_TEXT), "no em-dash in the terms");
  {
    const v3 = { ...fresh, vowAcknowledgementVersion: 3 };
    ok(!termsCurrent(v3) && !canSeeVowRecords(v3, now), "a row on version 3 sees no records");
    const s = vowStepsLeft(v3, now);
    ok(s.needsAcknowledgement && s.needsReconsent, "a row on version 3 owes a re-consent, not a first agreement");
    const never = { ...fresh, vowAcknowledgedAt: null, vowAcknowledgementVersion: null };
    const s2 = vowStepsLeft(never, now);
    ok(s2.needsAcknowledgement && !s2.needsReconsent, "a row that never agreed owes a first agreement");
    const nullVersion = { ...fresh, vowAcknowledgementVersion: null };
    ok(!termsCurrent(nullVersion), "a row acknowledged before versions were stored is treated as stale");
  }
  ok(ack.includes("vowAcknowledgementVersion: VOW_TERMS_VERSION") && ack.includes("vowConsents: { create: plan.consents }"), "the route stores the version and appends the consent history the plan lists");
  {
    // Re-consent through the plan: a row on version 3 with the tick gets the new agreement,
    // and its earlier agreement is carried into history first; without the tick, refused.
    const v3 = { ...rowBase, vowAcknowledgementVersion: 3, vowAcknowledgementText: "old text v3", vowAcknowledgedAt: new Date(now.getTime() - 30 * DAY) };
    const re = await planAcknowledgement(v3, { consent: true }, ops(false), ctx);
    ok(re.ok && re.agreement && re.consents.length === 2 && re.consents[0].version === 3 && re.consents[0].text === "old text v3" && re.consents[0].at.getTime() === v3.vowAcknowledgedAt.getTime() && re.consents[1].version === VOW_TERMS_VERSION && re.consents[1].text === VOW_ACKNOWLEDGEMENT_TEXT, "re-consent: the earlier agreement is carried into history, then the new one");
    ok(re.ok && re.password.kind === "none" && re.firstName === null, "re-consent asks nothing else of a row that owes nothing else");
    const noTick = await planAcknowledgement(v3, {}, ops(false), ctx);
    ok(!noTick.ok && /Tick the box/.test(noTick.error), "re-consent without the tick is refused");
    const legacy = { ...v3, vowAcknowledgementVersion: null };
    const reLegacy = await planAcknowledgement(legacy, { consent: true }, ops(false), ctx);
    ok(reLegacy.ok && reLegacy.consents[0].version === 0, "a pre-versioning agreement is carried as version 0");
    // First agreement: needs the tick, a name, a password; the street must be the registry's.
    const first = { ...rowBase, firstName: null, vowAcknowledgedAt: null, vowAcknowledgementVersion: null, vowAcknowledgementText: null, passwordHash: null, passwordSetAt: null, isRegistrant: null };
    const good = await planAcknowledgement(first, { consent: true, firstName: "Aamir", homeStreetSlug: "pine-street-milton", password: "correct horse battery", isRegistrant: false }, ops(false), ctx);
    ok(good.ok && good.agreement && good.consents.length === 1 && good.password.kind === "set" && good.firstName === "Aamir" && good.homeStreetSlug === "pine-street-milton" && good.registrant?.isRegistrant === false, "first agreement: everything recorded");
    const badStreet = await planAcknowledgement(first, { consent: true, firstName: "Aamir", homeStreetSlug: "no-such-street", password: "correct horse battery", isRegistrant: false }, ops(false), ctx);
    ok(!badStreet.ok && /Pick a street/.test(badStreet.error), "first agreement: a street the registry does not know is refused");
    const noName = await planAcknowledgement(first, { consent: true, password: "correct horse battery", isRegistrant: false }, ops(false), ctx);
    ok(!noName.ok && /name/.test(noName.error), "first agreement: no name is refused");
    const noAnswer = await planAcknowledgement(first, { consent: true, firstName: "Aamir", password: "correct horse battery" }, ops(false), ctx);
    ok(!noAnswer.ok && /registrant/.test(noAnswer.error), "first agreement: the registrant question must be answered");
    eq(cleanName("  A\u0000b\u001fc  "), "Abc", "control bytes are stripped from a name");
  }
  const card = readFileSync("src/components/vow/VowAcknowledgementPrompt.tsx", "utf8");
  ok(card.includes("VOW_TERMS_CLAUSES.map(") && card.includes("c.bold ? <strong>{c.text}</strong> : c.text"), "the card renders every clause and bolds the bold one");
  ok(card.includes("The terms have changed") && card.includes("needsReconsent"), "the card has the re-consent state");
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  ok(/className="font-bold" data-privacy-proptx/.test(privacy) && /shared with PropTx Innovations Inc\./.test(privacy) && /auditing and\/or legal purposes/.test(privacy), "/privacy boldly says the data may be shared with PropTx for auditing and/or legal purposes");
  ok(privacy.includes("at least 180 days after your password expires"), "/privacy states the 180-day retention");
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");
  ok(terms.includes("expires 90 days") && terms.includes("60 minutes without activity") && terms.includes("registrants may not use the VOW") && terms.includes("logged"), "/terms states the expiry, the timeout, the registrant rule and the log");

  // ── 5. the audit trail ────────────────────────────────────────────────────────
  {
    const row = buildAccessRow({ userId: "u", kind: "street-records", scope: "pine-street-milton", path: "/api/streets/pine-street-milton/sold-records", recordCount: 12.9, ip: "203.0.113.7, 10.0.0.1", userAgent: "x".repeat(400) });
    eq(row.recordCount, 12, "the count is floored to an integer");
    eq(row.userAgent?.length, 300, "the user agent is bounded");
    eq(row.scope, "pine-street-milton", "the scope is kept");
    const neg = buildAccessRow({ userId: "u", kind: "sold-page", recordCount: -3 });
    eq(neg.recordCount, 0, "a negative count is 0");
    eq(neg.scope, null, "no scope is null");
    let threw = false;
    try {
      buildAccessRow({ userId: "u", kind: "made-up" as never });
    } catch {
      threw = true;
    }
    ok(threw, "an unknown kind is refused");
  }
  eq(VOW_ACCESS_KINDS.length, 8, "eight kinds of VOW read");
  const SURFACES: Array<[string, string]> = [
    ["src/app/api/streets/[slug]/sold-records/route.ts", '"street-records"'],
    ["src/app/api/sold/route.ts", '"sold-api"'],
    ["src/app/api/sold-stats/route.ts", '"sold-stats"'],
    ["src/app/api/listings/[mlsNumber]/vow/route.ts", '"listing-vow"'],
    ["src/app/api/auth/saved-listings/route.ts", '"saved-listings"'],
    ["src/app/listings/page.tsx", '"listings-grid"'],
    ["src/app/sold/page.tsx", '"sold-page"'],
    ["src/components/vow/VowGate.tsx", '"neighbourhood-records"'],
  ];
  for (const [f, kind] of SURFACES) {
    const src = readFileSync(f, "utf8");
    ok(src.includes("canSeeVowRecords(") && src.includes("logVowAccess(") && src.includes(`kind: ${kind}`), `${f} gates and then writes the trail as ${kind}`);
    const gate = src.indexOf("canSeeVowRecords(");
    const write = src.indexOf("logVowAccess(");
    ok(gate < write, `${f} writes the trail after the gate`);
    // The write is on the served branch: between the gate and the write either the refusal
    // returns (the routes) or the write sits under an `if` on the gate's own verdict (the pages).
    const between = src.slice(gate, write);
    ok(/return /.test(between) || /if \((vow && user|canSeeStatus|canSeeRecords && user)\) \{\s*$/m.test(between), `${f}: the write is on the served branch (after the refusal's return, or under the gate's if)`);
  }
  // No VOW surface is missed: every file under src that gates on canSeeVowRecords must write
  // the trail, except the rule itself, the fetchers (gated again by their callers), the
  // delegating block, and the card that only reads the flag.
  const EXEMPT = new Set([
    "src/lib/vow-access.ts",
    "src/lib/sold-data.ts",
    "src/components/street/NeighbourhoodSoldBlock.tsx",
  ]);
  const gated: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) {
        const rel = p.replace(/\\/g, "/");
        if (readFileSync(p, "utf8").includes("canSeeVowRecords(") && !EXEMPT.has(rel)) gated.push(rel);
      }
    }
  };
  walk("src");
  for (const f of gated) {
    ok(readFileSync(f, "utf8").includes("logVowAccess("), `${f} gates on canSeeVowRecords and writes the trail`);
  }
  ok(gated.length >= SURFACES.length, `the grep found the listed surfaces (${gated.length} gated files)`);
  eq(SURFACES.length, 8, "eight surfaces write the trail");
  for (const f of ["src/app/api/streets/[slug]/sold-records/route.ts", "src/app/api/sold/route.ts", "src/app/api/sold-stats/route.ts", "src/app/api/listings/[mlsNumber]/vow/route.ts", "src/app/api/auth/saved-listings/route.ts", "src/app/api/auth/save-listing/route.ts", "src/app/api/auth/acknowledge-vow/route.ts"]) {
    ok(readFileSync(f, "utf8").includes("await touchSession()"), `${f} winds the inactivity clock`);
  }
  for (const f of ["src/app/api/streets/[slug]/sold-records/route.ts", "src/app/api/sold/route.ts", "src/app/api/listings/[mlsNumber]/vow/route.ts", "src/app/api/auth/me/route.ts"]) {
    ok(/no-store/.test(readFileSync(f, "utf8")), `${f} answers no-store`);
  }
  {
    const csv = accessCsv([
      { id: "1", at: new Date("2026-09-21T10:00:00Z"), kind: "street-records", scope: "a, b", path: "/p", recordCount: 3, ip: "1.2.3.4", userAgent: 'Mozilla "x"', user: { id: "u", email: "e@x.com", firstName: "Aamir", isRegistrant: false, reviewFlag: null } },
    ] as never);
    const lines = csv.trim().split("\n");
    eq(lines[0], "at,userId,email,name,registrant,reviewFlag,kind,scope,path,recordCount,ip,userAgent", "the CSV header names who, when, what, from where");
    ok(lines[1].includes('"a, b"') && lines[1].includes('"Mozilla ""x"""'), "the CSV quotes commas and doubles quotes");
    eq(csvCell("=1+1"), "'=1+1", "a formula-shaped cell is neutralised");
    eq(csvCell("+1"), "'+1", "a leading plus is neutralised");
    eq(csvCell("-1"), "'-1", "a leading minus is neutralised");
    eq(csvCell("@x"), "'@x", "a leading at is neutralised");
    eq(csvCell("plain"), "plain", "a plain cell is untouched");
    eq(csvCell(null), "", "null is empty");
  }
  ok(isSuspicious(41, 0) && isSuspicious(0, 401) && !isSuspicious(40, 400) && isSuspicious(81, 0, 2) && !isSuspicious(80, 0, 2), "the suspicious rule: over 40 scopes or 400 reads a day, scaled by the window");
  const auditSrc = readFileSync("src/lib/vow-audit.ts", "utf8");
  ok(auditSrc.includes("prisma.vowAccessLog.count(") && auditSrc.includes("prisma.vowAccessLog.groupBy(") && !/findMany\(\{\s*where: \{ userId, at: \{ gte: since \} \},\s*select: \{ scope: true, kind: true \}/.test(auditSrc), "flagIfSuspicious counts with aggregates, it does not load the day's rows");
  ok(auditSrc.includes("if (input.reviewFlag) return;"), "a flagged person is not re-counted on every read");
  ok(auditSrc.includes("EXPORT_MAX_DAYS = 366"), "an export window is capped at a year");
  const adminRoute = readFileSync("src/app/api/admin/vow-access/route.ts", "utf8");
  ok(adminRoute.includes("verifyAdminCookieValue(") && adminRoute.includes('format") === "csv"') && adminRoute.includes('"suspicious"'), "the export route is admin-only, offers CSV, and lists the review queue");
  ok(readFileSync("scripts/export-vow-access-log.ts", "utf8").includes("vowAccessLog.findMany"), "the shell export reads the same table");

  // ── 6. the bona fide controls ─────────────────────────────────────────────────
  {
    const yes = { ...fresh, isRegistrant: true };
    ok(!canSeeVowRecords(yes, now) && vowStepsLeft(yes, now).registrant, "a self-declared registrant sees no records");
    const unasked = { ...fresh, isRegistrant: null };
    ok(!canSeeVowRecords(unasked, now) && vowStepsLeft(unasked, now).needsRegistrantAnswer, "an unanswered registrant question holds the records");
    const flagged = { ...fresh, reviewFlag: "suspicious-access" };
    ok(canSeeVowRecords(flagged, now), "a suspicious-access flag refuses nothing on its own (review, not a wall)");
    const regFlag = { ...fresh, isRegistrant: false, reviewFlag: "registrant" };
    ok(!canSeeVowRecords(regFlag, now), "a registrant flag set by a person holds until cleared");
  }
  ok(card.includes('data-vow-registrant-question') && card.includes('value="yes"') && card.includes('value="no"'), "the card asks the registrant question");
  ok(card.includes("sayingYes") && card.includes("{ isRegistrant: true, ...(firstName.trim()"), "a yes is sent on its own, without a tick, a name or a password");
  ok(ack.includes('reviewFlag: user.reviewFlag ?? "registrant"'), "a yes goes to the review list");
  {
    const first = { ...rowBase, firstName: null, vowAcknowledgedAt: null, vowAcknowledgementVersion: null, vowAcknowledgementText: null, passwordHash: null, passwordSetAt: null, isRegistrant: null };
    const yes = await planAcknowledgement(first, { isRegistrant: true }, ops(false), ctx);
    ok(yes.ok && yes.registrant?.isRegistrant === true && yes.registrant.flag && !yes.agreement && yes.password.kind === "none", "a first-time yes is stored and flagged with nothing else asked");
    const answered = { ...rowBase, isRegistrant: true, reviewFlag: "registrant", reviewFlaggedAt: now };
    const clear = await planAcknowledgement(answered, { isRegistrant: false, consent: true }, ops(false), ctx);
    ok(!clear.ok && clear.status === 403, "an answered registrant cannot clear the flag by posting no");
    const handFlag = { ...rowBase, isRegistrant: false, reviewFlag: "registrant", reviewFlaggedAt: now };
    ok(!canSeeVowRecords(handFlag, now) && vowStepsLeft(handFlag, now).registrant, "a hand-set registrant flag shows the wall, not a dead card");
    const post = await planAcknowledgement(handFlag, { isRegistrant: false }, ops(false), ctx);
    ok(!post.ok && post.status === 403, "a hand-flagged person cannot clear it by posting");
  }
  ok(SUSPICIOUS_SCOPES_PER_DAY >= 20 && SUSPICIOUS_READS_PER_DAY >= 100, "the thresholds are above a household's day");
  const audit = readFileSync("src/lib/vow-audit.ts", "utf8");
  ok(audit.includes('reviewFlag: "suspicious-access"') && audit.includes("where: { id: userId, reviewFlag: null }"), "the tracking sets the flag once and never clears it");
  const access = readFileSync("src/lib/vow-access.ts", "utf8");
  ok(!/reviewFlag === "suspicious-access"/.test(access) && /reviewFlag === "registrant"/.test(access), "vow-access.ts refuses on the registrant flag and never on the suspicious one");

  if (failures.length) {
    console.error(`[vow-best-practices] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(`[vow-best-practices] PASS: ${assertions} assertions. 90-day password, 60-minute inactivity, nine clauses at version ${VOW_TERMS_VERSION}, the trail on ${SURFACES.length} surfaces.`);
}

main().catch((err) => {
  console.error("[vow-best-practices] crashed", err);
  process.exit(1);
});
