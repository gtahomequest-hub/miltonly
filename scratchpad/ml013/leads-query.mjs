// ML-013 evidence, read only: the last 15 production leads, the month-to-date count, the last
// non-ad lead, leads with a gclid per day over 28 days, and the ads-lead table if it has rows.
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; }
}
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const now = new Date();
const tor = (d) => new Date(d).toLocaleString('en-CA', { timeZone: 'America/Toronto', hour12: false }).replace(',', '');
const kind = (l) => (l.gclid || l.gclidLast) ? 'gclid' : (l.utmSource || l.utmSourceLast) ? `utm:${l.utmSource || l.utmSourceLast}/${l.utmMedium || l.utmMediumLast || ''}` : 'organic';
const sel = { id: true, createdAt: true, source: true, landingPage: true, firstPage: true, referrer: true, gclid: true, gclidLast: true, utmSource: true, utmMedium: true, utmSourceLast: true, utmMediumLast: true, env: true, email: true, firstName: true, intent: true, score: true };
const last15 = await prisma.lead.findMany({ where: { env: 'production' }, orderBy: { createdAt: 'desc' }, take: 15, select: sel });
console.log('LAST 15 PRODUCTION LEADS (Toronto time)');
for (const l of last15) console.log(`${tor(l.createdAt)}  ${l.source.padEnd(28)}  ${kind(l).padEnd(22)}  ${(l.landingPage || l.firstPage || '-').slice(0, 40).padEnd(40)}  ${(l.email || '').replace(/^(..).*(@.*)$/, '$1…$2')}`);
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const mtd = await prisma.lead.count({ where: { env: 'production', createdAt: { gte: monthStart } } });
const mtdTor = await prisma.lead.count({ where: { env: 'production', createdAt: { gte: new Date('2026-09-01T04:00:00Z') } } });
const last7 = await prisma.lead.count({ where: { env: 'production', createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } } });
const lastAny = last15[0];
const lastNonAd = await prisma.lead.findFirst({ where: { env: 'production', gclid: null, gclidLast: null, utmSource: null, utmSourceLast: null }, orderBy: { createdAt: 'desc' }, select: sel });
const lastAd = await prisma.lead.findFirst({ where: { env: 'production', OR: [{ gclid: { not: null } }, { gclidLast: { not: null } }, { utmSource: { not: null } }] }, orderBy: { createdAt: 'desc' }, select: sel });
console.log(`\nmonth to date (UTC month): ${mtd}; since 2026-09-01 00:00 Toronto: ${mtdTor}; last 7 days: ${last7}`);
console.log(`last lead of any kind: ${lastAny ? tor(lastAny.createdAt) + ' ' + lastAny.source + ' ' + kind(lastAny) : 'none'}`);
console.log(`last non-ad lead: ${lastNonAd ? tor(lastNonAd.createdAt) + ' ' + lastNonAd.source + ' page ' + (lastNonAd.landingPage || lastNonAd.firstPage || '-') : 'none'}`);
console.log(`last ad lead: ${lastAd ? tor(lastAd.createdAt) + ' ' + lastAd.source + ' ' + kind(lastAd) : 'none'}`);
const since28 = new Date(now.getTime() - 28 * 86400000);
const rows = await prisma.lead.findMany({ where: { env: 'production', createdAt: { gte: since28 } }, select: { createdAt: true, gclid: true, gclidLast: true, utmSource: true, utmSourceLast: true, source: true, firstVisitAt: true } });
const byDay = {};
for (const r of rows) { const d = new Date(r.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); byDay[d] ??= { leads: 0, gclid: 0, utm: 0, organic: 0 }; byDay[d].leads++; byDay[d][kind(r).startsWith('gclid') ? 'gclid' : kind(r).startsWith('utm') ? 'utm' : 'organic']++; }
console.log('\nLEADS PER DAY, LAST 28 DAYS (Toronto): day  leads  gclid  utm  organic');
for (let i = 27; i >= 0; i--) { const d = new Date(now.getTime() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); const b = byDay[d] || { leads: 0, gclid: 0, utm: 0, organic: 0 }; console.log(`${d}  ${String(b.leads).padStart(3)}  ${String(b.gclid).padStart(3)}  ${String(b.utm).padStart(3)}  ${String(b.organic).padStart(3)}`); }
const bySource = await prisma.lead.groupBy({ by: ['source'], where: { env: 'production', createdAt: { gte: since28 } }, _count: true, orderBy: { _count: { source: 'desc' } } });
console.log('\nBY SOURCE, 28 DAYS:', bySource.map((s) => `${s.source} ${s._count}`).join(' | '));
const ads = await prisma.adsLead.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }).catch((e) => `adsLead error: ${e.message}`);
console.log('\nADS LEAD TABLE, newest 5:', Array.isArray(ads) ? ads.map((a) => `${tor(a.createdAt)} ${JSON.stringify(a).slice(0, 120)}`).join('\n  ') || '(empty)' : ads);
const acts = await prisma.leadActivity.groupBy({ by: ['type'], where: { createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } }, _count: true });
console.log('\nLEAD ACTIVITY, LAST 7 DAYS:', acts.map((a) => `${a.type} ${a._count}`).join(' | ') || '(none)');
const envs = await prisma.lead.groupBy({ by: ['env'], where: { createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } }, _count: true });
console.log('LEADS BY ENV, LAST 7 DAYS:', envs.map((a) => `${a.env} ${a._count}`).join(' | ') || '(none)');
fs.writeFileSync('scratchpad/ml013/leads-query.json', JSON.stringify({ last15, mtd, mtdTor, last7, lastNonAd, lastAd, byDay, bySource }, null, 1));
await prisma.$disconnect();
