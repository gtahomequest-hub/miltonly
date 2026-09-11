import "server-only";

// The unsubscribe link, and why it carries a signature.
//
// CASL requires a working unsubscribe in every commercial message and the link has to work
// with one click, from an email client, with no account and no password — the subscriber never
// had either. So the only identifier available is the watch id, which is a cuid sitting in a
// URL that will pass through mail servers and spam filters.
//
// A bare id would let anyone who guesses or replays one turn off somebody else's brief, and a
// sequential scan would turn off all of them. The token is an HMAC of the watch id under a
// server secret, so a link can be followed but not forged, and knowing one tells you nothing
// about the next.
//
// THE SECRET FAILS CLOSED. With no secret set the link cannot be signed, and an unsigned link
// is not a weaker unsubscribe, it is no unsubscribe. So minting throws rather than emitting
// something that will not verify, and the sender treats that as a reason not to send: a
// commercial email with a broken unsubscribe link is the thing CASL prohibits.

import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

function secret(): string {
  // CRON_SECRET is already set in Production and Preview and is server-only, so the link needs
  // no new variable to be deployed. BRIEF_UNSUBSCRIBE_SECRET overrides it where the two
  // should not share a key.
  const s = process.env.BRIEF_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!s) {
    throw new Error(
      "brief unsubscribe cannot be signed: set BRIEF_UNSUBSCRIBE_SECRET or CRON_SECRET",
    );
  }
  return s;
}

export function signWatch(watchId: string): string {
  return createHmac("sha256", secret()).update(watchId).digest("base64url").slice(0, 32);
}

export function verifyWatch(watchId: string, token: string): boolean {
  let expected: string;
  try {
    expected = signWatch(watchId);
  } catch {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** The link that goes in the footer of every edition. Absolute: it is read out of an inbox. */
export function unsubscribeUrl(watchId: string, origin?: string): string {
  const base = origin || config.SITE_URL;
  return `${base}/api/brief/unsubscribe?w=${encodeURIComponent(watchId)}&t=${signWatch(watchId)}`;
}
