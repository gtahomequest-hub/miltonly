// MA-008. Google Search Console, through the service account. GSC data lags by two to three
// days, so "yesterday" here is the latest date the API has, and the report names that date.
// The key file (GSC_SERVICE_ACCOUNT, a path outside the repo) or its contents
// (GSC_SERVICE_ACCOUNT_JSON, the Actions secret) signs a one-hour JWT; neither is logged.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { json, redact, CONFIG, weekday } from '../lib.mjs';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const SITE = encodeURIComponent(CONFIG.gscProperty);
const ymd = (d) => d.toISOString().slice(0, 10);
const shift = (iso, days) => ymd(new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86400e3));

async function token() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON || (process.env.GSC_SERVICE_ACCOUNT ? fs.readFileSync(process.env.GSC_SERVICE_ACCOUNT, 'utf8') : null);
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT (path) or GSC_SERVICE_ACCOUNT_JSON unset');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const t = await json(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` });
  return { access: t.access_token, account: sa.client_email };
}

export async function gatherGsc() {
  try {
    const { access, account } = await token();
    const H = { authorization: `Bearer ${access}`, 'content-type': 'application/json' };
    const q = async (body) => (await json(`https://searchconsole.googleapis.com/webmasters/v3/sites/${SITE}/searchAnalytics/query`, { method: 'POST', headers: H, body: JSON.stringify(body) })).rows || [];
    const today = ymd(new Date());
    // Daily series, 40 days back, so the latest date with data, the 7-day average and the same weekday last week all come from one call.
    const series = (await q({ startDate: shift(today, -40), endDate: today, dimensions: ['date'], rowLimit: 100 })).map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })).sort((a, b) => a.date.localeCompare(b.date));
    if (!series.length) return { ok: true, account, latest: null, note: 'no rows in the last 40 days' };
    const latest = series[series.length - 1];
    const prior7 = series.filter((r) => r.date < latest.date).slice(-7);
    const avg7 = prior7.length ? { clicks: prior7.reduce((a, r) => a + r.clicks, 0) / prior7.length, impressions: prior7.reduce((a, r) => a + r.impressions, 0) / prior7.length, days: prior7.length } : null;
    const sameWeekdayLastWeek = series.find((r) => r.date === shift(latest.date, -7)) ?? null;
    const mtdStart = `${latest.date.slice(0, 7)}-01`;
    const mtd = series.filter((r) => r.date >= mtdStart).reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 });
    const d28 = series.filter((r) => r.date > shift(latest.date, -28)).reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 });

    // Top pages on the latest day, with position; and the 28-day page table for the conversion join.
    const pagesDay = (await q({ startDate: latest.date, endDate: latest.date, dimensions: ['page'], rowLimit: 25 })).map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    const pages28 = (await q({ startDate: shift(latest.date, -27), endDate: latest.date, dimensions: ['page'], rowLimit: 500 })).map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) }));
    // Queries: the last 28 days against the 28 before, for new queries and for page-one candidates.
    const queries28 = (await q({ startDate: shift(latest.date, -27), endDate: latest.date, dimensions: ['query'], rowLimit: 500 })).map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) }));
    const queriesPrev = new Set((await q({ startDate: shift(latest.date, -55), endDate: shift(latest.date, -28), dimensions: ['query'], rowLimit: 1000 })).map((r) => r.keys[0]));
    const newQueries = queries28.filter((x) => !queriesPrev.has(x.query)).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
    // The page for each page-one candidate query.
    const qp = await q({ startDate: shift(latest.date, -27), endDate: latest.date, dimensions: ['query', 'page'], rowLimit: 1000, dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'contains', expression: '' }] }] }).catch(() => []);
    const bestPageFor = {}; for (const r of qp) { const k = r.keys[0]; if (!bestPageFor[k] || r.impressions > bestPageFor[k].impressions) bestPageFor[k] = { page: r.keys[1], impressions: r.impressions }; }
    for (const x of queries28) x.page = bestPageFor[x.query]?.page ?? '';
    // Pages that fell out of the top 10: position ≤ 10 last week, > 10 this week, on pages with impressions on both.
    const thisWeek = await q({ startDate: shift(latest.date, -6), endDate: latest.date, dimensions: ['page'], rowLimit: 500 });
    const lastWeek = await q({ startDate: shift(latest.date, -13), endDate: shift(latest.date, -7), dimensions: ['page'], rowLimit: 500 });
    const lw = new Map(lastWeek.map((r) => [r.keys[0], r]));
    const fellOut = thisWeek.filter((r) => { const p = lw.get(r.keys[0]); return p && p.position <= 10 && r.position > 10 && p.impressions >= 10 && r.impressions >= 10; }).map((r) => ({ page: r.keys[0], from: +lw.get(r.keys[0]).position.toFixed(1), to: +r.position.toFixed(1), impressions: r.impressions })).sort((a, b) => b.impressions - a.impressions).slice(0, 6);
    // www against apex, impressions over 28 days: the leak to watch close.
    const hosts = { apex: { clicks: 0, impressions: 0 }, www: { clicks: 0, impressions: 0 }, other: { clicks: 0, impressions: 0 } };
    for (const p of pages28) { const h = p.page.startsWith('https://www.') ? 'www' : p.page.startsWith(`https://${CONFIG.site}`) ? 'apex' : 'other'; hosts[h].clicks += p.clicks; hosts[h].impressions += p.impressions; }

    return { ok: true, account, latest: { ...latest, weekday: weekday(latest.date) }, lagDays: Math.round((new Date(today) - new Date(latest.date)) / 86400e3), avg7, sameWeekdayLastWeek: sameWeekdayLastWeek ? { ...sameWeekdayLastWeek, weekday: weekday(sameWeekdayLastWeek.date) } : null, mtd, d28, pagesDay: pagesDay.slice(0, 5), pages28, queries28, newQueries, fellOut, hosts };
  } catch (e) {
    return { ok: false, error: redact(e.message) };
  }
}
