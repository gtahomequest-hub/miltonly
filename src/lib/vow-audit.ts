// The audit trail of consumer access to the VOW (MP-006, VOW Policy 19, PropTx item 28):
// "Members are required to maintain an audit trail of all Consumer access to their VOW, and
// are required to provide all such information to PropTx upon request."
//
// One row per gated read that served records or VOW-only fields: who (userId), when, what was
// viewed (kind, scope, path, how many records), from where (ip, user agent). Written by every
// VOW surface after canSeeVowRecords() said yes and before the records go out; a surface that
// answers no writes nothing, because a refusal shows the consumer nothing.
//
// It never blocks a page. The insert is awaited (a serverless function may not outlive its
// response) but a failure is logged and swallowed: an audit row lost to an outage is a defect
// to fix, a page that fails because the audit table hiccupped is a worse one.
//
// R-8.09(b)(iii), the tracking of suspicious activity, reads the same table: after each write
// the writer counts the person's distinct scopes over the last 24 hours and, past
// SUSPICIOUS_SCOPES_PER_DAY, sets reviewFlag "suspicious-access" on the row. The flag refuses
// nothing (src/lib/vow-access.ts); it puts the person in the review list that
// /api/admin/vow-access?view=suspicious and scripts/export-vow-access-log.ts print for Aamir.

import "server-only";
import { prisma } from "@/lib/prisma";

export type VowAccessKind =
  | "street-records"
  | "sold-page"
  | "sold-api"
  | "sold-stats"
  | "listing-vow"
  | "listings-grid"
  | "saved-listings"
  | "neighbourhood-records";

// recordCount, per kind: street-records, sold-api, sold-page, listings-grid and saved-listings
// count the rows served; listing-vow is 1 (one listing's facts); sold-stats is the 90-day sale
// count the figures were computed over; neighbourhood-records (VowGate, rendered nowhere in
// street v2 today) is 0 because the children fetch their own rows.
export const VOW_ACCESS_KINDS: readonly VowAccessKind[] = [
  "street-records",
  "sold-page",
  "sold-api",
  "sold-stats",
  "listing-vow",
  "listings-grid",
  "saved-listings",
  "neighbourhood-records",
];

export { SUSPICIOUS_SCOPES_PER_DAY, SUSPICIOUS_READS_PER_DAY, isSuspicious, csvCell } from "@/lib/vow-audit-rules";
import { isSuspicious, csvCell, ACCESS_CSV_HEADER } from "@/lib/vow-audit-rules";

export interface VowAccessInput {
  userId: string;
  kind: VowAccessKind;
  scope?: string | null;
  path?: string | null;
  recordCount?: number;
  ip?: string | null;
  userAgent?: string | null;
  /** the row's reviewFlag as the caller already has it; a flagged person is not re-counted */
  reviewFlag?: string | null;
}

export interface VowAccessRow {
  userId: string;
  kind: VowAccessKind;
  scope: string | null;
  path: string | null;
  recordCount: number;
  ip: string | null;
  userAgent: string | null;
}

/** The row as written, pure, so the prebuild can hold its shape: bounded strings, a count that
 *  is a non-negative integer, a kind from the list. */
export function buildAccessRow(input: VowAccessInput): VowAccessRow {
  if (!VOW_ACCESS_KINDS.includes(input.kind)) throw new Error(`unknown VOW access kind ${input.kind}`);
  const n = Number.isFinite(input.recordCount) ? Math.max(0, Math.floor(input.recordCount as number)) : 0;
  return {
    userId: input.userId,
    kind: input.kind,
    scope: input.scope ? String(input.scope).slice(0, 200) : null,
    path: input.path ? String(input.path).slice(0, 300) : null,
    recordCount: n,
    ip: input.ip ? String(input.ip).slice(0, 64) : null,
    userAgent: input.userAgent ? String(input.userAgent).slice(0, 300) : null,
  };
}

export function clientIpFromHeaders(h: { get(name: string): string | null }): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return h.get("x-real-ip");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Write one row, then run the suspicious-activity count. Never throws. */
export async function logVowAccess(input: VowAccessInput): Promise<void> {
  let row: VowAccessRow;
  try {
    row = buildAccessRow(input);
  } catch (err) {
    console.error("[vow-audit] bad row", err);
    return;
  }
  try {
    await prisma.vowAccessLog.create({ data: row });
  } catch (err) {
    console.error("[vow-audit] write failed", { kind: row.kind, scope: row.scope, err });
    return;
  }
  // A person already on the review list is not counted again on every read.
  if (input.reviewFlag) return;
  try {
    await flagIfSuspicious(row.userId);
  } catch (err) {
    console.warn("[vow-audit] suspicious-activity check failed", err);
  }
}

/** Counts the last 24 hours for one person (two aggregate queries, no rows loaded); sets the
 *  review flag once, never clears it. */
export async function flagIfSuspicious(userId: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - DAY_MS);
  const [reads, groups] = await Promise.all([
    prisma.vowAccessLog.count({ where: { userId, at: { gte: since } } }),
    prisma.vowAccessLog.groupBy({ by: ["kind", "scope"], where: { userId, at: { gte: since } } }),
  ]);
  if (!isSuspicious(groups.length, reads)) return false;
  await prisma.user.updateMany({
    where: { id: userId, reviewFlag: null },
    data: { reviewFlag: "suspicious-access", reviewFlaggedAt: now },
  });
  return true;
}

export interface SuspiciousSummary {
  userId: string;
  email: string;
  firstName: string | null;
  reviewFlag: string | null;
  reviewFlaggedAt: Date | null;
  isRegistrant: boolean | null;
  reads: number;
  scopes: number;
  firstAt: Date | null;
  lastAt: Date | null;
}

/** Every person who trips a threshold in the window, or carries a flag, for the review list. */
export async function suspiciousVowAccess(sinceDays = 1, now: Date = new Date()): Promise<SuspiciousSummary[]> {
  const since = new Date(now.getTime() - sinceDays * DAY_MS);
  const rows = await prisma.vowAccessLog.findMany({
    where: { at: { gte: since } },
    select: { userId: true, kind: true, scope: true, at: true },
    orderBy: { at: "asc" },
  });
  const byUser = new Map<string, { reads: number; scopes: Set<string>; firstAt: Date; lastAt: Date }>();
  for (const r of rows) {
    const cur = byUser.get(r.userId) ?? { reads: 0, scopes: new Set<string>(), firstAt: r.at, lastAt: r.at };
    cur.reads++;
    cur.scopes.add(`${r.kind}:${r.scope ?? ""}`);
    if (r.at > cur.lastAt) cur.lastAt = r.at;
    byUser.set(r.userId, cur);
  }
  const flagged = await prisma.user.findMany({
    where: { reviewFlag: { not: null } },
    select: { id: true },
  });
  const ids = new Set<string>(flagged.map((f) => f.id));
  byUser.forEach((v, id) => {
    if (isSuspicious(v.scopes.size, v.reads, sinceDays)) ids.add(id);
  });
  if (ids.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, email: true, firstName: true, reviewFlag: true, reviewFlaggedAt: true, isRegistrant: true },
  });
  return users.map((u) => {
    const v = byUser.get(u.id);
    return {
      userId: u.id,
      email: u.email,
      firstName: u.firstName,
      reviewFlag: u.reviewFlag,
      reviewFlaggedAt: u.reviewFlaggedAt,
      isRegistrant: u.isRegistrant,
      reads: v?.reads ?? 0,
      scopes: v?.scopes.size ?? 0,
      firstAt: v?.firstAt ?? null,
      lastAt: v?.lastAt ?? null,
    };
  });
}

/** An export window is at most a year: the trail is read for a request, not dumped whole. */
export const EXPORT_MAX_DAYS = 366;

/** The export PropTx would receive: every row in the window with the person's name and email
 *  beside it (Appendix B(b) names them as the record), oldest first. */
export async function exportVowAccess(from: Date, to: Date) {
  const cappedTo = to.getTime() - from.getTime() > EXPORT_MAX_DAYS * DAY_MS ? new Date(from.getTime() + EXPORT_MAX_DAYS * DAY_MS) : to;
  return prisma.vowAccessLog.findMany({
    where: { at: { gte: from, lt: cappedTo } },
    orderBy: { at: "asc" },
    select: {
      id: true,
      at: true,
      kind: true,
      scope: true,
      path: true,
      recordCount: true,
      ip: true,
      userAgent: true,
      user: { select: { id: true, email: true, firstName: true, isRegistrant: true, reviewFlag: true } },
    },
  });
}

export function accessCsv(rows: Awaited<ReturnType<typeof exportVowAccess>>): string {
  const esc = csvCell;
  const head = [...ACCESS_CSV_HEADER];
  const lines = rows.map((r) =>
    [r.at, r.user.id, r.user.email, r.user.firstName, r.user.isRegistrant, r.user.reviewFlag, r.kind, r.scope, r.path, r.recordCount, r.ip, r.userAgent]
      .map(esc)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}
