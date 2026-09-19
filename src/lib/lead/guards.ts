// The guards every lead submission passes: honeypot, origin, user agent, rate limit.
//
// /api/leads/create had none of them, and a plain curl against a Vercel-protected preview
// deployment wrote a row into the production table (proven 2026-09-10). The old monolith had a
// honeypot and an in-memory per-IP limiter; this is that, with a real store and an email
// dimension, in one place both paths (the lead ingress and the portal door) use.
//
// ML-005 ADDED TWO THINGS THE SALE-DETAIL BOT TAUGHT. Sixty-four rows in six days, one lead per
// Tor exit IP, a different harvested address each time, gibberish names, and one User-Agent
// on every row: a Chrome string WRAPPED IN DOUBLE QUOTES, which no browser has ever sent. The
// per-IP and per-address limits never saw it twice, so (1) the per-address limit now keys on
// a collapsed address (Gmail dots and plus-tags removed; the STORED address is never touched),
// with a daily window beside the hourly one, and (2) a User-Agent that is missing or carries a
// quote is refused the way the honeypot refuses: 200 with the success body, nothing written,
// so the script learns nothing. A real household never sends either.
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

// ── user agent ──────────────────────────────────────────────────────────────────────
// Every browser sends one, and none sends one containing a quote character: the value is a
// bare token sequence (RFC 9110 §10.1.5). A quoted string is a script that JSON-encoded its
// header, a missing one is not a browser at all. Both are refused the honeypot's way, 200 and
// nothing written, because a 4xx teaches the script what to fix. The proof scripts send
// "node" and "curl/…", which pass: the rule is about what a browser cannot send, not about
// what it usually does.
export function checkUserAgent(userAgent: string | null | undefined): GuardVerdict {
  const ua = (userAgent ?? "").trim();
  if (ua.length === 0) return { ok: false, status: 200, error: "ok", reason: "no user agent" };
  if (/["']/.test(ua)) return { ok: false, status: 200, error: "ok", reason: "quoted user agent" };
  return { ok: true };
}

// ── the per-address key ─────────────────────────────────────────────────────────────
// Gmail ignores dots in the local part and everything after a plus, so a.b.c+x@gmail.com,
// abc@gmail.com and a.bc+y@googlemail.com are one inbox, and a bot that knows it has as many
// addresses as it has dot positions. The LIMIT keys on the inbox; the row keeps the address
// as typed, because the address the person wrote is the one their consent record names and
// the one their confirmation goes to. Plus-tags collapse on every domain (the convention is
// universal); dots collapse on Gmail's domains only, where it is a fact rather than a guess.
export function emailLimitKey(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return e || null;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

// ── rate limit ──────────────────────────────────────────────────────────────────────
// Two dimensions, because they catch different abuse: one IP hammering the form, and one
// inbox being submitted from many IPs. Each has a short window for a burst and a daily one
// for a slow drip, set where a real household never lands: five forms in ten minutes and
// twelve in a day from one connection; three in an hour and six in a day for one inbox.
// Upstash when it is configured, the existing in-memory limiter when it is not, so a local
// run is still limited.
const IP_LIMIT = { tokens: 5, window: "10 m" } as const;
const IP_DAY_LIMIT = { tokens: 12, window: "24 h" } as const;
const EMAIL_LIMIT = { tokens: 3, window: "1 h" } as const;
const EMAIL_DAY_LIMIT = { tokens: 6, window: "24 h" } as const;

export const RATE_LIMITS = { ip: IP_LIMIT, ipDay: IP_DAY_LIMIT, email: EMAIL_LIMIT, emailDay: EMAIL_DAY_LIMIT } as const;
export type RateBucket = keyof typeof RATE_LIMITS;

const mk = (limit: { tokens: number; window: "10 m" | "1 h" | "24 h" }, prefix: string) =>
  redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit.tokens, limit.window), prefix }) : null;
const LIMITERS: Record<RateBucket, Ratelimit | null> = {
  ip: mk(IP_LIMIT, "lead:ip"),
  ipDay: mk(IP_DAY_LIMIT, "lead:ip:day"),
  email: mk(EMAIL_LIMIT, "lead:email"),
  emailDay: mk(EMAIL_DAY_LIMIT, "lead:email:day"),
};

/** True when the bucket refuses the key: one token taken from Upstash, or from the in-memory
 *  limiter when Upstash is not configured. The store is a parameter of checkRateLimit so the
 *  prebuild can run the same ordering, keys and reasons against a store it controls. */
export type TakeToken = (bucket: RateBucket, key: string) => Promise<boolean>;

export const liveTake: TakeToken = async (bucket, key) => {
  const limiter = LIMITERS[bucket];
  if (!limiter) return !memoryHit(`lead:${bucket}:${key}`);
  try {
    const { success } = await limiter.limit(key);
    return !success;
  } catch (err) {
    console.warn("[lead/guards] rate limit store unreachable; allowing", err);
    return false;
  }
};

export async function checkRateLimit(args: { ip: string; email?: string }, take: TakeToken = liveTake): Promise<GuardVerdict> {
  if (await take("ip", args.ip)) {
    return { ok: false, status: 429, error: "Too many requests", reason: `ip ${args.ip}` };
  }
  if (await take("ipDay", args.ip)) {
    return { ok: false, status: 429, error: "Too many requests", reason: `ip ${args.ip} (day)` };
  }
  const key = emailLimitKey(args.email);
  if (key && (await take("email", key))) {
    return { ok: false, status: 429, error: "Too many requests", reason: `email ${key}` };
  }
  if (key && (await take("emailDay", key))) {
    return { ok: false, status: 429, error: "Too many requests", reason: `email ${key} (day)` };
  }
  return { ok: true };
}
