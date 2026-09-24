// MC-045: 28 days of GSC per-page clicks and impressions (and page x date for street URLs),
// sc-domain:miltonly.com. Read-only.
//   node scratchpad/mc045/method/gsc28.mjs <outDir>
// The key is read from D:/miltonly/.env the way src/lib/seo/gscClient.ts reads it, and is never printed.
import fs from 'node:fs';
import crypto from 'node:crypto';
const OUT = process.argv[2];
const line = fs.readFileSync('D:/miltonly/.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('GSC_SERVICE_ACCOUNT_KEY='));
let v = line.slice('GSC_SERVICE_ACCOUNT_KEY='.length).trim();
if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
const sa = JSON.parse(v);
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: sa.token_uri, iat: now, exp: now + 3600 })}`;
const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
const tok = await (await fetch(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` })).json();
if (!tok.access_token) { console.log('token failed:', tok.error || 'unknown'); process.exit(1); }
const SITE = encodeURIComponent('sc-domain:miltonly.com');
const q = async (body) => { const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${SITE}/searchAnalytics/query`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error(`${j.error.code} ${j.error.message}`); return j.rows || []; };
const ymd = (d) => d.toISOString().slice(0, 10);
const shift = (iso, n) => ymd(new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 864e5));
const series = await q({ startDate: shift(ymd(new Date()), -10), endDate: ymd(new Date()), dimensions: ['date'], rowLimit: 20 });
const latest = series.map((r) => r.keys[0]).sort().pop();
const start = shift(latest, -27);
const rows = [];
for (let startRow = 0; ; startRow += 25000) {
  const r = await q({ startDate: start, endDate: latest, dimensions: ['page'], rowLimit: 25000, startRow });
  rows.push(...r); if (r.length < 25000) break;
}
const pages = rows.map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) }));
// page x date for street URLs, so traffic can be counted from the date each page's served text was generated
const daily = [];
for (let startRow = 0; ; startRow += 25000) {
  const r = await q({ startDate: start, endDate: latest, dimensions: ['page', 'date'], rowLimit: 25000, startRow, dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '/streets/' }] }] });
  daily.push(...r.map((x) => ({ page: x.keys[0], date: x.keys[1], clicks: x.clicks, impressions: x.impressions }))); if (r.length < 25000) break;
}
fs.writeFileSync(`${OUT}/gsc28-daily.json`, JSON.stringify({ start, end: latest, daily }));
fs.writeFileSync(`${OUT}/gsc28.json`, JSON.stringify({ property: 'sc-domain:miltonly.com', start, end: latest, fetchedAt: new Date().toISOString(), pages }));
const st = pages.filter((p) => /\/streets\/[^/?#]+/.test(p.page));
console.log(`window ${start}..${latest} · pages ${pages.length} · street pages ${st.length} · street clicks ${st.reduce((a, p) => a + p.clicks, 0)} · street impressions ${st.reduce((a, p) => a + p.impressions, 0)} · site clicks ${pages.reduce((a, p) => a + p.clicks, 0)}`);
