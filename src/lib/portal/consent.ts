// The consent sentence, alone in a module with no imports, for the same reason the honeypot
// field name is (src/lib/lead/honeypot.ts): the sign-in form and the acknowledgement card
// render it in the browser, and the door library that stores it imports the rate-limit stack.
//
// Stored verbatim on the User row at acknowledgement, with the server's timestamp. Editing it
// is a new version for people who agree after the edit; it never rewrites what was stored.
export const PORTAL_CONSENT_TEXT =
  "I agree that Miltonly (Aamir Yaqoob, RE/MAX Realty Specialists Inc., Brokerage) may hold my " +
  "name, email and street to run my account and email me about it. Every email has an " +
  "unsubscribe link and I can ask for the account and my information to be removed at any " +
  "time at miltonly.com/privacy/request.";
