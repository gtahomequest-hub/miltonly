// Prebuild test for the door (MP-002): the sign-in request, the code and the link.
//
// The headline assertion is the one the task set: a run of 100 bot signups sends zero emails.
// It runs the real requestSignIn() with the database and the sender replaced by counters, so
// the guards are the real guards and the count is the real count. The rate-limit dimension
// uses an injected limiter with the lead layer's numbers, because the real store is Upstash on
// a Vercel build and spending 100 tokens there to prove arithmetic is not a test.
//
// The behavioural half runs the pure judges (expiry, the five-attempt lock, the match). The
// structural half reads the source, so a future edit that takes a guard out of the signup
// route, adds a sliding session, or lets the island send an acknowledged-less user back to
// /signin fails here rather than in production.

import { readFileSync } from "node:fs";
import {
  requestSignIn,
  judgeCode,
  judgeToken,
  hashToken,
  safeRedirect,
  normalizeEmail,
  generateCode,
  linkOrigin,
  magicLink,
  MAX_ATTEMPTS,
  CODE_MINUTES,
  type SignInRequest,
  type IssuedSecret,
} from "@/lib/portal/door";
import { HONEYPOT_FIELD, type GuardVerdict } from "@/lib/lead/guards";
import { SESSION_MAX_DAYS } from "@/lib/auth";
import { VOW_ACKNOWLEDGEMENT_TEXT } from "@/lib/vow-acknowledgement";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";

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

function counters() {
  const persisted: IssuedSecret[] = [];
  const sent: Array<{ email: string; code: string; link: string; minutes: number }> = [];
  return {
    persisted,
    sent,
    deps: {
      persist: async (s: IssuedSecret) => {
        persisted.push(s);
      },
      send: async (m: { email: string; code: string; link: string; minutes: number }) => {
        sent.push(m);
      },
    },
  };
}

function req(over: Partial<SignInRequest> & { body?: Record<string, unknown> }): SignInRequest {
  return {
    body: { email: "person@example.com", redirect: "/streets/pine-street-milton#sold-records" },
    ip: "203.0.113.7",
    origin: "https://miltonly.com",
    referer: null,
    host: "miltonly.com",
    proto: "https",
    ...over,
  };
}

/** A limiter with the lead layer's numbers (5 per IP per window, 3 per email), in memory. */
function fakeLimiter() {
  const ip = new Map<string, number>();
  const email = new Map<string, number>();
  return async (args: { ip: string; email?: string }): Promise<GuardVerdict> => {
    const i = (ip.get(args.ip) ?? 0) + 1;
    ip.set(args.ip, i);
    if (i > 5) return { ok: false, status: 429, error: "Too many requests", reason: `ip ${args.ip}` };
    if (args.email) {
      const e = (email.get(args.email) ?? 0) + 1;
      email.set(args.email, e);
      if (e > 3) return { ok: false, status: 429, error: "Too many requests", reason: `email ${args.email}` };
    }
    return { ok: true };
  };
}

async function main() {
  // ── 100 bot signups, zero emails ─────────────────────────────────────────────
  {
    const c = counters();
    let twoHundreds = 0;
    for (let i = 0; i < 100; i++) {
      const r = await requestSignIn(
        req({ body: { email: `b.o.t.${i}@gmail.com`, [HONEYPOT_FIELD]: "http://spam.example" }, ip: `198.51.100.${i % 20}` }),
        { ...c.deps, rateLimit: fakeLimiter() },
      );
      if (r.status === 200) twoHundreds++;
    }
    eq(c.sent.length, 0, "100 honeypot signups: emails sent");
    eq(c.persisted.length, 0, "100 honeypot signups: rows written");
    eq(twoHundreds, 100, "100 honeypot signups: every one answered 200 so the bot learns nothing");
  }
  {
    const c = counters();
    let forbidden = 0;
    for (let i = 0; i < 100; i++) {
      const r = await requestSignIn(
        req({ body: { email: `curl${i}@example.com` }, origin: null, referer: null }),
        { ...c.deps, rateLimit: fakeLimiter() },
      );
      if (r.status === 403) forbidden++;
    }
    eq(c.sent.length, 0, "100 no-origin signups: emails sent");
    eq(c.persisted.length, 0, "100 no-origin signups: rows written");
    eq(forbidden, 100, "100 no-origin signups: every one refused 403");
  }
  {
    const c = counters();
    const limiter = fakeLimiter();
    for (let i = 0; i < 100; i++) {
      await requestSignIn(req({ body: { email: `flood${i}@example.com` }, ip: "203.0.113.99" }), { ...c.deps, rateLimit: limiter });
    }
    ok(c.sent.length <= 5, `100 signups from one IP: sent ${c.sent.length}, the IP limit is 5`);
    eq(c.sent.length, c.persisted.length, "one IP: a row is written only when an email goes");
  }
  {
    const c = counters();
    const limiter = fakeLimiter();
    for (let i = 0; i < 100; i++) {
      await requestSignIn(req({ body: { email: "one@example.com" }, ip: `192.0.2.${i}` }), { ...c.deps, rateLimit: limiter });
    }
    ok(c.sent.length <= 3, `100 signups for one address from 100 IPs: sent ${c.sent.length}, the email limit is 3`);
  }
  {
    const c = counters();
    const r = await requestSignIn(req({ body: { email: "not an email" } }), { ...c.deps, rateLimit: fakeLimiter() });
    eq(r.status, 400, "a bad address is refused before the limiter");
    eq(c.sent.length, 0, "a bad address sends nothing");
  }

  // ── one real request: the shape of what is sent ──────────────────────────────
  {
    const c = counters();
    const r = await requestSignIn(req({ host: "miltonly-abc123.vercel.app", proto: "https" }), { ...c.deps, rateLimit: fakeLimiter() });
    eq(r.status, 200, "a good request answers 200");
    eq(c.sent.length, 1, "a good request sends one email");
    eq(c.persisted.length, 1, "a good request writes one row");
    const m = c.sent[0];
    const p = c.persisted[0];
    ok(/^\d{6}$/.test(m.code), "the code is six digits");
    eq(m.code, p.code, "the emailed code is the stored code");
    ok(m.link.startsWith("https://miltonly-abc123.vercel.app/signin/link?t="), `the link opens the host that served the form: ${m.link}`);
    ok(m.link.includes(`&r=${encodeURIComponent("/streets/pine-street-milton#sold-records")}`), "the link carries the redirect");
    const token = new URL(m.link).searchParams.get("t") || "";
    eq(hashToken(token), p.tokenHash, "the stored hash is the hash of the emailed token");
    ok(!m.link.includes(p.tokenHash), "the hash itself is not in the email");
    eq(m.minutes, CODE_MINUTES, "the email says how long it lasts");
    ok(p.expiry.getTime() - Date.now() <= CODE_MINUTES * 60_000 + 1000, "the expiry is the code window");
    eq(r.ok && r.body.message, "Check your email. Tap the link, or type the code. It works for 15 minutes.", "the success message");
  }
  eq(linkOrigin("evil.example", "https"), "https://miltonly.com", "an unowned host falls back to the site");
  eq(linkOrigin("localhost:3000", null), "http://localhost:3000", "localhost links are http");
  eq(magicLink("https://miltonly.com", "abc", "/x"), "https://miltonly.com/signin/link?t=abc&r=%2Fx", "the link shape");

  // ── the judges ───────────────────────────────────────────────────────────────
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  const stored = { verifyCode: "123456", verifyTokenHash: hashToken("tok"), verifyExpiry: future, verifyAttempts: 0 };
  eq(judgeCode(stored, "123456").ok, true, "the right code passes");
  eq(judgeCode(stored, "123457").ok, false, "a wrong code fails");
  {
    const v = judgeCode(stored, "123457");
    ok(!v.ok && v.countAttempt, "a wrong code counts an attempt");
  }
  {
    const v = judgeCode({ ...stored, verifyExpiry: past }, "123456");
    ok(!v.ok && v.reason === "expired" && !v.countAttempt, "an expired code fails without counting");
  }
  {
    const v = judgeCode({ ...stored, verifyAttempts: MAX_ATTEMPTS }, "123456");
    ok(!v.ok && v.reason === "locked" && v.status === 429, "the right code after five wrong ones is locked");
  }
  {
    const v = judgeCode({ ...stored, verifyAttempts: MAX_ATTEMPTS - 1 }, "123456");
    ok(v.ok, "the fifth try still counts");
  }
  ok(!judgeCode(null, "123456").ok, "no row fails");
  ok(!judgeCode({ ...stored, verifyCode: null }, "").ok, "a cleared secret fails an empty code");
  eq(judgeToken(stored, "tok").ok, true, "the right token passes");
  ok(!judgeToken(stored, "tok2").ok, "a wrong token fails");
  {
    const v = judgeToken({ ...stored, verifyAttempts: MAX_ATTEMPTS }, "tok");
    ok(!v.ok && v.reason === "locked", "the link shares the code's lock");
  }
  {
    const v = judgeToken({ ...stored, verifyExpiry: past }, "tok");
    ok(!v.ok && v.reason === "expired", "the link shares the code's expiry");
  }
  eq(MAX_ATTEMPTS, 5, "five attempts per code");
  {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) codes.add(generateCode());
    ok(codes.size > 150, "codes are not a constant");
  }

  // ── the redirect ─────────────────────────────────────────────────────────────
  eq(safeRedirect("/streets/pine-street-milton#sold-records"), "/streets/pine-street-milton#sold-records", "a same-origin path is honoured");
  eq(safeRedirect("//evil.example"), "/saved", "a protocol-relative URL is refused");
  eq(safeRedirect("https://evil.example/x"), "/saved", "an absolute URL is refused");
  eq(safeRedirect("/signin?redirect=/x"), "/saved", "a loop back to sign-in is refused");
  eq(safeRedirect("/api/auth/logout"), "/saved", "an API path is refused");
  eq(safeRedirect(null), "/saved", "nothing lands on the default");
  eq(safeRedirect("/\\evil.example"), "/saved", "a backslash-relative URL is refused");
  eq(normalizeEmail("  Person@Example.COM "), "person@example.com", "emails are lowercased and trimmed");
  eq(normalizeEmail("nope"), null, "a bad email is null");

  // ── the ceiling ──────────────────────────────────────────────────────────────
  ok(SESSION_MAX_DAYS <= 90, `the session ceiling is ${SESSION_MAX_DAYS} days, at most 90`);
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  ok(auth.includes("setExpirationTime(`${SESSION_MAX_DAYS}d`)"), "the JWT expiry is the ceiling");
  ok(!/refresh|sliding|extend/i.test(auth.replace(/\/\/.*$/gm, "")), "auth.ts has no sliding window");

  // ── the words ────────────────────────────────────────────────────────────────
  ok(VOW_ACKNOWLEDGEMENT_TEXT.includes("90 days"), "the VOW text states the 90-day sign-in");
  ok(VOW_ACKNOWLEDGEMENT_TEXT.includes("one-time code or link"), "the VOW text names the credential");
  ok(!/—/.test(VOW_ACKNOWLEDGEMENT_TEXT + PORTAL_CONSENT_TEXT), "no em-dash in the texts");
  ok(PORTAL_CONSENT_TEXT.includes("unsubscribe"), "the consent sentence promises an unsubscribe");
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");
  ok(terms.includes("broker of record"), "/terms notes the ruling passwordless waits on");

  // ── the wiring ───────────────────────────────────────────────────────────────
  const signup = readFileSync("src/app/api/auth/signup/route.ts", "utf8");
  ok(signup.includes("requestSignIn("), "signup route goes through requestSignIn");
  ok(!signup.includes("Math.random"), "signup route has no Math.random");
  const verify = readFileSync("src/app/api/auth/verify/route.ts", "utf8");
  ok(verify.includes("judgeCode(") && verify.includes("judgeToken("), "verify route uses both judges");
  ok(verify.includes("verifyAttempts: { increment: 1 }"), "verify route counts a wrong try");
  ok(verify.includes("verifyTokenHash: null") && verify.includes("verifyCode: null"), "verify route clears both shapes on success");
  ok(!/user\.verifyCode !== code|=== code/.test(verify), "verify route has no plain string compare");
  const door = readFileSync("src/lib/portal/door.ts", "utf8");
  ok(door.includes("timingSafeEqual"), "the compare is constant-time");
  ok(door.indexOf("checkHoneypot(") < door.indexOf("checkOrigin(") && door.indexOf("checkOrigin(") < door.indexOf("checkRateLimit)"), "guards run honeypot, origin, rate limit, in that order");
  const ack = readFileSync("src/app/api/auth/acknowledge-vow/route.ts", "utf8");
  ok(ack.includes("consentText: PORTAL_CONSENT_TEXT") && ack.includes("consentTimestamp: now"), "acknowledge route stores the consent pair");
  ok(ack.includes("residentialStreet.findUnique"), "acknowledge route checks the street against the registry");
  const prompt = readFileSync("src/components/vow/VowAcknowledgementPrompt.tsx", "utf8");
  ok(prompt.includes("/api/autocomplete?type=street"), "the card's street field is the registry autocomplete");
  ok(prompt.includes("VOW_ACKNOWLEDGEMENT_TEXT") && prompt.includes("PORTAL_CONSENT_TEXT"), "the card shows both texts");
  const island = readFileSync("src/components/street/v2/SoldRecordsIsland.tsx", "utf8");
  ok(island.includes("VowAcknowledgementPrompt"), "the street island renders the card for a signed-in, unacknowledged person");
  ok(island.includes("#sold-records") && island.includes('id="sold-records"'), "the street island's sign-in link returns to its own anchor");
  const form = readFileSync("src/app/signin/SignInForm.tsx", "utf8");
  ok(form.includes('params.get("redirect")'), "the form reads redirect");
  ok(form.includes("honeypotInputProps"), "the form renders the honeypot");
  ok(form.includes("window.location.assign(data.redirect"), "the form lands on the redirect the server returned");
  ok(!/password/i.test(form.replace(/No password/g, "")), "the form has no password field");
  const landing = readFileSync("src/app/signin/link/LinkLanding.tsx", "utf8");
  ok(landing.includes('method: "POST"'), "the link page consumes the token by POST, not by the GET a scanner makes");

  if (failures.length) {
    console.error(`[portal-door] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(`[portal-door] PASS: ${assertions} assertions. 100 honeypot signups sent 0 emails; 100 no-origin signups sent 0.`);
}

main().catch((err) => {
  console.error("[portal-door] crashed", err);
  process.exit(1);
});
