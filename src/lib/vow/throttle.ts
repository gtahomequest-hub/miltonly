// The hard throttle on the VOW read surfaces (MP-007, MLS® Rule 8.13, VOW Best Practices items
// 25/26). MP-006's flagIfSuspicious refuses nothing by design: it queues a person for review.
// This is the ceiling above it, which does refuse. Called by every surface MP-006's trail
// covers, after the access gate says yes and before the records go out.
//
// THE LIMITS. Per consumer: 120 inquiries an hour, 600 a day. Per IP: 300 an hour, across
// consumers. An "inquiry" is a served read, i.e. a VowAccessLog row, so the counts are of the
// trail this file's callers write. "At the limit passes": the 120th read of the hour is served
// (120 rows, count 120 is not yet 120... see below) and the 121st is refused — count >= max, so
// once 120 rows are logged the next request reads 120 and is refused.
//
// OVER THE CEILING: the caller answers 429 (an API route) or drops the VOW facts (a page), no
// VowAccessLog trail row is written, and ONE VowThrottle row is written per consumer, limit and
// window — the first refusal of that window, with the count that tripped it. A caller that
// keeps hammering is refused every time but writes no row per refusal: an audit table that grew
// at the scraper's rate would be a second way to be flooded.
//
// Never throws: a count or a write that fails is logged, and a failure to WRITE the audit row
// still refuses (a log that cannot be written never opens the gate). A failure to COUNT is the
// one case that allows the read, logged, because a database hiccup must not wall every consumer.
//
// Homesly's equivalent: D:\homesly src/lib/vow/throttle.ts (it counts VowInquiry and writes
// ComplianceLog; the portal counts VowAccessLog and writes VowThrottle, its own audit table,
// because the portal's ComplianceLog is a batch-check log, not an event log).
import "server-only";
import { prisma } from "@/lib/prisma";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The ceilings, in one place. */
export const THROTTLE_LIMITS = {
  /** Inquiries by one consumer in one hour. */
  consumerHour: 120,
  /** Inquiries by one consumer in one day. */
  consumerDay: 600,
  /** Inquiries from one IP in one hour, across consumers. */
  ipHour: 300,
} as const;

export type ThrottleLimit = keyof typeof THROTTLE_LIMITS;

/** The window each limit is judged over. */
const WINDOW_MS: Record<ThrottleLimit, number> = { consumerHour: HOUR_MS, consumerDay: DAY_MS, ipHour: HOUR_MS };

/** Go on, or stop with the limit that stopped it and the count that tripped it. */
export type ThrottleVerdict = { ok: true } | { ok: false; limit: ThrottleLimit; count: number; max: number };

/** One consumer's and IP's counts over the throttle windows. */
export interface ThrottleCounts {
  consumerHour: number;
  consumerDay: number;
  ipHour: number;
}

/**
 * Which ceiling a set of counts is at or over, or null. Pure, so the prebuild can hold it. The
 * order is consumer-hour, consumer-day, then IP-hour: a per-consumer refusal is named before a
 * shared-IP one.
 * @param c - the counts.
 * @returns the tripped limit and its count, or null.
 */
export function overLimit(c: ThrottleCounts): { limit: ThrottleLimit; count: number; max: number } | null {
  const order: ThrottleLimit[] = ["consumerHour", "consumerDay", "ipHour"];
  for (const limit of order) {
    if (c[limit] >= THROTTLE_LIMITS[limit]) return { limit, count: c[limit], max: THROTTLE_LIMITS[limit] };
  }
  return null;
}

/**
 * Count, compare, and on a refusal record it. Called before any VOW read is served.
 * @param who - the caller.
 * @param who.userId - the consumer.
 * @param who.ip - the request IP, or null when none could be read (the IP limit is then skipped).
 * @param now - the moment.
 * @returns the verdict; { ok: true } when a count fails (fail open on a DB hiccup, logged).
 */
export async function enforceVowThrottle(who: { userId: string; ip: string | null }, now: Date = new Date()): Promise<ThrottleVerdict> {
  const since = (limit: ThrottleLimit) => new Date(now.getTime() - WINDOW_MS[limit]);
  let counts: ThrottleCounts;
  try {
    const [hour, day, ip] = await Promise.all([
      prisma.vowAccessLog.count({ where: { userId: who.userId, at: { gte: since("consumerHour") } } }),
      prisma.vowAccessLog.count({ where: { userId: who.userId, at: { gte: since("consumerDay") } } }),
      who.ip ? prisma.vowAccessLog.count({ where: { ip: who.ip, at: { gte: since("ipHour") } } }) : Promise.resolve(0),
    ]);
    counts = { consumerHour: hour, consumerDay: day, ipHour: ip };
  } catch (err) {
    // A count that cannot be read must not wall every consumer; the read goes through, logged.
    console.error("[vow-throttle] count failed, allowing", err);
    return { ok: true };
  }

  const over = overLimit(counts);
  if (!over) return { ok: true };

  // One row per consumer/limit/window: skip when one is already there.
  try {
    const existing = await prisma.vowThrottle.findFirst({
      where: { userId: who.userId, limit: over.limit, at: { gte: since(over.limit) } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.vowThrottle.create({
        data: { userId: who.userId, limit: over.limit, count: over.count, max: over.max, ip: who.ip ?? null },
      });
    }
  } catch (err) {
    // The refusal stands without its row.
    console.error("[vow-throttle] audit row not recorded", err);
  }

  return { ok: false, limit: over.limit, count: over.count, max: over.max };
}
