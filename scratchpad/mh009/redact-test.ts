// MH-009: the redactor against the URL shapes the app actually mints. Exit 1 on any miss.
import { redactAnalyticsUrl, beforeSend } from "../../src/components/VercelAnalytics";

const B = "https://miltonly.com";
const cases: [string, string | null][] = [
  // the magic link, src/lib/portal/door.ts:95
  [`${B}/signin/link?t=abc123DEF&r=%2Fstreets%2Fmain-street-milton`, `${B}/signin/link`],
  // the one-click unsubscribe, src/lib/email/unsubscribe.ts:74, both mounts
  [`${B}/api/unsubscribe?w=cku9x&t=sigsigsig`, `${B}/api/unsubscribe`],
  [`${B}/api/brief/unsubscribe?w=cku9x&t=sigsigsig`, `${B}/api/brief/unsubscribe`],
  // any /api/auth/* URL loses its query
  [`${B}/api/auth/verify?token=zzz`, `${B}/api/auth/verify`],
  // the middleware preview secret, src/middleware.ts:31
  [`${B}/?preview=miltonly-aamir-2026`, `${B}/?preview=redacted`],
  [`${B}/streets/main-street-milton?preview=off`, `${B}/streets/main-street-milton?preview=redacted`],
  // a cron secret pasted into a browser
  [`${B}/api/sync/generate?secret=hunter2`, `${B}/api/sync/generate?secret=redacted`],
  // Vercel's deployment-protection bypass
  [`${B}/?x-vercel-protection-bypass=abc&x-vercel-set-bypass-cookie=true`, `${B}/?x-vercel-protection-bypass=redacted&x-vercel-set-bypass-cookie=redacted`],
  // substring rule, any spelling
  [`${B}/x?authToken=1&ApiKey=2&resetPassword=3`, `${B}/x?authToken=redacted&ApiKey=redacted&resetPassword=redacted`],
  // a hash is dropped
  [`${B}/streets/main-street-milton#sold`, `${B}/streets/main-street-milton`],
  // the sign-in page's own params are paths and intents, not secrets: they stay
  [`${B}/signin?redirect=%2Fsold&intent=sold`, `${B}/signin?redirect=%2Fsold&intent=sold`],
  // ordinary facets stay
  [`${B}/sold?nbhd=timberlea&type=detached`, `${B}/sold?nbhd=timberlea&type=detached`],
  [`${B}/listings?status=active&fbclid=IwAR`, `${B}/listings?status=active&fbclid=IwAR`],
  // unparseable → null
  ["not a url", null],
  ["", null],
];

let fail = 0;
for (const [input, want] of cases) {
  const got = redactAnalyticsUrl(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${input}\n     -> ${got}${ok ? "" : `\n     want ${want}`}`);
}
const ev = beforeSend({ type: "pageview", url: `${B}/signin/link?t=abc` });
const evNull = beforeSend({ type: "pageview", url: "nope" });
if (!ev || ev.url !== `${B}/signin/link` || ev.type !== "pageview") { fail++; console.log("FAIL beforeSend shape", ev); }
if (evNull !== null) { fail++; console.log("FAIL beforeSend null", evNull); }
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
