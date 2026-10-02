// THE ONE DOOR (MC-046 Stage 1). Every read of VOW data goes through this module.
//
// VOW data is the PropTx sold and leased record set (DB2, schema `sold`), every aggregate computed
// from it (DB3, schema `analytics`), and the non-public rows and VOW-only columns of `Listing`.
// PropTx VOW Best Practices item 40 allows it for brokerage services only; TRREB's reading, which
// we apply, is that none of it reaches a visitor who has not registered.
//
// So the connection to DB2 and DB3 lives HERE and nowhere else, and it is handed out only against
// a VowAccess. A VowAccess cannot be constructed outside this file (its brand is a module-private
// symbol), and there are exactly three ways to obtain one:
//
//   vowReaderAccess(user)     a signed-in consumer who passes canSeeVowRecords (verified, terms
//                             current, password set and in date, not a registrant, not held).
//   vowSystemAccess(request)  a Vercel cron: `Authorization: Bearer <CRON_SECRET>`, compared in
//                             constant time. Never a `?secret=` query parameter (MC-046 R16).
//   vowScriptAccess()         an offline script under scripts/, refused inside a Next runtime.
//
// An anonymous render holds none of the three, so it cannot open DB2 or DB3 even by accident.
// Deep compute chains take the access from a scope (withVowAccess) instead of a parameter; the
// scope can only be entered with a genuine access, so the guarantee is the same.
// scripts/test-vow-door.ts fails the build if any other file names the connection strings,
// imports the Neon driver for them, issues vowSystemAccess outside a cron route, issues
// vowScriptAccess anywhere under src/, or reads a non-public Listing status or a VOW column
// outside the allowlisted files.

import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { canSeeVowRecords, type VowAccessFields } from "@/lib/vow-access";
import { DB_CACHE_TAG } from "./cacheTags";

export type Sql = NeonQueryFunction<false, false>;

const BRAND: unique symbol = Symbol("miltonly.vow.access");

export type VowPrincipal = "reader" | "system" | "script";

export interface VowAccess {
  readonly [BRAND]: true;
  readonly principal: VowPrincipal;
  /** The reader's user id, for the access log; absent for system and script principals. */
  readonly userId?: string;
}

// Every access this module issued, and only those. The brand alone could be copied off one
// access onto a forged object (Object.getOwnPropertySymbols); membership here cannot.
const ISSUED = new WeakSet<object>();

function issue(principal: VowPrincipal, userId?: string): VowAccess {
  const access = Object.freeze({ [BRAND]: true as const, principal, ...(userId ? { userId } : {}) });
  ISSUED.add(access);
  return access;
}

function assertAccess(access: VowAccess | null | undefined): asserts access is VowAccess {
  if (!access || typeof access !== "object" || !ISSUED.has(access)) {
    throw new Error("VOW door: refused, no VowAccess (sign-in, cron header or script required)");
  }
}

// ── the three ways in ──────────────────────────────────────────────────────────────────────

/** A consumer who may see VOW records, or null. Pass the session user the route already read. */
export function vowReaderAccess(user: (VowAccessFields & { id?: string }) | null | undefined): VowAccess | null {
  return canSeeVowRecords(user) ? issue("reader", user?.id) : null;
}

/** A Vercel cron, by the Authorization header only. Anything else is null. */
export function vowSystemAccess(request: Request): VowAccess | null {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");
  if (!secret || !header) return null;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  return issue("system");
}

/** An offline script. Refused inside a Next server (NEXT_RUNTIME, set by Next on every server
 *  runtime) and inside a Next build (NEXT_PHASE), so no page, route or prerender can use it.
 *  VERCEL is not the test: `vercel env pull` writes VERCEL="1" into .env.local. */
export function vowScriptAccess(): VowAccess {
  if (process.env.NEXT_RUNTIME || process.env.NEXT_PHASE) {
    throw new Error("VOW door: vowScriptAccess is for offline scripts only");
  }
  return issue("script");
}

// ── the connections, handed out against an access ───────────────────────────────────────────

// Neon reads carry an hour and a tag, so a sync or a compute can drop what it changed
// (MC-010, MC-017). Only this module knows the tags' sources; revalidateTag("db2"/"db3") stays
// wherever a writer already calls it.
export { DB_CACHE_TAG };
type DbKey = keyof typeof DB_CACHE_TAG;

const clients: Partial<Record<DbKey, Sql | null>> = {};
function client(envKey: DbKey): Sql | null {
  if (!(envKey in clients)) {
    const url = process.env[envKey];
    if (!url && process.env.NODE_ENV !== "production") console.warn(`[vow-door] ${envKey} is not set; client disabled`);
    clients[envKey] = url
      ? neon(url, { fetchOptions: { next: { revalidate: 3600, tags: [DB_CACHE_TAG[envKey]] } } })
      : null;
  }
  return clients[envKey] ?? null;
}

/** DB2, the sold schema, or null when unconfigured. Always qualify: `sold.sold_records`. */
export function soldDb(access: VowAccess): Sql | null {
  assertAccess(access);
  return client("SOLD_DATABASE_URL");
}

/** DB3, the analytics schema, or null when unconfigured. Always qualify: `analytics.street_sold_stats`. */
export function analyticsDb(access: VowAccess): Sql | null {
  assertAccess(access);
  return client("ANALYTICS_DATABASE_URL");
}

export function requireSoldDb(access: VowAccess): Sql {
  const db = soldDb(access);
  if (!db) throw new Error("SOLD_DATABASE_URL is not configured");
  return db;
}

export function requireAnalyticsDb(access: VowAccess): Sql {
  const db = analyticsDb(access);
  if (!db) throw new Error("ANALYTICS_DATABASE_URL is not configured");
  return db;
}

/** For a function handed an access it must forward: throws unless the access is genuine. */
export function requireVowAccess(access: VowAccess | null | undefined): VowAccess {
  assertAccess(access);
  return access;
}

// ── the scoped form, for deep compute chains ─────────────────────────────────────────────────
// The generators and the nightly computes reach DB2 from a dozen helpers several calls below
// the route. Rather than thread a parameter through every one, the route (or script) enters a
// scope with the access it obtained, and the helpers ask the scope. Outside a scope the helpers
// throw: an anonymous render never enters one, because it cannot obtain an access to enter with.

const scope = new AsyncLocalStorage<VowAccess>();

/** Run `fn` with `access` in scope. The access must be genuine. */
export function withVowAccess<T>(access: VowAccess, fn: () => T): T {
  assertAccess(access);
  return scope.run(access, fn);
}

/** OFFLINE SCRIPTS ONLY: enter the scope with a script access for the rest of this process's
 *  execution (AsyncLocalStorage.enterWith), so a script's calls into the scoped computes and
 *  generators need no wrapping. Refused inside Next exactly as vowScriptAccess is, and
 *  scripts/test-vow-door.ts fails any use under src/. */
export function enterVowScriptScope(): VowAccess {
  const access = vowScriptAccess();
  scope.enterWith(access);
  return access;
}

/** The access of the enclosing withVowAccess scope; throws outside one. */
export function scopedVowAccess(): VowAccess {
  const access = scope.getStore();
  assertAccess(access);
  return access;
}
