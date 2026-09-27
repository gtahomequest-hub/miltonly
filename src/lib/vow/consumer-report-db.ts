// The site's side of the per-consumer report (MP-007): read the account and its trail, then
// hand the rows to the pure buildConsumerReport. Server only. The shell
// (scripts/export-vow-access-log.ts) does the same queries with its own client, so the two
// produce identical CSVs.
import "server-only";

import { prisma } from "@/lib/prisma";
import { buildConsumerReport, CONSUMER_ROW_SELECT, type ConsumerReport } from "@/lib/vow/consumer-report";

/**
 * The consumer's record and trail between `from` and `to` (both optional, `to` exclusive), or
 * null when no such consumer.
 * @param who - the email (any case) or the user id.
 * @param range - the window, either bound absent.
 * @returns the report, or null.
 */
export async function consumerReport(
  who: { email: string } | { userId: string },
  range: { from?: Date; to?: Date } = {},
): Promise<ConsumerReport | null> {
  const user = await prisma.user.findUnique({
    where: "email" in who ? { email: who.email.toLowerCase() } : { id: who.userId },
    select: CONSUMER_ROW_SELECT,
  });
  if (!user) return null;

  const win = { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) };
  const bounded = Object.keys(win).length > 0;
  const [access, consents, throttles] = await Promise.all([
    prisma.vowAccessLog.findMany({
      where: { userId: user.id, ...(bounded ? { at: win } : {}) },
      select: { at: true, kind: true, scope: true, path: true, recordCount: true, ip: true, userAgent: true },
      orderBy: { at: "asc" },
    }),
    prisma.vowConsent.findMany({
      where: { userId: user.id, ...(bounded ? { at: win } : {}) },
      select: { at: true, version: true, ip: true, userAgent: true },
      orderBy: { at: "asc" },
    }),
    prisma.vowThrottle.findMany({
      where: { userId: user.id, ...(bounded ? { at: win } : {}) },
      select: { at: true, limit: true, count: true, max: true, ip: true },
      orderBy: { at: "asc" },
    }),
  ]);

  return buildConsumerReport(user, { access, consents, throttles }, range);
}
