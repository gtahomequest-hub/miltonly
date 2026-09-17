// The door: everything that decides whether a sign-in request becomes an email, and whether
// a code or a link becomes a session (MP-002).
//
// WHY THIS IS A LIBRARY AND NOT TWO ROUTE FILES. MP-001 found /api/auth/signup with no
// honeypot, no rate limit and no origin check, sending a Resend email on every hit; a bot had
// put 162 rows in User and taken 162 emails, and nobody real had ever verified. The guards are
// the lead layer's (src/lib/lead/guards.ts), unchanged, so a sign-in and a form submission are
// held to the same rule. The route calls requestSignIn(); the prebuild test calls it with the
// database and the sender replaced by counters, runs a hundred bot signups through it, and
// fails the build if a single one reaches the sender.
//
// ORDER OF THE GUARDS MATTERS. Honeypot first, because it costs nothing and answers 200 so the
// bot learns nothing. Origin second, because a non-browser caller never gets as far as the
// store. Rate limit last, because it is the only guard that spends anything (an Upstash token),
// and a request refused by the first two must not spend it.
//
// ONE SECRET, TWO SHAPES. The email carries a 6-digit code (typed on the phone that has the
// page open) and a link (tapped on the phone that has the inbox open). They expire together,
// share one attempt counter, and either one consumes both. The code is compared in constant
// time and dies after five wrong tries: six digits with no counter is a million guesses in
// fifteen minutes, and a bot has fifteen minutes.
//
// PASSWORDLESS STANDS PENDING THE BROKER OF RECORD'S RULING. The TRREB VOW Policy words are
// "username and a password"; MP-001's reading is that the emailed one-time secret is that
// credential and the address is the username. The reading is written into the VOW terms the
// person agrees to (src/lib/vow-acknowledgement.ts) and the session never outlives the policy's
// 90-day validity (SESSION_MAX_DAYS in src/lib/auth.ts).

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { checkHoneypot, checkOrigin, checkRateLimit, hostAllowed, type GuardVerdict } from "@/lib/lead/guards";
import { config } from "@/lib/config";

export const CODE_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
export const DEFAULT_LANDING = "/saved";

export { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── the redirect ────────────────────────────────────────────────────────────────────
// A sign-in link and the form both carry where the person started. It is honoured only as a
// same-origin path: "/streets/pine-street-milton#sold-records" yes, "//evil.example" no,
// "https://..." no. Anything else lands on the default.
export function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_LANDING;
  const r = raw.trim();
  if (!r.startsWith("/") || r.startsWith("//") || r.startsWith("/\\")) return DEFAULT_LANDING;
  if (/[\r\n]/.test(r) || r.length > 300) return DEFAULT_LANDING;
  if (r.startsWith("/signin") || r.startsWith("/api/")) return DEFAULT_LANDING;
  return r;
}

// ── the secret ──────────────────────────────────────────────────────────────────────
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function codesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 254) return null;
  return e;
}

/** The origin the link in the email points at: the host that served the form when it is one
 *  we own (so a preview's link opens the preview), the site otherwise. */
export function linkOrigin(host: string | null, proto: string | null): string {
  if (host && hostAllowed(host)) {
    const scheme = host.startsWith("localhost") || host.startsWith("127.") ? "http" : proto || "https";
    return `${scheme}://${host}`;
  }
  return config.SITE_URL;
}

export function magicLink(origin: string, token: string, redirect: string): string {
  return `${origin}/signin/link?t=${encodeURIComponent(token)}&r=${encodeURIComponent(redirect)}`;
}

// ── requestSignIn ───────────────────────────────────────────────────────────────────
export interface SignInRequest {
  body: Record<string, unknown>;
  ip: string;
  origin: string | null;
  referer: string | null;
  host: string | null;
  proto: string | null;
}

export interface IssuedSecret {
  email: string;
  code: string;
  tokenHash: string;
  expiry: Date;
}

export interface SignInDeps {
  /** Writes the code, the token hash and the expiry on the User row (upsert). */
  persist: (secret: IssuedSecret) => Promise<void>;
  /** Sends the email. */
  send: (args: { email: string; code: string; link: string; minutes: number }) => Promise<void>;
  rateLimit?: (args: { ip: string; email?: string }) => Promise<GuardVerdict>;
}

export type SignInResult =
  | { ok: true; status: 200; body: { success: true; message: string }; sent: boolean; reason?: string }
  | { ok: false; status: number; body: { error: string }; reason: string };

/** The one message a caller ever sees on success. The same words whether the address is new,
 *  known, or trapped by the honeypot: the form must not be an oracle for who has an account. */
const SENT_MESSAGE = `Check your email. Tap the link, or type the code. It works for ${CODE_MINUTES} minutes.`;

export async function requestSignIn(req: SignInRequest, deps: SignInDeps): Promise<SignInResult> {
  const trapped = checkHoneypot(req.body);
  if (!trapped.ok) {
    // 200 with the success body. Nothing persisted, nothing sent.
    return { ok: true, status: 200, body: { success: true, message: SENT_MESSAGE }, sent: false, reason: trapped.reason };
  }

  const origin = checkOrigin(req.origin, req.referer);
  if (!origin.ok) {
    return { ok: false, status: origin.status, body: { error: origin.error }, reason: origin.reason };
  }

  const email = normalizeEmail(req.body.email);
  if (!email) {
    return { ok: false, status: 400, body: { error: "Enter a valid email address." }, reason: "bad email" };
  }

  const limit = await (deps.rateLimit ?? checkRateLimit)({ ip: req.ip, email });
  if (!limit.ok) {
    return { ok: false, status: limit.status, body: { error: limit.error }, reason: limit.reason };
  }

  const code = generateCode();
  const token = generateToken();
  const expiry = new Date(Date.now() + CODE_MINUTES * 60 * 1000);
  await deps.persist({ email, code, tokenHash: hashToken(token), expiry });

  const redirect = safeRedirect(typeof req.body.redirect === "string" ? req.body.redirect : null);
  const link = magicLink(linkOrigin(req.host, req.proto), token, redirect);
  await deps.send({ email, code, link, minutes: CODE_MINUTES });

  return { ok: true, status: 200, body: { success: true, message: SENT_MESSAGE }, sent: true };
}

// ── verifying ───────────────────────────────────────────────────────────────────────
export interface StoredSecret {
  verifyCode: string | null;
  verifyTokenHash: string | null;
  verifyExpiry: Date | null;
  verifyAttempts: number;
}

export type VerifyVerdict =
  | { ok: true }
  | { ok: false; status: number; error: string; reason: "expired" | "locked" | "wrong" | "none"; countAttempt: boolean };

/** Decides a typed code against the stored secret. Pure: the caller bumps the counter when
 *  `countAttempt` is true and clears the secret on success. */
export function judgeCode(stored: StoredSecret | null, code: string, now = new Date()): VerifyVerdict {
  if (!stored || !stored.verifyCode) {
    return { ok: false, status: 400, error: "That code is not valid. Request a new one.", reason: "none", countAttempt: false };
  }
  if (!stored.verifyExpiry || stored.verifyExpiry < now) {
    return { ok: false, status: 400, error: "That code has expired. Request a new one.", reason: "expired", countAttempt: false };
  }
  if (stored.verifyAttempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: "Too many tries. Request a new code.", reason: "locked", countAttempt: false };
  }
  if (!codesMatch(stored.verifyCode, code)) {
    return { ok: false, status: 400, error: "That code is not right.", reason: "wrong", countAttempt: true };
  }
  return { ok: true };
}

/** Decides a magic-link token. The lookup is by hash, so a token that finds no row is simply
 *  unknown; the expiry and the lock still apply because the link and the code are one secret. */
export function judgeToken(stored: StoredSecret | null, token: string, now = new Date()): VerifyVerdict {
  if (!stored || !stored.verifyTokenHash) {
    return { ok: false, status: 400, error: "That link is not valid. Request a new one.", reason: "none", countAttempt: false };
  }
  if (!stored.verifyExpiry || stored.verifyExpiry < now) {
    return { ok: false, status: 400, error: "That link has expired. Request a new one.", reason: "expired", countAttempt: false };
  }
  if (stored.verifyAttempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: "Too many tries. Request a new link.", reason: "locked", countAttempt: false };
  }
  if (!codesMatch(stored.verifyTokenHash, hashToken(token))) {
    return { ok: false, status: 400, error: "That link is not valid. Request a new one.", reason: "wrong", countAttempt: true };
  }
  return { ok: true };
}
