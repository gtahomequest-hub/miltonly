import "server-only";

// The unsubscribe link, and why it carries a signature.
//
// CASL requires a working unsubscribe in every commercial message and the link has to work
// with one click, from an email client, with no account and no password — the subscriber never
// had either. So the only identifier available is the watch id, which is a cuid sitting in a
// URL that will pass through mail servers and spam filters.
//
// A bare id would let anyone who guesses or replays one turn off somebody else's mail, and a
// sequential scan would turn off all of them. The token is an HMAC of the watch id under a
// server secret, so a link can be followed but not forged, and knowing one tells you nothing
// about the next.
//
// ONE MODULE FOR EVERY WATCH KIND. This began as the brief's link (src/lib/brief/unsubscribe.ts)
// and the deal alerts and the leads digest had none, which was two recurring commercial mails
// with no unsubscribe at all. The token signs the watch id and nothing else, so the same link
// shape serves a brief, a street alert, a listing watch or the digest: the route reads `kind`
// off the row it finds and disables that row. A link minted under the old module verifies
// here unchanged, because the HMAC input and the secret are the same.
//
// THE SECRET FAILS CLOSED. With no secret set the link cannot be signed, and an unsigned link
// is not a weaker unsubscribe, it is no unsubscribe. So minting throws rather than emitting
// something that will not verify, and every sender treats that as a reason not to send: a
// commercial email with a broken unsubscribe link is the thing CASL prohibits.

import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

/** The one path every link points at. /api/brief/unsubscribe answers too, for links already
 *  sitting in inboxes, and runs the same handler. */
export const UNSUBSCRIBE_PATH = "/api/unsubscribe";

function secret(): string {
  // BRIEF_UNSUBSCRIBE_SECRET is set in Production and Preview (ML-001) and keeps its name so
  // no environment changes with this module; CRON_SECRET is the fallback it had before that.
  const s = process.env.BRIEF_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!s) {
    throw new Error(
      "unsubscribe link cannot be signed: set BRIEF_UNSUBSCRIBE_SECRET or CRON_SECRET",
    );
  }
  return s;
}

/** True when a link can be signed. A sender checks this once, before its loop, and refuses
 *  the whole run rather than discovering it on the first row. */
export function canSignUnsubscribe(): boolean {
  return Boolean(process.env.BRIEF_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET);
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

/** The link that goes in the footer of every recurring email. Absolute: it is read out of an
 *  inbox. `origin` is the preview host when the sender runs on a preview deployment, so a
 *  preview test of the link exercises the preview and not production. */
export function unsubscribeUrl(watchId: string, origin?: string): string {
  const base = origin || config.SITE_URL;
  return `${base}${UNSUBSCRIBE_PATH}?w=${encodeURIComponent(watchId)}&t=${signWatch(watchId)}`;
}

/** The two headers RFC 8058 asks for. A mail client that shows its own "Unsubscribe" button
 *  POSTs `List-Unsubscribe=One-Click` to the URL, and the route accepts POST for that. */
export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
