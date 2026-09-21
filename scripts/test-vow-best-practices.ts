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

import { readFileSync } from "node:fs";
import { SignJWT, jwtVerify } from "jose";
import { judgeSession, SESSION_MAX_DAYS, INACTIVITY_MINUTES, COOKIE_NAME } from "@/lib/auth";
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
  ok(ack.includes("steps.needsPasswordRenewal") && ack.includes("verifyPassword(body.password, user.passwordHash)"), "the card's route takes a renewal: the same password reconfirms");
  ok(ack.includes("passwordData = { passwordSetAt: now }"), "a reconfirmation resets the clock and keeps the hash");
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
    // The touch keeps the ceiling: sign a token, re-sign with a new act and the same exp, and
    // read both back. This is the shape touchSession() produces (auth.ts); the function itself
    // needs a request's cookie jar, so the claims are exercised here.
    const secret = new TextEncoder().encode("test-secret");
    const exp = t + SESSION_MAX_DAYS * 86400;
    const token = await new SignJWT({ userId: "u", act: t + INACTIVITY_MINUTES * 60 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(t).setExpirationTime(exp).sign(secret);
    const { payload } = await jwtVerify(token, secret, { currentDate: new Date(t * 1000) });
    eq(payload.exp, exp, "the ceiling rides on exp");
    eq(payload.act, t + 3600, "the hour rides on act");
    const touched = await new SignJWT({ userId: "u", act: t + 1800 + 3600 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(t + 1800).setExpirationTime(payload.exp as number).sign(secret);
    const { payload: p2 } = await jwtVerify(touched, secret, { currentDate: new Date((t + 1800) * 1000) });
    eq(p2.exp, exp, "a touch keeps the original exp");
    eq(judgeSession({ userId: "u", exp: p2.exp as number, act: p2.act as number }, t + 1800 + 3599), "ok", "59 minutes after the touch: ok");
    eq(judgeSession({ userId: "u", exp: p2.exp as number, act: p2.act as number }, t + 1800 + 3600), "inactive", "60 minutes after the touch: inactive");
  }
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  ok(auth.includes("act: now + INACTIVITY_SECONDS") && auth.includes("const next: SessionClaims = { ...claims, act: now + INACTIVITY_SECONDS }"), "touchSession moves act and spreads the rest (exp untouched)");
  ok(!/exp: now \+ SESSION_SECONDS/.test(auth.split("export async function touchSession")[1] || ""), "touchSession never re-issues exp");
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
  const REQUIRED: Array<[string, RegExp[]]> = [
    ["i", [/lawful broker-consumer relationship/i, /Aamir Yaqoob/, /RE\/MAX Realty Specialists/]],
    ["ii", [/personal, non-commercial use only/i]],
    ["iii", [/bona fide interest in the purchase, sale or lease/i]],
    ["iv", [/copy, redistribute, retransmit or otherwise use/i, /individual property/i]],
    ["v", [/PropTx/, /copyright/i, /MLS® database/i, /Listing Information/]],
    ["vi", [/display, post, disseminate, distribute, publish, broadcast, transfer, sell or sublicense/i, /screen scrape/i, /database scrape/i, /data mine/i]],
    ["vii", [/mouse click/i, /no financial obligation/i, /representation agreement/i]],
    ["viii", [/authorize PropTx and other PropTx Members/i, /verify compliance/i, /monitor the display/i]],
    ["ix", [/privacy policy/i, /shared with PropTx for auditing and\/or legal purposes/i, /consent to the collection, use and disclosure/i]],
    ["signin", [/username is my email address/i, /password is mine alone/i, /expires 90 days/i, /60 minutes/i]],
  ];
  for (const [key, patterns] of REQUIRED) {
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
  ok(ack.includes("vowAcknowledgementVersion: VOW_TERMS_VERSION") && ack.includes("vowConsents: {") && ack.includes("create: { version: VOW_TERMS_VERSION"), "the route stores the version and appends the consent history");
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
  eq(VOW_ACCESS_KINDS.length, 6, "six kinds of VOW read");
  const SURFACES: Array<[string, string]> = [
    ["src/app/api/streets/[slug]/sold-records/route.ts", '"street-records"'],
    ["src/app/api/sold/route.ts", '"sold-api"'],
    ["src/app/api/sold-stats/route.ts", '"sold-stats"'],
    ["src/app/api/listings/[mlsNumber]/vow/route.ts", '"listing-vow"'],
    ["src/app/sold/page.tsx", '"sold-page"'],
    ["src/components/vow/VowGate.tsx", '"neighbourhood-records"'],
  ];
  for (const [f, kind] of SURFACES) {
    const src = readFileSync(f, "utf8");
    ok(src.includes("canSeeVowRecords(") && src.includes("logVowAccess(") && src.includes(`kind: ${kind}`), `${f} gates and then writes the trail as ${kind}`);
    const gate = src.indexOf("canSeeVowRecords(");
    const write = src.indexOf("logVowAccess(");
    ok(gate < write, `${f} writes the trail after the gate`);
  }
  for (const f of ["src/app/api/streets/[slug]/sold-records/route.ts", "src/app/api/sold/route.ts", "src/app/api/sold-stats/route.ts", "src/app/api/listings/[mlsNumber]/vow/route.ts"]) {
    ok(readFileSync(f, "utf8").includes("await touchSession()"), `${f} winds the inactivity clock`);
  }
  {
    const csv = accessCsv([
      { id: "1", at: new Date("2026-09-21T10:00:00Z"), kind: "street-records", scope: "a, b", path: "/p", recordCount: 3, ip: "1.2.3.4", userAgent: 'Mozilla "x"', user: { id: "u", email: "e@x.com", firstName: "Aamir", isRegistrant: false, reviewFlag: null } },
    ] as never);
    const lines = csv.trim().split("\n");
    eq(lines[0], "at,userId,email,name,registrant,reviewFlag,kind,scope,path,recordCount,ip,userAgent", "the CSV header names who, when, what, from where");
    ok(lines[1].includes('"a, b"') && lines[1].includes('"Mozilla ""x"""'), "the CSV quotes commas and doubles quotes");
  }
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
  ok(ack.includes('reviewFlag: user.reviewFlag ?? "registrant"'), "a yes goes to the review list");
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
