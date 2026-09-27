/**
 * @file The public contact address the VOW must maintain (MP-007; MC-047 introduces this file
 * on Core's branch, mirrored here so the reviewer copy resolves before that merge — if both
 * land, the content is identical and merges clean).
 * @module lib/compliance/contact
 *
 * MLS® Rule 8.12 obliges a prominently displayed way for a Consumer to reach the Member; Rule
 * 8.16 obliges a means to receive accuracy comments. Both are the same public mailbox, and it
 * is where a PropTx or TRREB reviewer writes to have a held account cleared (Rule 8.21).
 *
 * **Not `REALTOR_EMAIL`.** That is the internal recipient of lead notifications; it is never
 * rendered. `CONTACT_EMAIL` is the address published on the site.
 *
 * **No fallback, and never a crash.** A hardcoded default would publish the wrong address the
 * first time the variable went missing; a throw would take a page down over a compliance
 * notice. `contactEmail()` returns null instead, and the caller renders nothing (MP-007 item
 * 6: "render nothing if unset"). Setting `CONTACT_EMAIL` on the deployment lights the address
 * up in the registrant wall and the reviewer notice.
 */

/**
 * The published contact address, or null when it is not configured.
 * @returns the address, trimmed, or null when unset, blank or not an address.
 */
export function contactEmail(): string | null {
  const raw = process.env.CONTACT_EMAIL?.trim();
  if (!raw) return null;
  // A blank or malformed value is the same as absent: better to render nothing than a mailto a
  // reviewer's message disappears into.
  return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(raw) ? raw : null;
}
