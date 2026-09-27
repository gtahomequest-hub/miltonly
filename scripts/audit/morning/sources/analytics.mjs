// MA-008. Vercel Web Analytics: sessions, bounce, top pages and, above all, referrers, because
// GSC cannot see a visitor ChatGPT sends. Vercel publishes no REST endpoint for this; the
// dashboard's own endpoint is tried with the token, and until the analytics script is on the
// site (Home is building it) and the endpoint answers, every field here reads "awaiting first
// data", which is the expected state on the first runs and not a failure. Bot request counts
// (Googlebot, oai-searchbot) likewise have no API today and are marked awaiting a source.
import { json, redact, CONFIG } from '../lib.mjs';

export async function gatherAnalytics() {
  const token = process.env.VERCEL_API_TOKEN;
  const out = { ok: true, status: 'awaiting first data', sessions: null, bounce: null, topPages: [], referrers: [], aiReferrers: [], bots: { status: 'awaiting a source (Observability by hand until a log drain or API exists)' }, note: '' };
  if (!token) { out.note = 'VERCEL_API_TOKEN unset'; return out; }
  try {
    const H = { authorization: `Bearer ${token}` };
    const teams = await json('https://api.vercel.com/v2/teams', { headers: H });
    const team = teams.teams.find((t) => t.slug === CONFIG.vercel.teamSlug) ?? teams.teams[0];
    const projects = (await json(`https://api.vercel.com/v9/projects?teamId=${team.id}`, { headers: H })).projects;
    const p = projects.find((x) => x.name === CONFIG.vercel.projects[0]);
    const to = Date.now(), from = to - 86400e3;
    // The dashboard's endpoint; undocumented, so a non-200 is "awaiting", not an error.
    const r = await fetch(`https://vercel.com/api/web-analytics/stats?projectId=${p.id}&teamId=${team.id}&environment=production&from=${new Date(from).toISOString()}&to=${new Date(to).toISOString()}`, { headers: H });
    if (!r.ok) { out.note = `analytics endpoint answered ${r.status}; the script is not on the site yet`; return out; }
    const j = await r.json().catch(() => null);
    if (!j || typeof j !== 'object') { out.note = 'analytics endpoint answered with no body'; return out; }
    // Shape unknown until it answers; keep what is recognisable and mark the rest.
    out.status = 'first data';
    out.sessions = j.visitors ?? j.sessions ?? j.total?.visitors ?? null;
    out.bounce = j.bounceRate ?? j.bounce ?? null;
    out.topPages = (j.pages || j.topPages || []).slice(0, 5);
    out.referrers = (j.referrers || j.topReferrers || []).slice(0, 10);
    out.aiReferrers = out.referrers.filter((x) => CONFIG.analytics.aiReferrerHosts.some((h) => String(x.referrer || x.name || x.key || '').includes(h)));
    out.note = 'shape unverified: first response from the endpoint';
    return out;
  } catch (e) {
    out.note = redact(e.message).slice(0, 120);
    return out;
  }
}
