// The password rules that need no imports, so the card, the sign-in form and vow-access.ts
// can read them without pulling bcrypt and the rate-limit stack along. src/lib/portal/
// password.ts re-exports them and is the one that judges and hashes.
export const MIN_PASSWORD_LENGTH = 12;

// THE 90-DAY PASSWORD (MP-006, MLS R-8.06, PropTx Best Practices item 24): "Consumer passwords
// must be limited to 90 days, but VOW may provide a mechanism for renewal." The password's age
// is passwordSetAt; past PASSWORD_MAX_DAYS it still signs the person in (the login route judges
// the hash as before) but no VOW record is served until the card takes a renewal: the same
// password typed again (a reconfirmation, the hash unchanged, passwordSetAt reset) or a new one.
// This is the password's clock, distinct from the session's ceiling in src/lib/auth.ts.
export const PASSWORD_MAX_DAYS = 90;

// CREDENTIAL RECORDS (Appendix B(b)): the name, email, username and current password record
// are kept for not less than 180 days after the password's validity expires. So a row with a
// passwordHash may not be hard-deleted before credentialRetainUntil(); the purge script refuses
// such rows, and the account-deletion path (MP-003) anonymises instead. "Current password" is
// held as the bcrypt hash, not the plaintext: see the MP-006 report, item 3, for the question
// this leaves for PropTx.
export const CREDENTIAL_RETENTION_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export function passwordExpiresAt(passwordSetAt: Date | null | undefined): Date | null {
  if (!passwordSetAt) return null;
  return new Date(passwordSetAt.getTime() + PASSWORD_MAX_DAYS * DAY_MS);
}

/** True once the password is PASSWORD_MAX_DAYS old. A row with no password is not "expired";
 *  it is unset, and vow-access.ts asks for a password, not a renewal. */
export function passwordExpired(passwordSetAt: Date | null | undefined, now: Date = new Date()): boolean {
  const until = passwordExpiresAt(passwordSetAt);
  return !!until && until.getTime() <= now.getTime();
}

/** The date before which the credential record must not be deleted. */
export function credentialRetainUntil(passwordSetAt: Date | null | undefined): Date | null {
  const until = passwordExpiresAt(passwordSetAt);
  return until ? new Date(until.getTime() + CREDENTIAL_RETENTION_DAYS * DAY_MS) : null;
}

// The per-consumer record (Appendix B(b), MP-007) reports, in place of the password, the
// hashing scheme and the fact that only a hash is held, by name, read from the hash's prefix
// only: the salt and the hash bytes are never part of the answer, and no plaintext exists to
// report. Same field names and the same "held as" wording as Homesly's
// src/lib/vow/audit-report.ts, so one PropTx request gets one format from both sites. Here (no
// imports) so the pure report module and the shell export read them without pulling bcrypt.
export const PASSWORD_HELD_AS =
  "A salted one-way hash only. The password itself is not stored and cannot be recovered or produced from the record.";

/**
 * The hashing scheme a stored bcrypt hash names, e.g. "bcrypt (cost 12), 128-bit salt, 184-bit
 * hash". Read from the `$2[aby]$<cost>$` prefix; "unrecognised" for another format; null with
 * no password.
 * @param stored - `User.passwordHash`.
 * @returns the scheme name, or null.
 */
export function hashSchemeOf(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const m = /^\$2[aby]\$(\d{2})\$/.exec(stored);
  // bcrypt: a 128-bit salt (22 base64 chars) and a 184-bit hash (31 base64 chars).
  return m ? `bcrypt (cost ${Number(m[1])}), 128-bit salt, 184-bit hash` : "unrecognised";
}

