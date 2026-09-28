// MC-044: the 60-minute inactivity timeout (R-8.13, MP-006), on production, in real time.
//
//   node scratchpad/mc044/prove-inactivity.mjs [base]
//
// Two password sign-ins as VERIFY_PORTAL_EMAIL, two tokens:
//   A is never touched after sign-in; at +61 min /api/auth/me must answer no user.
//   B is touched once at +30 min through /api/auth/me, and the token it re-issues is kept; at
//     +61 min that token must still answer the user (the clock slides with activity) and its
//     ceiling (`exp`) must be the one minted at sign-in.
// Times come from the server's Date header (this desk's clock ran 12.4 s ahead). The tokens stay in
// memory; only their claims (iat, act, exp) are printed. The password is never printed.
import fs from "node:fs";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}
const base = process.argv[2] || "https://miltonly.com";
const COOKIE = "miltonly_session";
const UA = "miltonly-verify mc044-inactivity";
const email = process.env.VERIFY_PORTAL_EMAIL;
const password = process.env.VERIFY_PORTAL_PASSWORD;
let failures = 0;
const mark = (s) => console.log(`[local ${new Date().toISOString()}] ${s}`);
const check = (ok, label) => { if (!ok) failures++; mark(`${ok ? "PASS" : "FAIL"} ${label}`); };
const claims = (t) => {
  const c = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString("utf8"));
  const iso = (s) => (s ? new Date(s * 1000).toISOString() : null);
  return { iat: iso(c.iat), act: iso(c.act), exp: iso(c.exp) };
};
const cookieOf = (res) => (res.headers.get("set-cookie") || "").match(new RegExp(`${COOKIE}=([^;]+)`))?.[1] || null;

async function signIn(label) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, "user-agent": UA },
    body: JSON.stringify({ email, password }),
  });
  const t = cookieOf(res);
  if (res.status !== 200 || !t) throw new Error(`${label}: sign-in refused ${res.status}`);
  mark(`${label}: signed in at server ${res.headers.get("date")}; claims ${JSON.stringify(claims(t))}`);
  return t;
}
async function me(label, token) {
  const res = await fetch(`${base}/api/auth/me`, { headers: { cookie: `${COOKIE}=${token}`, "user-agent": UA } });
  const j = await res.json().catch(() => ({}));
  const fresh = cookieOf(res);
  mark(`${label}: /api/auth/me at server ${res.headers.get("date")}: user ${j.user ? "present" : "null"}; re-issued ${fresh ? JSON.stringify(claims(fresh)) : "nothing"}`);
  return { user: !!j.user, fresh };
}
const sleep = (m) => new Promise((r) => setTimeout(r, m * 60_000));

const A = await signIn("A");
let B = await signIn("B");
const bExp = claims(B).exp;
await sleep(30);
const t = await me("B at +30 min", B);
check(t.user && !!t.fresh, "B is live at +30 min and /me re-issues it");
if (t.fresh) B = t.fresh;
check(claims(B).exp === bExp, "B's ceiling (exp) is unchanged by the touch");
await sleep(31);
const a = await me("A at +61 min, never touched", A);
check(!a.user, "A is refused after 60 minutes without activity");
const b = await me("B at +61 min, touched at +30", B);
check(b.user, "B, touched at +30 min, is still live at +61 min");
mark(failures ? `INACTIVITY PROOF: ${failures} FAILED` : "INACTIVITY PROOF: ALL PASS");
process.exit(failures ? 1 : 0);
