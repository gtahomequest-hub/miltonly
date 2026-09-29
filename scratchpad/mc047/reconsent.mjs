// MC-047: the terms went to version 6, so the battery's desk row (VERIFY_PORTAL_EMAIL) owes a
// re-consent before any VOW record is served to it (MC-044: "bring it current by link, never
// weaken the check"). This signs in through the real door (POST /api/auth/login, the email and
// the password), reads /api/auth/me, and when the terms are owed posts the same {consent:true}
// the card posts. Prints the before and after termsVersion; never prints the password.
// usage: node scratchpad/mc047/reconsent.mjs <base> [--read-only]
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const base = process.argv[2];
const readOnly = process.argv.includes('--read-only');
const email = process.env.VERIFY_PORTAL_EMAIL, password = process.env.VERIFY_PORTAL_PASSWORD;
if (!email || !password) throw new Error('VERIFY_PORTAL_EMAIL and VERIFY_PORTAL_PASSWORD must be in .env.local');
const H = { 'content-type': 'application/json', origin: base, referer: `${base}/signin`, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) miltonly-verify MC-047' };
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email, password }), redirect: 'manual' });
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('miltonly_session='));
console.log('login', login.status, cookie ? 'session cookie set' : 'NO session cookie');
if (!cookie) process.exit(1);
const me = async () => (await (await fetch(`${base}/api/auth/me`, { headers: { ...H, cookie } })).json()).user;
const before = await me();
console.log('me', before.email === email ? 'desk row' : before.email, 'termsVersion', before.termsVersion, 'needsAcknowledgement', before.needsAcknowledgement, 'contact', before.contact);
if (!readOnly && before.needsAcknowledgement) {
  const ack = await fetch(`${base}/api/auth/acknowledge-vow`, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ consent: true }) });
  console.log('acknowledge', ack.status, (await ack.text()).slice(0, 120));
  const after = await me();
  console.log('after termsVersion', after.termsVersion, 'needsAcknowledgement', after.needsAcknowledgement);
}
