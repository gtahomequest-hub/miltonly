// Consumer erasure that anonymises rather than cascade-deletes (MP-007, from MC-044's review).
//
// THE DEFECT MC-044 FOUND. A consumer's removal request was promised "at once", but VowConsent
// and VowAccessLog cascade on a User delete (onDelete: Cascade). A naive delete inside the
// 180-day window erases the very trail PropTx can demand (Appendix B(b), Rule 8.06 / 8.08).
//
// THE RESOLUTION. Two conflicting duties: PIPEDA's withdrawal-of-consent (item 34) and the MLS
// rule's "maintain a record of the name, email address, username, and current password ... for
// not less than 180 days after the expiration of the validity of the password" (Appendix B(b)).
// The rule wins inside the window, and PIPEDA permits retention required by law. So an erasure
// request:
//   - STRIPS the personal data the rule does NOT require the Member to keep: the phone, the
//     saved listings and searches, the lead link, the home street, and the marketing-consent
//     record. Sign-in is blocked (verified -> false). This is the anonymisation.
//   - KEEPS the four the rule names (name, email, username=email, and the password RECORD, a
//     bcrypt hash, never plaintext), the consent history and the access trail, until 180 days
//     past the password's expiry, because the rule requires them and PropTx can ask for them.
//   - is then PURGED in full once that window passes (purge cascades the trail, now allowed).
// /privacy states this plainly, and the desk runs it with scripts/vow-erasure.ts.
//
// PURE: no Prisma here. `anonymiseUpdate(now)` is the Prisma `data` the script applies (and the
// prebuild asserts), and `isPurgeable()` is the retention gate. The script deletes the row's
// SavedSearch rows and, for a purge, the User row itself.

import { credentialRetainUntil } from "@/lib/portal/passwordRule";

/** The columns an erasure request nulls on the User row, and the two it sets. Everything not
 *  listed is kept, on purpose: the name, email, passwordHash, passwordSetAt, the vowAck* record,
 *  and (by leaving the rows in place) the VowConsent and VowAccessLog trail. `verified: false`
 *  blocks both sign-in paths; `erasureRequestedAt` records when the request was honoured. */
export function anonymiseUpdate(now: Date = new Date()): Record<string, unknown> {
  return {
    // Block sign-in. getSession() and /api/auth/login both refuse an unverified row.
    verified: false,
    erasureRequestedAt: now,
    // The non-mandated personal data, removed.
    phone: null,
    savedListings: [],
    leadId: null,
    homeStreetSlug: null,
    consentText: null,
    consentTimestamp: null,
    // Any live sign-in secret, cleared so no link or code can revive the account.
    verifyCode: null,
    verifyTokenHash: null,
    verifyExpiry: null,
    verifyAttempts: 0,
  };
}

/** The fields an erasure KEEPS, named so the prebuild can assert none of them is in the update. */
export const ERASURE_KEEPS = [
  "email",
  "firstName",
  "passwordHash",
  "passwordSetAt",
  "vowAcknowledgedAt",
  "vowAcknowledgementText",
  "vowAcknowledgementVersion",
] as const;

/**
 * Whether a credentialed row may be hard-deleted now: it has a password and the 180-day
 * retention past its expiry has passed. A row with no password is not this path's concern
 * (scripts/purge-bot-users.ts handles unverified rows and refuses any with a password).
 * @param row - passwordHash and passwordSetAt.
 * @param now - the moment.
 * @returns true when the row is past retention and may be purged.
 */
export function isPurgeable(row: { passwordHash: string | null; passwordSetAt: Date | null }, now: Date = new Date()): boolean {
  if (!row.passwordHash) return false;
  const until = credentialRetainUntil(row.passwordSetAt);
  // No set date on a credentialed row: fail closed, keep it (never purge a record we cannot date).
  if (!until) return false;
  return until.getTime() <= now.getTime();
}
