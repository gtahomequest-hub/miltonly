// MA-008. Vercel: the money and the request counts.
//
// Dollars come from `vercel usage --json` (the same figures as the dashboard's Usage page; the
// REST API has no spend endpoint that answers this token). Requests, cache hit share, builds and
// deployments come from /v2/usage and /v6/deployments. The token travels as --token and as a
// header, never into a log line.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { json, calls, redact, CONFIG } from '../lib.mjs';

const exec = promisify(execFile);
const API = 'https://api.vercel.com';

async function usageCli(args, token) {
  calls.n++; calls.byHost['vercel-cli'] = (calls.byHost['vercel-cli'] || 0) + 1;
  const bin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const { stdout } = await exec(bin, ['--yes', 'vercel@59', 'usage', '--json', '--token', token, '--scope', CONFIG.vercel.teamSlug, ...args], { maxBuffer: 16e6, windowsHide: true, shell: process.platform === 'win32' });
  return JSON.parse(stdout);
}

const ymd = (d) => d.toISOString().slice(0, 10);

export async function gatherVercel() {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return { ok: false, error: 'VERCEL_API_TOKEN unset' };
  const H = { authorization: `Bearer ${token}` };
  try {
    const teams = await json(`${API}/v2/teams`, { headers: H });
    const team = teams.teams.find((t) => t.slug === CONFIG.vercel.teamSlug) ?? teams.teams[0];
    const teamId = team.id;
    const detail = await json(`${API}/v2/teams/${teamId}`, { headers: H });
    const period = detail.billing?.period ? { start: new Date(detail.billing.period.start), end: new Date(detail.billing.period.end) } : null;
    const now = new Date();
    const dayOfCycle = period ? Math.floor((now - period.start) / 86400e3) + 1 : null;
    const cycleDays = period ? Math.round((period.end - period.start) / 86400e3) : null;

    // Dollars: this cycle, by service and by project, and by day; the same day last cycle.
    // The CLI defaults to the calendar month; the billing period starts on the 3rd, so the range is passed.
    const range = period ? ['--from', ymd(period.start), '--to', ymd(now)] : [];
    const cycle = await usageCli(range, token);
    const byProject = await usageCli([...range, '--group-by', 'project'], token);
    const daily = await usageCli([...range, '--breakdown', 'daily'], token);
    let lastCycleSameDay = null;
    if (period) {
      const prevStart = new Date(period.start); prevStart.setMonth(prevStart.getMonth() - 1);
      const prevSameDay = new Date(prevStart.getTime() + (now - period.start));
      try { lastCycleSameDay = await usageCli(['--from', ymd(prevStart), '--to', ymd(prevSameDay)], token); } catch (e) { lastCycleSameDay = { error: redact(e.message) }; }
    }
    const onDemand = (u) => (u?.services || []).filter((s) => s.name !== 'Pro').reduce((a, s) => a + (s.billedCost ?? s.effectiveCost ?? 0), 0);
    const spend = onDemand(cycle);
    const spendLastCycleSameDay = lastCycleSameDay && !lastCycleSameDay.error ? onDemand(lastCycleSameDay) : null;
    const listPrice = (cycle.services || []).filter((s) => s.name !== 'Pro').reduce((a, s) => a + (s.effectiveCost ?? 0), 0);
    const services = (cycle.services || []).filter((s) => s.name !== 'Pro').map((s) => ({ name: s.name, usd: +(s.billedCost ?? s.effectiveCost ?? 0).toFixed(2), listUsd: +(s.effectiveCost ?? 0).toFixed(2) })).sort((a, b) => b.usd - a.usd);

    // Daily breakdown: the last two full days, per service, for the day-over-day driver.
    const dayRows = daily.breakdown?.data || [];
    const perDay = dayRows.map((d) => ({ date: String(d.periodKey || '').slice(0, 10), total: onDemand(d), services: Object.fromEntries((d.services || []).filter((s) => s.name !== 'Pro').map((s) => [s.name, s.billedCost ?? s.effectiveCost ?? 0])) })).filter((d) => d.date);
    const yesterday = perDay[perDay.length - 2] ?? null; // the last row is today, partial
    const dayBefore = perDay[perDay.length - 3] ?? null;
    const lines = yesterday ? Object.entries(yesterday.services).map(([name, usd]) => { const prev = dayBefore?.services[name] ?? 0; const a = +usd.toFixed(2), b = +prev.toFixed(2); return { name, todayUsd: a, prevUsd: b, dayOverDayPct: b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? 100 : 0) }; }).sort((a, b) => b.todayUsd - a.todayUsd) : [];

    // Projection: the cycle's daily rate so far, straight-lined.
    const rate = dayOfCycle ? spend / dayOfCycle : null;
    const projected = rate != null && cycleDays ? rate * cycleDays : null;
    const cap = CONFIG.vercel.teamCapUsd;
    const daysToCap = rate ? (spend >= cap ? 0 : (cap - spend) / rate) : null;

    // Projects: dollars per project this cycle.
    const projectRows = (byProject.groupBy?.data || []).map((g) => ({ name: g.name || '?', usd: +onDemand(g).toFixed(2) })).sort((a, b) => b.usd - a.usd);

    // Requests and cache share, per project, yesterday (UTC days; the API has no other grain).
    const from = new Date(now.getTime() - 3 * 86400e3).toISOString(); const to = now.toISOString();
    const projects = (await json(`${API}/v9/projects?teamId=${teamId}`, { headers: H })).projects;
    const traffic = {};
    for (const name of CONFIG.vercel.projects) {
      const p = projects.find((x) => x.name === name); if (!p) continue;
      const u = await json(`${API}/v2/usage?teamId=${teamId}&type=requests&from=${from}&to=${to}&projectId=${p.id}`, { headers: H });
      const rows = (u.data || []).map((d) => ({ date: d.date.slice(0, 10), hits: d.request_hit_count, misses: d.request_miss_count, invocations: d.function_invocation_successful_count, gbHours: d.function_execution_successful_gb_hours, egressBytes: d.bandwidth_outgoing_bytes }));
      const y = rows.find((r) => r.date === new Date(now.getTime() - 86400e3).toISOString().slice(0, 10)) ?? rows[rows.length - 2] ?? null;
      const b = await json(`${API}/v2/usage?teamId=${teamId}&type=builds&from=${from}&to=${to}&projectId=${p.id}`, { headers: H });
      const brows = (b.data || []).map((d) => ({ date: d.date.slice(0, 10), builds: d.build_completed_count, failed: d.build_failed_count, seconds: d.build_build_seconds }));
      const by = brows.find((r) => r.date === y?.date) ?? null;
      traffic[name] = { yesterday: y, builds: by, cachedShare: y ? (y.hits + y.misses ? y.hits / (y.hits + y.misses) : null) : null };
    }
    // Deployments in the last 24 h, by project and state (skips show as CANCELED in seconds).
    const deps = (await json(`${API}/v6/deployments?teamId=${teamId}&limit=100&since=${now.getTime() - 86400e3}`, { headers: H })).deployments || [];
    const deployments = {};
    for (const d of deps) { const k = d.name; deployments[k] = deployments[k] || { total: 0, ready: 0, canceled: 0, error: 0, production: 0, buildMinutes: 0 }; deployments[k].total++; if (d.readyState === 'READY') deployments[k].ready++; if (d.readyState === 'CANCELED') deployments[k].canceled++; if (d.readyState === 'ERROR') deployments[k].error++; if (d.target === 'production') deployments[k].production++; if (d.buildingAt && d.ready) deployments[k].buildMinutes += (d.ready - d.buildingAt) / 60000; }
    for (const v of Object.values(deployments)) v.buildMinutes = +v.buildMinutes.toFixed(1);

    return { ok: true, team: team.slug, period: period ? { start: period.start.toISOString().slice(0, 10), end: period.end.toISOString().slice(0, 10), day: dayOfCycle, days: cycleDays } : null, spend: +spend.toFixed(2), listPrice: +listPrice.toFixed(2), spendLastCycleSameDay: spendLastCycleSameDay != null ? +spendLastCycleSameDay.toFixed(2) : null, lastCycleError: lastCycleSameDay?.error ?? null, projected: projected != null ? +projected.toFixed(2) : null, cap, headroom: +(cap - spend).toFixed(2), daysToCap: daysToCap != null ? +daysToCap.toFixed(1) : null, services, lines, yesterday: yesterday ? { date: yesterday.date, total: +yesterday.total.toFixed(2) } : null, dayBefore: dayBefore ? { date: dayBefore.date, total: +dayBefore.total.toFixed(2) } : null, projectRows, traffic, deployments };
  } catch (e) {
    return { ok: false, error: redact(e.message) };
  }
}
