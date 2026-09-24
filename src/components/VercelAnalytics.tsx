"use client";

// Vercel Web Analytics, mounted once in the root layout (MH-009).
//
// The layout is a server component and `beforeSend` is a function, so the mount lives here:
// a function prop cannot cross the server-to-client boundary, a "use client" file can own it.
//
// WHY A REDACTOR AT ALL. Web Analytics records the page's full URL, query string included.
// Three flows on this site put one-time auth material in a query string, and none of it may
// land in an analytics store:
//   /signin/link?t=<token>&r=<path>          the magic link (src/lib/portal/door.ts:95)
//   /api/unsubscribe?w=<watchId>&t=<sig>     the one-click unsubscribe (src/lib/email/unsubscribe.ts:74)
//   /api/brief/unsubscribe?w=&t=             the same handler on the path older emails carry
//   /?preview=<secret>                        the middleware's preview gate (src/middleware.ts:31)
// The cron and admin routes read `secret=` too; a browser never renders them with this script,
// but the key is on the list so a pasted URL cannot leak either. The unsubscribe handler answers
// raw HTML without the layout, so this script never runs there, and the key stays listed for
// the same reason. Vercel's own deployment-protection bypass params are covered as well: a
// preview visited with `x-vercel-protection-bypass=` must not record the bypass secret.
//
// The rule is two-layered. Any URL on an auth path loses its whole query. Any URL anywhere
// loses the VALUE of a key that names auth material, exact or by substring (`token`, `secret`,
// `passw`, `bypass`, `session`), the value replaced with the literal `redacted` so the
// dashboard shows the parameter was there and nothing else. A URL that cannot be parsed
// returns null: a dropped page view is fine, a leaked token is not.
//
// DEVELOPMENT. In `development` the package swaps in `script.debug.js`, which sends nothing,
// but it still injects a script tag on every page. The component renders nothing unless
// NODE_ENV is `production`, so local work injects no script at all and spends no events. A
// Vercel preview builds with NODE_ENV=production, so previews record, which the gates need.

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/** Paths whose whole query string is auth material. Prefix match on the pathname. */
const AUTH_PATHS = ["/signin/link", "/api/auth/", "/api/unsubscribe", "/api/brief/unsubscribe"];

/** Keys carrying a token, a code or a secret, matched exactly after lower-casing. */
const SENSITIVE_KEYS = new Set([
  "t", // the magic-link token and the unsubscribe signature
  "w", // the unsubscribe watch id, half of the signed pair
  "token",
  "code",
  "secret",
  "key",
  "preview", // src/middleware.ts PREVIEW_SECRET
  "password",
  "auth",
  "access_token",
  "id_token",
  "refresh_token",
  "session",
  "sig",
  "signature",
  "x-vercel-protection-bypass",
  "x-vercel-set-bypass-cookie",
  "_vercel_share",
]);

/** Substrings that mark a key as sensitive whatever its exact spelling. */
const SENSITIVE_FRAGMENTS = ["token", "secret", "passw", "bypass", "session", "apikey", "api_key"];

const REDACTED = "redacted";

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  if (SENSITIVE_KEYS.has(k)) return true;
  return SENSITIVE_FRAGMENTS.some((f) => k.includes(f));
}

/** Pure, exported for the unit test in scripts/verify. Returns the URL to record, or null. */
export function redactAnalyticsUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  // Nothing behind a hash is ours to record.
  u.hash = "";

  const path = u.pathname;
  if (AUTH_PATHS.some((p) => path === p || path.startsWith(p))) {
    u.search = "";
    return u.toString();
  }

  if (u.search) {
    const keys = Array.from(new Set(Array.from(u.searchParams.keys())));
    for (const key of keys) {
      if (isSensitiveKey(key)) u.searchParams.set(key, REDACTED);
    }
  }
  return u.toString();
}

export function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = redactAnalyticsUrl(event.url);
  if (url === null) return null;
  return { ...event, url };
}

export default function VercelAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return <Analytics beforeSend={beforeSend} />;
}
