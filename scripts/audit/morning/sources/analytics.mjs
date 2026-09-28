// MA-008, rewritten MA-011. Vercel Web Analytics through the Query API
// (api.vercel.com/v1/query/web-analytics/visits/count and /aggregate) with VERCEL_API_TOKEN:
// visitors and pageviews yesterday, over the last 7 days and month to date, the top pages and
// the referrers, because GSC cannot see a visitor ChatGPT sends.
//
// The API takes `since` and `until` and rounds them to UTC days on /count (to hours on
// /aggregate), so every window here is whole UTC days ending at 00:00 UTC today; at 06:00 Toronto
// that is the same calendar day as Toronto's yesterday. /aggregate answers `by` one of hour, day,
// requestPath, referrerHostname, and more; its first row can be an "Others" bucket that sums
// everything past `limit`, which is dropped here. The API has no bounce rate.
// Bot request counts (Googlebot, oai-searchbot) still have no API and stay "awaiting a source".
import { json, redact, CONFIG, TODAY, YESTERDAY, daysAgo } from '../lib.mjs';

const Q = 'https://api.vercel.com/v1/query/web-analytics/visits';
const at = (iso) => `${iso}T00:00:00.000Z`;

export async function gatherAnalytics() {
  const token = process.env.VERCEL_API_TOKEN;
  const out = { ok: true, status: 'awaiting first data', source: 'Vercel Query API', yesterday: null, last7: null, d28: null, mtd: null, topPages: [], referrers: [], aiReferrers: [], bots: { status: 'awaiting a source (Observability by hand until a log drain or API exists)' }, note: '' };
  if (!token) { out.note = 'VERCEL_API_TOKEN unset'; return out; }
  try {
    const H = { authorization: `Bearer ${token}` };
    const teams = await json('https://api.vercel.com/v2/teams', { headers: H });
    const team = teams.teams.find((t) => t.slug === CONFIG.vercel.teamSlug) ?? teams.teams[0];
    const projects = (await json(`https://api.vercel.com/v9/projects?teamId=${team.id}&search=${CONFIG.vercel.projects[0]}`, { headers: H })).projects;
    const p = projects.find((x) => x.name === CONFIG.vercel.projects[0]);
    if (!p) { out.ok = false; out.error = `project ${CONFIG.vercel.projects[0]} not found`; return out; }
    const base = `projectId=${p.id}&teamId=${team.id}&environment=production`;
    const count = async (since, until) => (await json(`${Q}/count?${base}&since=${at(since)}&until=${at(until)}`, { headers: H })).data;
    const agg = async (by, since, until, limit) => (await json(`${Q}/aggregate?${base}&since=${at(since)}&until=${at(until)}&by=${by}${limit ? `&limit=${limit}` : ''}`, { headers: H })).data || [];

    const since7 = daysAgo(7), since28 = daysAgo(28), mtdStart = `${YESTERDAY.slice(0, 7)}-01`;
    const [yesterday, last7, d28, mtd, days, pages, refs] = await Promise.all([
      count(YESTERDAY, TODAY), count(since7, TODAY), count(since28, TODAY), count(mtdStart, TODAY),
      agg('day', since7, TODAY), agg('requestPath', since7, TODAY, 6), agg('referrerHostname', since7, TODAY, 16),
    ]);
    out.status = 'live';
    out.window = { yesterday: YESTERDAY, since7, since28, mtdStart, until: TODAY, tz: 'UTC days' };
    out.yesterday = yesterday; out.last7 = { ...last7, days: days.filter((d) => d.timestamp < at(TODAY)).map((d) => ({ date: d.timestamp.slice(0, 10), visitors: d.visitors, pageviews: d.pageviews })) };
    out.d28 = d28; out.mtd = mtd;
    out.topPages = pages.filter((r) => r.requestPath !== 'Others').sort((a, b) => b.visitors - a.visitors || b.pageviews - a.pageviews).slice(0, 5).map((r) => ({ path: r.requestPath, visitors: r.visitors, pageviews: r.pageviews }));
    out.referrers = refs.filter((r) => r.referrerHostname !== 'Others').map((r) => ({ host: r.referrerHostname || '(direct or none)', visitors: r.visitors, pageviews: r.pageviews })).slice(0, 10);
    // The API groups by hostname only, so a configured entry with a path ("bing.com/chat") cannot be
    // told from the search engine on the same host and is not matched; a host matches itself or a subdomain.
    const aiHosts = CONFIG.analytics.aiReferrerHosts.filter((h) => !h.includes('/'));
    out.aiReferrers = refs.filter((r) => aiHosts.some((h) => r.referrerHostname === h || String(r.referrerHostname || '').endsWith(`.${h}`))).map((r) => ({ host: r.referrerHostname, visitors: r.visitors, pageviews: r.pageviews }));
    return out;
  } catch (e) {
    return { ...out, ok: false, error: redact(e.message).slice(0, 160) };
  }
}
