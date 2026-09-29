// Clearing a reviewer hold (MP-007, MLS® Rule 8.21). A PropTx or TRREB reviewer who answered
// the registrant question with the reviewer option is held (reviewFlag "reviewer-hold", no
// records) until the broker of record confirms the organization and clears the hold from the
// VOW desk (/admin/vow). Clearing turns "reviewer-hold" into "reviewer": a label that refuses
// nothing, so the account then completes the same card a consumer does and sees the same view.
//
// THE CLEAR SENDS THE LINK (MC-047, A6). TRREB's audit of homesly.ca found a cleared reviewer
// there was never sent a verification link, so the account was open and nobody told the
// reviewer. Here the clear and a fresh sign-in secret are one write, and the reviewer is emailed
// the link at the address they registered with: a link only (no code), for 24 hours, because a
// reviewer may read it hours after the desk acts; after that /signin sends a new one at once.
// The outcome says whether the email went, so the desk never reports a silent success.
//
// Server only; the desk's server action guards on the admin cookie and calls these.
// Homesly's equivalent: D:\homesly src/lib/vow/hold.ts.
import "server-only";

import { prisma } from "@/lib/prisma";
import { REVIEW_FLAG } from "@/lib/vow-access";
import { config } from "@/lib/config";
import { generateToken, hashToken, magicLink } from "@/lib/portal/door";
import { sendReviewerClearedEmail } from "@/lib/email-user";

/** What clearReviewerHold did. "cleared-unsent": the hold is cleared but the email failed. */
export type ClearHoldOutcome = "cleared" | "cleared-unsent" | "not-held" | "not-found";

/** How long the cleared reviewer's link works. */
export const CLEARED_LINK_HOURS = 24;
/** Where the link lands: the sold page, where the consumer card asks what is left. */
export const CLEARED_LINK_REDIRECT = "/sold";

/** The reads and writes clearReviewerHold needs, injectable so a test drives it without a database. */
export interface ClearHoldDeps {
  find: (userId: string) => Promise<{ email: string; reviewFlag: string | null } | null>;
  /** One write: the flag to cleared, and the sign-in secret (link only) on the row. */
  clearAndIssue: (userId: string, secret: { tokenHash: string; expiry: Date }) => Promise<void>;
  send: (args: { email: string; link: string; hours: number }) => Promise<{ sent: boolean }>;
  now: () => Date;
}

const prismaDeps: ClearHoldDeps = {
  find: (userId) => prisma.user.findUnique({ where: { id: userId }, select: { email: true, reviewFlag: true } }),
  clearAndIssue: async (userId, { tokenHash, expiry }) => {
    await prisma.user.update({
      where: { id: userId },
      data: { reviewFlag: REVIEW_FLAG.reviewerCleared, verifyCode: null, verifyTokenHash: tokenHash, verifyExpiry: expiry, verifyAttempts: 0 },
    });
  },
  send: sendReviewerClearedEmail,
  now: () => new Date(),
};

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
 * Clear one reviewer's hold: reviewFlag "reviewer-hold" to "reviewer" (the cleared label), and
 * email the reviewer a sign-in link. The declaration time (reviewFlaggedAt) is kept as the
 * record of when they declared. Only a held reviewer is touched; a plain registrant hold and a
 * suspicious-access flag are left alone. The caller must have checked the admin cookie.
 * @param userId - the reviewer's id.
 * @param deps - the database and the mailer; the real ones unless a test passes its own.
 * @returns the outcome.
 */
export async function clearReviewerHold(userId: string, deps: ClearHoldDeps = prismaDeps): Promise<ClearHoldOutcome> {
  if (!ID_RE.test(userId)) return "not-found";
  const u = await deps.find(userId);
  if (!u) return "not-found";
  if (u.reviewFlag !== REVIEW_FLAG.reviewerHeld) return "not-held";
  const token = generateToken();
  const expiry = new Date(deps.now().getTime() + CLEARED_LINK_HOURS * 60 * 60 * 1000);
  await deps.clearAndIssue(userId, { tokenHash: hashToken(token), expiry });
  const link = magicLink(config.SITE_URL, token, CLEARED_LINK_REDIRECT);
  const mail = await deps.send({ email: u.email, link, hours: CLEARED_LINK_HOURS });
  return mail.sent ? "cleared" : "cleared-unsent";
}
