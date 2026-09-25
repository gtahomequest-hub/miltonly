// The one rule for whether a session may be shown a VOW record (MP-002b, extended by MP-006).
//
// Six things, all on the User row:
//   1. the email is verified (getSession() already returns null otherwise);
//   2. the bona-fide-interest terms are agreed, at the CURRENT version (a row that agreed to an
//      older text owes a fresh agreement; Appendix B(c), the nine clauses landed in version 4);
//   3. a password is set (R-805(c): a username and a password per consumer);
//   4. the password is younger than 90 days (R-8.06; past that the card takes a renewal);
//   5. the person has answered the registrant question (R-8.09(b)(i)) and the answer is no;
//   6. no "registrant" review flag stands (set by the person's own answer, or by Aamir by hand,
//      and cleared only by a person). A "suspicious-access" flag does NOT refuse: it is a queue
//      for Aamir, never an automatic wall (the task's rule: nothing refuses a real person
//      without review).
// A password with no passwordSetAt is treated as expired, not as eternal: every field here
// fails closed when it is missing.
// Every VOW surface (the fetchers in sold-data.ts, the record routes, VowGate, /sold,
// NeighbourhoodSoldBlock, the listing VOW route) calls this and nothing else, so the rule cannot
// drift between them. The prebuild test reads each file for the call.

import { VOW_TERMS_VERSION } from "@/lib/vow-acknowledgement";
import { passwordExpired } from "@/lib/portal/passwordRule";

export interface VowAccessFields {
  verified: boolean;
  vowAcknowledgedAt: Date | null;
  vowAcknowledgementVersion?: number | null;
  passwordHash: string | null;
  passwordSetAt?: Date | null;
  isRegistrant?: boolean | null;
  reviewFlag?: string | null;
}

export interface VowSteps {
  /** never agreed, or agreed to an older text */
  needsAcknowledgement: boolean;
  /** agreed before, to an older version: the card shows the terms and the tick only */
  needsReconsent: boolean;
  needsPassword: boolean;
  /** the password is 90 days old: confirm it or choose a new one */
  needsPasswordRenewal: boolean;
  /** the registrant question has not been answered */
  needsRegistrantAnswer: boolean;
  /** answered yes: no records, a note to contact Aamir; flagged for review */
  registrant: boolean;
}

export function termsCurrent(user: VowAccessFields): boolean {
  return !!user.vowAcknowledgedAt && (user.vowAcknowledgementVersion ?? 0) >= VOW_TERMS_VERSION;
}

export function vowStepsLeft(user: VowAccessFields, now: Date = new Date()): VowSteps {
  const agreedCurrent = termsCurrent(user);
  return {
    needsAcknowledgement: !agreedCurrent,
    needsReconsent: !agreedCurrent && !!user.vowAcknowledgedAt,
    needsPassword: !user.passwordHash,
    needsPasswordRenewal: !!user.passwordHash && (!user.passwordSetAt || passwordExpired(user.passwordSetAt, now)),
    needsRegistrantAnswer: user.isRegistrant === null || user.isRegistrant === undefined,
    registrant: user.isRegistrant === true || user.reviewFlag === "registrant",
  };
}

export function canSeeVowRecords(user: VowAccessFields | null | undefined, now: Date = new Date()): boolean {
  if (!user) return false;
  if (!user.verified) return false;
  const s = vowStepsLeft(user, now);
  if (s.needsAcknowledgement || s.needsPassword || s.needsPasswordRenewal || s.needsRegistrantAnswer || s.registrant) {
    return false;
  }
  if (user.reviewFlag === "registrant") return false;
  return true;
}
