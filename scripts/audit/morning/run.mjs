#!/usr/bin/env node
// MA-008. The morning report: Money, Traffic, Conversion, The One Thing. One page, one email,
// 06:00 Toronto, from a GitHub runner (no Vercel build minutes).
//
//   node scripts/audit/morning/run.mjs [--no-email] [--out=<dir>]
//
// Reads: VERCEL_API_TOKEN, NEON_API_KEY, GSC_SERVICE_ACCOUNT (a path) or GSC_SERVICE_ACCOUNT_JSON,
// DATABASE_URL, SOLD_DATABASE_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, REPORT_EMAIL_TO. None is ever
// printed. Writes scratchpad/audit/morning/<date>.md and state.json (yesterday's figures, for the
// diff). Exit 0 clean; 2 when a source failed (the report still goes out, saying which); 3 when
// the email failed; 4 when nothing at all could be gathered.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { OUT, CONFIG, RULES, TODAY, YESTERDAY, calls, redact, usd, int, gb, hours, delta, rate, movement, readState, writeState, weekday } from './lib.mjs';
import { gatherVercel } from './sources/vercel.mjs';
import { gatherNeon } from './sources/neon.mjs';
import { gatherGsc } from './sources/gsc.mjs';
import { gatherDb } from './sources/db.mjs';
import { gatherAnalytics } from './sources/analytics.mjs';

const t0 = Date.now();
const NO_EMAIL = process.argv.includes('--no-email');
const outDir = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || OUT;
fs.mkdirSync(outDir, { recursive: true });
const log = (m) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s] ${redact(m)}`);
let sha = ''; try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}

// 1. Gather. Each source answers { ok, ... } and a failure is a line in the report, not a crash.
const prev = readState(outDir);
log(`gathering for ${TODAY} (yesterday ${YESTERDAY})${prev ? `, diffing against ${prev.date}` : ', no previous state'}`);
const [vercel, neon, gsc, db, analytics] = await Promise.all([gatherVercel(), gatherNeon(prev), gatherGsc(), gatherDb(), gatherAnalytics()]);
for (const [k, v] of Object.entries({ vercel, neon, gsc, db, analytics })) log(`${k}: ${v.ok ? 'ok' : `FAILED ${v.error}`}`);
if (![vercel, neon, gsc, db].some((s) => s.ok)) { console.error('nothing gathered'); process.exit(4); }

// 2. Compute the derived figures every section and every rule reads.
const facts = { date: TODAY, money: {}, traffic: {}, conversion: {}, content: {} };
// Money
facts.money.vercel = vercel.ok ? vercel : null;
facts.money.neon = neon.ok ? neon : null;
facts.money.lines = vercel.ok ? vercel.lines : [];
const spendMtd = (vercel.ok ? vercel.spend : 0) + (neon.ok ? neon.miltonlyUsd : 0);
// Traffic
const latest = gsc.ok ? gsc.latest : null;
facts.traffic.gsc = gsc.ok ? gsc : null;
facts.traffic.queries28 = gsc.ok ? gsc.queries28 : [];
// Conversion: the 28-day page table, GSC clicks joined to DB1 leads by landing path.
const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; } };
facts.conversion.pages28 = gsc.ok && db.ok ? gsc.pages28.map((p) => ({ page: pathOf(p.page), clicks: p.clicks, impressions: p.impressions, position: p.position, leads: db.leads28ByPath[pathOf(p.page)] ?? 0 })).sort((a, b) => b.clicks - a.clicks) : [];
facts.conversion.leads = db.ok ? db : null;
facts.content.streetsWithoutPage = db.ok ? db.streetsWithoutPage : [];
// The denominator for cost per visit: sessions when analytics answers, GSC clicks until then, and the report says which.
const sessionsMtd = analytics.sessions ?? null;
const visitDenominator = sessionsMtd != null ? { n: sessionsMtd, label: 'sessions (Web Analytics)' } : gsc.ok ? { n: gsc.mtd.clicks, label: 'GSC clicks, month to date (sessions awaiting first data)' } : null;
const costPerVisit = visitDenominator && visitDenominator.n > 0 ? spendMtd / visitDenominator.n : null;

// 3. The One Thing: rules as data.
const get = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const ops = { gte: (a, b) => a >= b, gt: (a, b) => a > b, lte: (a, b) => a <= b, lt: (a, b) => a < b, eq: (a, b) => a === b, ne: (a, b) => a !== b, between: (a, [lo, hi]) => a >= lo && a <= hi };
const ready = { vercel: vercel.ok, neon: neon.ok, gsc: gsc.ok, db: db.ok };
const actions = [];
for (const r of RULES.rules) {
  if (r.needs && !ready[r.needs]) continue;
  const rows = get(facts, r.source) || [];
  const pass = rows.filter((row) => Object.entries(r.where).every(([f, cond]) => Object.entries(cond).every(([op, v]) => row[f] != null && ops[op](row[f], v))));
  if (!pass.length) continue;
  const [mode, field] = Object.entries(r.pick)[0];
  const pick = pass.reduce((best, row) => (best == null || (mode === 'max' ? row[field] > best[field] : row[field] < best[field]) ? row : best), null);
  // A field named ...Usd prints as money; any other non-integer prints to one decimal.
  actions.push({ id: r.id, rank: r.rank, text: r.say.replace(/\{(\w+)\}/g, (_, k) => (/Usd$/.test(k) ? usd(pick[k]) : typeof pick[k] === 'number' && !Number.isInteger(pick[k]) ? pick[k].toFixed(1) : pick[k] ?? '?')) });
}
actions.sort((a, b) => a.rank - b.rank);
const top3 = actions.slice(0, 3);

// 4. Render: one page of markdown, and the same page as email HTML.
const L = [];
const failed = Object.entries({ vercel, neon, gsc, db }).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.error}`);
L.push(`# Morning report ${TODAY}`);
L.push(`${weekday(TODAY)} · report code ${sha || '?'} · yesterday ${YESTERDAY}${prev ? (prev.date === TODAY ? ' · rerun, diffed against this morning' : ` · diffed against ${prev.date}`) : ' · first run, nothing to diff'}${failed.length ? ` · **sources failed: ${failed.join('; ')}**` : ''}`);
L.push('');
L.push('## 1 · Money');
if (vercel.ok) {
  const v = vercel; const pv = prev?.vercel;
  L.push(`- **Vercel on-demand, cycle to date: ${usd(v.spend)}** (list ${usd(v.listPrice)}), day ${v.period?.day} of ${v.period?.days} (${v.period?.start} to ${v.period?.end}); ${pv ? `${delta(v.spend, pv.spend, { pct: false })} since yesterday's report; ` : ''}same day last cycle ${v.spendLastCycleSameDay != null ? usd(v.spendLastCycleSameDay) : 'n/a'}.`);
  const capRisk = v.daysToCap != null && v.daysLeft != null && v.daysToCap <= v.daysLeft;
  L.push(`- Projected month end **${usd(v.projected)}** (${usd(v.spend)} so far plus ${usd(v.dailyRate)} a day, the last seven days' rate, for ${v.daysLeft} more days); headroom ${usd(v.headroom)} against the ${usd(v.cap, 0)} cap; ${capRisk ? `**at this rate the cap is crossed in ${v.daysToCap === 0 ? 'already crossed' : `${v.daysToCap} days`}, inside the cycle**` : `no cap risk this cycle (${v.daysToCap != null ? `${v.daysToCap} days to the cap at this rate, ${v.daysLeft} left` : 'rate unknown'})`}.`);
  const top = v.services[0]; const topLine = v.lines.find((l) => l.name === top?.name);
  if (top) L.push(`- Biggest driver: **${top.name} ${usd(top.usd)}** this cycle${topLine ? `; yesterday ${usd(topLine.todayUsd)} vs ${usd(topLine.prevUsd)} the day before (${delta(topLine.todayUsd, topLine.prevUsd)})` : ''}. Yesterday's total ${v.yesterday ? usd(v.yesterday.total) : 'n/a'}${v.dayBefore ? ` vs ${usd(v.dayBefore.total)}` : ''}.`);
  L.push(`- By project: ${v.projectRows.map((p) => `${p.name} ${usd(p.usd)}`).join(' · ')}.`);
  const mt = v.traffic.miltonly; if (mt?.yesterday) L.push(`- miltonly yesterday (UTC): ${int(mt.yesterday.hits + mt.yesterday.misses)} edge requests, **${mt.cachedShare != null ? Math.round(mt.cachedShare * 100) : '?'}% cached**, ${int(mt.yesterday.invocations)} function invocations, ${mt.yesterday.gbHours.toFixed(1)} GB-h; ${mt.builds ? `${mt.builds.builds} builds, ${(mt.builds.seconds / 60).toFixed(0)} build min` : 'no builds'}. Deployments 24 h: ${Object.entries(v.deployments).map(([k, d]) => `${k} ${d.ready} ready/${d.canceled} skipped`).join(', ') || 'none'}.`);
} else L.push(`- Vercel: source failed (${vercel.error}).`);
if (neon.ok) {
  const n = neon;
  L.push(`- **Neon, month to date**: ${n.projects.filter((p) => /Miltonly DB/.test(p.label)).map((p) => `${p.label.split(' (')[0]} ${hours(p.computeHours * 3600)} compute${p.computeHoursDelta != null ? ` (+${p.computeHoursDelta} h since yesterday)` : ''}, ${gb(p.egressBytes)} egress (${Math.round(p.egressShareOfAllowance * 100)}% of ${CONFIG.neon.egressAllowanceGbPerProject} GB)`).join('; ')}. Estimated Miltonly share **${usd(n.miltonlyUsd)}** of ${n.orgRows.map((o) => `${usd(o.estimatedUsd)} (${o.org}, ${o.computeHours} CU-h)`).join(' + ')}; pricing assumed: ${n.pricingAssumed}.`);
  L.push(`- Every Neon project this key sees, by what reads it: ${n.projects.map((p) => `${p.id.split('-').slice(0, 2).join('-')} = ${p.label.split(' (')[0]} ${p.computeHours} CU-h/${gb(p.egressBytes)}`).join(' · ')}. A project with no reader named here is unknown, not unused.`);
} else L.push(`- Neon: source failed (${neon.error}).`);
L.push(`- **Cost per visit: ${costPerVisit != null ? usd(costPerVisit, 3) : 'n/a'}** = (${usd(vercel.ok ? vercel.spend : 0)} Vercel + ${usd(neon.ok ? neon.miltonlyUsd : 0)} Neon, month to date) ÷ ${visitDenominator ? `${int(visitDenominator.n)} ${visitDenominator.label}` : 'no denominator'}.`);
L.push('');
L.push('## 2 · Traffic');
if (gsc.ok && latest) {
  const g = gsc;
  const mv = movement(latest.clicks, g.sameWeekdayLastWeek?.clicks);
  L.push(`- **GSC, ${latest.date} (${latest.weekday}, the latest day Google has, ${g.lagDays} days behind): ${int(latest.clicks)} clicks, ${int(latest.impressions)} impressions**, position ${latest.position.toFixed(1)}. 7-day average ${g.avg7 ? `${g.avg7.clicks.toFixed(1)} clicks / ${int(g.avg7.impressions)} impressions` : 'n/a'}; same weekday last week ${g.sameWeekdayLastWeek ? `${g.sameWeekdayLastWeek.clicks} / ${int(g.sameWeekdayLastWeek.impressions)}` : 'n/a'}: ${mv.text}.`);
  L.push(`- Top pages that day: ${g.pagesDay.length ? g.pagesDay.map((p) => `${pathOf(p.page)} ${p.clicks}c/${p.impressions}i @${p.position}`).join(' · ') : 'none'}.`);
  L.push(`- New queries (28 d vs the 28 before): ${g.newQueries.length ? g.newQueries.map((q) => `"${q.query}" ${q.impressions}i @${q.position}`).join(' · ') : 'none above the floor'}.`);
  L.push(`- Fell out of the top 10 this week: ${g.fellOut.length ? g.fellOut.map((p) => `${pathOf(p.page)} ${p.from}→${p.to}`).join(' · ') : 'none (needs 10 impressions both weeks)'}.`);
  const h = g.hosts; const tot = h.apex.impressions + h.www.impressions + h.other.impressions;
  L.push(`- www vs apex, 28 d impressions: apex ${int(h.apex.impressions)} (${tot ? Math.round((h.apex.impressions / tot) * 100) : 0}%) · www ${int(h.www.impressions)} (${tot ? Math.round((h.www.impressions / tot) * 100) : 0}%)${h.other.impressions ? ` · other ${int(h.other.impressions)}` : ''}.`);
} else L.push(`- GSC: ${gsc.ok ? gsc.note : `source failed (${gsc.error})`}.`);
L.push(`- Googlebot / oai-searchbot requests: ${analytics.bots.status}.`);
L.push(`- **Web Analytics: ${analytics.status}**${analytics.note ? ` (${analytics.note})` : ''}. Sessions ${analytics.sessions ?? 'n/a'} · bounce ${analytics.bounce ?? 'n/a'} · referrers ${analytics.referrers.length ? analytics.referrers.map((r) => JSON.stringify(r)).join(', ') : 'n/a'} · **AI-search referrers: ${analytics.aiReferrers.length ? analytics.aiReferrers.map((r) => JSON.stringify(r)).join(', ') : (analytics.status === 'first data' ? 'none' : 'awaiting first data')}**.`);
const imp = gsc.ok ? gsc.d28.impressions : null, clk = gsc.ok ? gsc.d28.clicks : null, leads28 = db.ok ? db.leads28Unpaid : null;
L.push(`- Funnel, 28 d: impressions ${int(imp)} → clicks ${int(clk)} (${imp ? ((clk / imp) * 100).toFixed(1) : '?'}%) → sessions awaiting first data → engaged awaiting first data → leads ${int(leads28)} not ad-attributed (${clk != null && leads28 != null ? rate(leads28, clk, 'clicks') : 'n/a'}; ${db.ok ? db.leads28 : '?'} leads in all, ${db.ok ? db.leads28 - db.leads28Unpaid : '?'} carrying a gclid or utm_source).`);
L.push('');
L.push('## 3 · Conversion');
if (db.ok) {
  L.push(`- **Leads yesterday: ${db.leadsYesterdayTotal}**${db.leadsYesterday.length ? ` · ${db.leadsYesterday.map((l) => `${l.n} ${l.source} (${l.intent}) from ${l.landing || 'no landing page'}`).join(' · ')}` : ''}. Last 7 days ${db.leads7}; month to date ${db.leadsMtd}.`);
  const expected = gsc.ok && gsc.avg7 ? gsc.avg7.clicks * 0.02 : null;
  L.push(`- Clicks → leads, 28 d, ad-attributed leads excluded: ${clk != null && leads28 != null ? rate(leads28, clk, 'clicks') : 'n/a'}. At ~${gsc.ok && gsc.avg7 ? gsc.avg7.clicks.toFixed(0) : '?'} clicks a day and a 1 to 3% rate the expected daily count is ${expected != null ? `${(expected / 2).toFixed(1)} to ${(expected * 1.5).toFixed(1)}` : '?'}, so a zero day is the normal result, not a fault.`);
  const backlog = db.streetsWithoutPage;
  L.push(`- **Streets with sales in 90 days and no published page: ${backlog.length}**${db.soldRead ? '' : ' (DB2 not read)'}${backlog.length ? `, by sales: ${backlog.map((s) => `${s.street} ${s.sales90}`).join(' · ')}` : ''}. Each is a page the sold record already justifies.`);
  const zero = facts.conversion.pages28.filter((p) => p.leads === 0)[0];
  L.push(`- Highest-traffic page with zero leads, 28 d: ${zero ? `**${zero.page}** (${zero.clicks} clicks, ${int(zero.impressions)} impressions)` : 'none, or no GSC page table'}.`);
} else L.push(`- DB1: source failed (${db.error}).`);
L.push('');
L.push('## 4 · The one thing');
if (top3.length) top3.forEach((a, i) => L.push(`${i + 1}. ${a.text} _(rule ${a.id})_`)); else L.push('- No rule fired above its floor today.');
L.push('');
// 5. Running cost.
const minutes = (Date.now() - t0) / 60000;
const runnerUsd = process.env.GITHUB_ACTIONS ? minutes * CONFIG.runnerCost.usdPerMinute : 0;
const costLine = `This report: ${calls.n} API calls (${Object.entries(calls.byHost).map(([h, n]) => `${h.replace('.googleapis.com', '').replace('api.', '')} ${n}`).join(', ')}), ${minutes.toFixed(1)} runner minutes, one email; ${process.env.GITHUB_ACTIONS ? `about ${usd(runnerUsd, 3)} of GitHub minutes beyond the free ${CONFIG.runnerCost.freeMinutesPerMonth}, $0 to Vercel, Neon, Google or Resend` : 'run by hand, $0'}.`;
L.push(`_${costLine}_`);
const md = L.join('\n');
const mdPath = path.join(outDir, `${TODAY}.md`);
fs.writeFileSync(mdPath, md + '\n');
log(`report ${path.relative(process.cwd(), mdPath)} (${md.length} chars, ${L.length} lines)`);

// 6. State for tomorrow's diff.
writeState({ date: TODAY,  vercel: vercel.ok ? { spend: vercel.spend, projected: vercel.projected, yesterday: vercel.yesterday } : prev?.vercel ?? null, neon: neon.ok ? { projects: neon.projects.map((p) => ({ id: p.id, computeHours: p.computeHours, egressBytes: p.egressBytes })) } : prev?.neon ?? null, gsc: gsc.ok && latest ? { latest } : prev?.gsc ?? null, leads: db.ok ? { yesterday: db.leadsYesterdayTotal, mtd: db.leadsMtd } : prev?.leads ?? null, actions: top3.map((a) => a.id) }, outDir);

// 7. Email, through Resend, to the desk.
if (!NO_EMAIL) {
  const key = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM_EMAIL; const to = process.env.REPORT_EMAIL_TO || CONFIG.desk;
  if (!key || !from) { console.error('RESEND_API_KEY or RESEND_FROM_EMAIL unset; no email'); process.exitCode = 3; }
  else {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
    const html = `<div style="font:14px/1.45 Inter,system-ui,sans-serif;color:#1a1a1a;background:#f6f4ef;padding:16px"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;padding:18px 20px">` + L.map((l) => l.startsWith('# ') ? `<h2 style="font:600 20px/1.2 Fraunces,Georgia,serif;color:#073126;margin:0 0 4px">${esc(l.slice(2))}</h2>` : l.startsWith('## ') ? `<h3 style="font:600 15px/1.3 Inter,system-ui,sans-serif;color:#017848;margin:16px 0 4px">${esc(l.slice(3))}</h3>` : l.startsWith('- ') ? `<p style="margin:0 0 6px">${inline(l.slice(2))}</p>` : /^\d+\. /.test(l) ? `<p style="margin:0 0 6px;padding-left:8px">${inline(l)}</p>` : l ? `<p style="margin:0 0 6px;color:#444">${inline(l)}</p>` : '').join('') + `</div></div>`;
    const subject = `Miltonly morning ${TODAY}: ${vercel.ok ? `${usd(vercel.spend, 0)} Vercel` : 'Vercel n/a'} · ${gsc.ok && latest ? `${latest.clicks} clicks (${latest.date})` : 'GSC n/a'} · ${db.ok ? `${db.leadsYesterdayTotal} lead${db.leadsYesterdayTotal === 1 ? '' : 's'}` : 'leads n/a'}${failed.length ? ` · ${failed.length} source${failed.length === 1 ? '' : 's'} failed` : ''}`;
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html, text: md }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.error(`email failed ${r.status}: ${redact(JSON.stringify(j)).slice(0, 200)}`); process.exitCode = 3; }
      else { log(`email ${j.id} to ${to}`); fs.appendFileSync(mdPath, `\nEmail \`${j.id}\` to ${to}, subject "${subject}".\n`); }
    } catch (e) { console.error(`email failed: ${redact(e.message)}`); process.exitCode = 3; }
  }
}
if (failed.length && !process.exitCode) process.exitCode = 2;
log(`done in ${Math.round((Date.now() - t0) / 1000)} s, ${calls.n} calls, exit ${process.exitCode || 0}`);
