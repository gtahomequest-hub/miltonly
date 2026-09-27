// Clearing a reviewer hold (MP-007, MLS® Rule 8.21). A PropTx or TRREB reviewer who answered
// the registrant question with the reviewer option is held (reviewFlag "reviewer-hold", no
// records) until the broker of record confirms the organization and clears the hold from the
// VOW desk (/admin/vow). Clearing turns "reviewer-hold" into "reviewer": a label that refuses
// nothing, so the account then completes the same card a consumer does and sees the same view.
//
// Server only; the desk's server action guards on the admin cookie and calls these.
// Homesly's equivalent: D:\homesly src/lib/vow/hold.ts.
import "server-only";

import { prisma } from "@/lib/prisma";
import { REVIEW_FLAG } from "@/lib/vow-access";

/** What clearReviewerHold did. */
export type ClearHoldOutcome = "cleared" | "not-held" | "not-found";

/** A held reviewer, for the desk list. */
export interface HeldReviewer {
  id: string;
  email: string;
  firstName: string | null;
  reviewFlaggedAt: Date | null;
  createdAt: Date;
}

/**
 * The reviewers held for review, newest first. Never a listing, a place or a price: only who
 * and when.
 * @returns the held reviewers.
 */
export async function listHeldReviewers(): Promise<HeldReviewer[]> {
  return prisma.user.findMany({
    where: { reviewFlag: REVIEW_FLAG.reviewerHeld },
    orderBy: { reviewFlaggedAt: "desc" },
    select: { id: true, email: true, firstName: true, reviewFlaggedAt: true, createdAt: true },
    take: 200,
  });
}

const ID_RE = /^[a-z0-9]{20,40}$/i;

/**
 * Clear one reviewer's hold: reviewFlag "reviewer-hold" to "reviewer" (the cleared label).
 * The declaration time (reviewFlaggedAt) is kept as the record of when they declared. Only a
 * held reviewer is touched; a plain registrant hold and a suspicious-access flag are left
 * alone. The caller must have checked the admin cookie.
 * @param userId - the reviewer's id.
 * @returns the outcome.
 */
export async function clearReviewerHold(userId: string): Promise<ClearHoldOutcome> {
  if (!ID_RE.test(userId)) return "not-found";
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { reviewFlag: true } });
  if (!u) return "not-found";
  if (u.reviewFlag !== REVIEW_FLAG.reviewerHeld) return "not-held";
  await prisma.user.update({ where: { id: userId }, data: { reviewFlag: REVIEW_FLAG.reviewerCleared } });
  return "cleared";
}
