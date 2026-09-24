// The one rule for whether a session may be shown a VOW record (MP-002b).
//
// Three things, all on the User row: the email is verified (getSession() already returns null
// otherwise), the bona-fide-interest acknowledgement is recorded, and a password is set.
// TRREB R-805(c) wants a username and a password per consumer; the email is the username and
// nothing is served until the password exists, even to a session that came in through the
// emailed link. Every VOW surface (the fetchers in sold-data.ts, the three routes, VowGate,
// /sold, NeighbourhoodSoldBlock) calls this and nothing else, so the rule cannot drift between
// them. The prebuild test reads each file for the call.

export interface VowAccessFields {
  verified: boolean;
  vowAcknowledgedAt: Date | null;
  passwordHash: string | null;
}

export function canSeeVowRecords(user: VowAccessFields | null | undefined): boolean {
  if (!user) return false;
  return user.verified && !!user.vowAcknowledgedAt && !!user.passwordHash;
}

/** What a signed-in person still has to do before records show, for the card to ask. */
export function vowStepsLeft(user: VowAccessFields): { needsAcknowledgement: boolean; needsPassword: boolean } {
  return { needsAcknowledgement: !user.vowAcknowledgedAt, needsPassword: !user.passwordHash };
}
