// src/lib/adminAuth.ts
// Admin-cookie signing (organic loop piece 4, step 1 - the flagged
// hardening). The old cookie value was a static unsigned "1", forgeable
// without the password. Now: value = "<issuedAtMs>.<hmac>", where the HMAC
// key is DERIVED from ADMIN_PASSWORD + a fixed salt (chosen over a new
// ADMIN_COOKIE_SECRET env: zero new ops surface across prod/preview/local,
// and rotating the password rotates every session). Verification enforces
// the signature AND the same 24h expiry the cookie already carried; the
// legacy "1" value fails verification everywhere by construction.
import { createHmac, timingSafeEqual } from "node:crypto";

const SALT = "miltonly-admin-cookie-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // mirrors the cookie's 24h maxAge

function key(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", SALT).update(pw).digest("hex");
}

function sign(payload: string): string | null {
  const k = key();
  if (!k) return null;
  return createHmac("sha256", k).update(payload).digest("hex");
}

/** Cookie value for a fresh login: "<issuedAtMs>.<hmac(issuedAtMs)>". */
export function makeAdminCookieValue(): string | null {
  const issuedAt = String(Date.now());
  const sig = sign(issuedAt);
  return sig ? `${issuedAt}.${sig}` : null;
}

/** True only for an authentic, unexpired signed value. Rejects legacy "1". */
export function verifyAdminCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false; // covers the legacy "1" and malformed values
  const issuedAtStr = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > MAX_AGE_MS || issuedAt > Date.now() + 60_000) return false;
  const expected = sign(issuedAtStr);
  if (!expected || expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
