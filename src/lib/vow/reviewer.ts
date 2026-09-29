// The reviewer path (MP-007, MLS® Rule 8.21, VOW Best Practices item 30, VOW Policy 12): how a
// PropTx or TRREB representative gets the consumer's view of this VOW without ever being handed
// the administrator credential.
//
// The route is the consumer's, with one difference. A reviewer registers the way a consumer
// does (email, then the card), and on the card answers the registrant question with the third
// option, "I am reviewing this VOW for PropTx or the Toronto Regional Real Estate Board." That
// answer does not open the account: it HOLDS it (reviewFlag "reviewer-hold", no records) and
// emails the owner. The owner confirms the organization and clears the hold from the admin desk
// (src/lib/vow/hold.ts, /admin/vow); the account then completes the same card a consumer does
// (a password, the terms) and sees exactly what a consumer sees, its reads landing in
// VowAccessLog like anyone's.
//
// No import of Prisma or Next here: the card (a client component) and the server notice both
// read these strings, and the contact address is passed in (contactEmail() is the server's).
//
// Homesly's equivalent: D:\homesly src/lib/auth/texts.ts reviewerPath()/reviewerHeld*.

/** The third answer on the registrant declaration. */
export const REVIEWER_ANSWER =
  "I am reviewing this VOW for PropTx or the Toronto Regional Real Estate Board.";

/** Rule 8.21's one thing never to do. Verbatim as MP-007 requires it. */
export const REVIEWER_NEVER_SHARED =
  "Administrator credentials are never shared, with a reviewer or with anyone else. Access for a review is always a reviewer's own account.";

/** What the broker of record does, and what the account then sees. */
const REVIEWER_CLEARED =
  "The broker of record confirms the organization and clears the hold, and the account then sees exactly what a registered consumer sees: the same pages, the same figures, the same limits. A copy of that account's audit trail is available on request.";

/**
 * Where a held reviewer writes: to the published contact address from the same email, or, when
 * no address is configured, through the contact page. One sentence, shared by the notice, the
 * held message and the owner email, so the three say it the same way.
 * @param contact - the published contact address (contactEmail()), or null.
 * @returns the sentence.
 */
function reviewerNext(contact: string | null): string {
  return `Then ${contact ? `write to ${contact}` : "reach us through the /privacy page"} from the same email address, saying which organization you represent.`;
}

/**
 * The published reviewer notice (MP-007 item 2): the sentence on the register, terms and
 * account pages telling a reviewer to choose the reviewer answer and write in. Three
 * paragraphs, in order.
 * @param contact - the published contact address, or null.
 * @returns the paragraphs.
 */
export function reviewerPath(contact: string | null): string[] {
  return [
    `Reviewing this VOW for PropTx or the Toronto Regional Real Estate Board (MLS\u00ae Rule 8.21)? Sign in here the way a consumer does, and when the sold prices ask whether you are a licensed real estate registrant, answer with \u201c${REVIEWER_ANSWER}\u201d, not \u201cYes\u201d: that answer holds the account for review instead of opening it.`,
    `${reviewerNext(contact)} ${REVIEWER_CLEARED}`,
    REVIEWER_NEVER_SHARED,
  ];
}

/**
 * What a reviewer reads on the card once the reviewer answer has held the account.
 * @param contact - the published contact address, or null.
 * @returns the message.
 */
export function reviewerHeldMessage(contact: string | null): string {
  return `Thanks. This account is held for review rather than opened. ${reviewerNext(contact)} ${REVIEWER_CLEARED} ${REVIEWER_NEVER_SHARED}`;
}
