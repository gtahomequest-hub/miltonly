// The three guards every lead submission passes: honeypot, origin, rate limit.
//
// /api/leads/create had none of them, and a plain curl against a Vercel-protected preview
// deployment wrote a row into the production table (proven 2026-09-10). /api/leads has a
// honeypot and an in-memory per-IP limiter; this is that, with a real store and an email
// dimension, in one place both paths can use.
//
// Nothing here throws. A guard that cannot reach Redis allows the request and says so: a
// lead lost to an infrastructure wobble is worse than a duplicate.

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/cache";
import { config } from "@/lib/config";
import { hit as memoryHit } from "@/lib/rateLimit";
import { HONEYPOT_FIELD } from "@/lib/lead/honeypot";

// Field name the forms render, hidden, and leave empty. A filled value means a bot.
export { HONEYPOT_FIELD };

export type GuardVerdict =
  | { ok: true }
  | { ok: false; status: number; error: string; reason: string };

// ── honeypot ────────────────────────────────────────────────────────────────────────
// Answers 200 with a plausible body rather than 400. A bot that learns which field
// betrayed it simply stops sending that field; one that believes it succeeded does not.
export function checkHoneypot(body: Record<string, unknown>): GuardVerdict {
  const v = body[HONEYPOT_FIELD];
  if (typeof v === "string" && v.trim().length > 0) {
    return { ok: false, status: 200, error: "ok", reason: "honeypot" };
  }
  return { ok: true };
}

// ── origin ──────────────────────────────────────────────────────────────────────────
// A submission must come from a page we serve. Same-origin fetches always carry Origin;
// the header is absent only on non-browser callers, which is exactly what this excludes.
const ALLOWED_HOST_SUFFIXES = [
  config.SITE_DOMAIN,          // miltonly.com
  `.${config.SITE_DOMAIN}`,    // www.miltonly.com
  ".vercel.app",               // preview and production deployment URLs
];

export function hostAllowed(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  return ALLOWED_HOST_SUFFIXES.some((s) => (s.startsWith(".") ? h.endsWith(s) : h === s));
}

export function checkOrigin(originHeader: string | null, refererHeader: string | null): GuardVerdict {
  const raw = originHeader || refererHeader;
  if (!raw) {
    return { ok: false, status: 403, error: "forbidden", reason: "no origin or referer" };
  }
  let host: string;
  try {
    host = new URL(raw).host;
  } catch {
    return { ok: false, status: 403, error: "forbidden", reason: `unparseable origin ${raw}` };
  }
  if (!hostAllowed(host)) {
    return { ok: false, status: 403, error: "forbidden", reason: `host not allowed: ${host}` };
  }
  return { ok: true };
}

// ── rate limit ──────────────────────────────────────────────────────────────────────
// Two dimensions, because they catch different abuse: one IP hammering the form, and one
// address being submitted from many IPs. Upstash when it is configured, the existing
// in-memory limiter when it is not, so a local run is still limited.
const IP_LIMIT = { tokens: 5, window: "10 m" } as const;
const EMAIL_LIMIT = { tokens: 3, window: "1 h" } as const;

const ipLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(IP_LIMIT.tokens, IP_LIMIT.window), prefix: "lead:ip" })
  : null;
const emailLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(EMAIL_LIMIT.tokens, EMAIL_LIMIT.window), prefix: "lead:email" })
  : null;

async function limited(limiter: Ratelimit | null, key: string, memoryKey: string): Promise<boolean> {
  if (!limiter) return !memoryHit(memoryKey);
  try {
    const { success } = await limiter.limit(key);
    return !success;
  } catch (err) {
    console.warn("[lead/guards] rate limit store unreachable; allowing", err);
    return false;
  }
}

export async function checkRateLimit(args: { ip: string; email?: string }): Promise<GuardVerdict> {
  if (await limited(ipLimiter, args.ip, `lead:ip:${args.ip}`)) {
    return { ok: false, status: 429, error: "Too many requests", reason: `ip ${args.ip}` };
  }
  const email = (args.email ?? "").trim().toLowerCase();
  if (email && (await limited(emailLimiter, email, `lead:email:${email}`))) {
    return { ok: false, status: 429, error: "Too many requests", reason: `email ${email}` };
  }
  return { ok: true };
}

export const RATE_LIMITS = { ip: IP_LIMIT, email: EMAIL_LIMIT };
