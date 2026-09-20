// The password (MP-002b). TRREB R-805(c) requires a username and a password per consumer;
// the ruling landed after MP-002 shipped passwordless, so the password is added to the same
// account rather than replacing the door: the emailed link or code still verifies the email
// (first sign-in, and the fallback for a forgotten password), the card then asks the consumer
// to set a password, and no VOW record is served until one exists (src/lib/vow-access.ts).
//
// THE RULE: twelve characters or more, not the email address, not the part before the @, and
// not containing the address. Nothing else: no forced symbols, no rotation, no reuse list.
// Length is what makes a password hard to guess, and the lock on the emailed code already
// bounds a sign-in attempt. bcrypt at cost 12 (about 250 ms here), so a leaked hash is slow to
// crack and a login is not.
//
// THE USERNAME IS THE EMAIL. User.email is unique, lowercased and trimmed by normalizeEmail(),
// so one address is exactly one username and there is nothing separate to choose or forget.

import bcrypt from "bcryptjs";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/cache";
import { hit as memoryHit } from "@/lib/rateLimit";
import type { GuardVerdict } from "@/lib/lead/guards";

export { MIN_PASSWORD_LENGTH } from "@/lib/portal/passwordRule";
import { MIN_PASSWORD_LENGTH } from "@/lib/portal/passwordRule";
export const MAX_PASSWORD_LENGTH = 200;
export const BCRYPT_COST = 12;

export type PasswordVerdict = { ok: true } | { ok: false; error: string; reason: "short" | "long" | "email" | "type" };

export function judgePassword(password: unknown, email: string): PasswordVerdict {
  if (typeof password !== "string") {
    return { ok: false, error: "Choose a password.", reason: "type" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`, reason: "short" };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at most ${MAX_PASSWORD_LENGTH} characters.`, reason: "long" };
  }
  const p = password.toLowerCase();
  const e = email.trim().toLowerCase();
  const local = e.split("@")[0] ?? "";
  if (p === e || p === local || (e && p.includes(e))) {
    return { ok: false, error: "Your password cannot be your email address.", reason: "email" };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// A hash of nothing in particular, compared against when the address has no row or no
// password, so a login attempt costs the same time either way and the response cannot say
// which address has an account. Made once per instance, on first use.
let dummyHash: string | null = null;
function dummy(): string {
  if (!dummyHash) dummyHash = bcrypt.hashSync(`not-a-password-${Date.now()}`, BCRYPT_COST);
  return dummyHash;
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash || dummy());
  return !!hash && ok;
}

// ── the login rate limit ──────────────────────────────────────────────────────────────
// Its own buckets, not the lead layer's: a password can be mistyped a few times without
// spending the tokens a form or a sign-in email needs. Ten per IP per ten minutes, ten per
// address per fifteen; Upstash when it is configured, the in-memory limiter when not.
const LOGIN_IP = { tokens: 10, window: "10 m" } as const;
const LOGIN_EMAIL = { tokens: 10, window: "15 m" } as const;

const ipLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LOGIN_IP.tokens, LOGIN_IP.window), prefix: "auth:login:ip" })
  : null;
const emailLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LOGIN_EMAIL.tokens, LOGIN_EMAIL.window), prefix: "auth:login:email" })
  : null;

async function limited(limiter: Ratelimit | null, key: string, memoryKey: string): Promise<boolean> {
  if (!limiter) return !memoryHit(memoryKey);
  try {
    const { success } = await limiter.limit(key);
    return !success;
  } catch (err) {
    console.warn("[portal/password] rate limit store unreachable; allowing", err);
    return false;
  }
}

export async function checkLoginRateLimit(args: { ip: string; email: string }): Promise<GuardVerdict> {
  if (await limited(ipLimiter, args.ip, `auth:login:ip:${args.ip}`)) {
    return { ok: false, status: 429, error: "Too many tries. Wait a few minutes, or email yourself a link.", reason: `ip ${args.ip}` };
  }
  if (await limited(emailLimiter, args.email, `auth:login:email:${args.email}`)) {
    return { ok: false, status: 429, error: "Too many tries. Wait a few minutes, or email yourself a link.", reason: `email ${args.email}` };
  }
  return { ok: true };
}

export const LOGIN_LIMITS = { ip: LOGIN_IP, email: LOGIN_EMAIL };
