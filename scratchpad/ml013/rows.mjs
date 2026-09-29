// ML-013: the rows a test submission wrote, by the +ml013 tag. `node rows.mjs` lists; `node rows.mjs --apply` deletes
// every test row (Lead with its LeadActivity, SavedSearch, User with its consents and access logs) and lists what it deleted.
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const TAGARG = process.argv.find((a) => a.startsWith('--tag='));
const TASK = TAGARG ? TAGARG.slice(6) : 'ml013';
const TAG = `gtahomequest+${TASK}`;
const since = new Date('2026-09-28T00:00:00Z');
const leads = await prisma.lead.findMany({ where: { email: { startsWith: TAG }, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, source: true, env: true, email: true, phone: true, firstName: true, street: true, yourHomeAddress: true, consentText: true, landingPage: true, userAgent: true, activities: { select: { type: true, payload: true } } } });
const phoneLeads = await prisma.lead.findMany({ where: { firstName: { startsWith: TASK.toUpperCase() }, createdAt: { gte: since } }, select: { id: true, createdAt: true, source: true, env: true, email: true, phone: true, firstName: true, activities: { select: { type: true, payload: true } } } });
const all = [...leads, ...phoneLeads.filter((p) => !leads.some((l) => l.id === p.id))];
console.log(`LEADS (${all.length}):`);
for (const l of all) console.log(`  ${l.createdAt.toISOString()} ${l.env} ${l.source.padEnd(24)} ${l.email ?? '(no email)'} ${l.phone ? 'phone' : ''} consent:${l.consentText ? 'yes' : 'no'} page:${l.landingPage ?? '-'} ua:${(l.userAgent || '').slice(0, 30)} | ${l.activities.map((a) => `${a.type}:${a.payload.kind}${a.payload.resendId ? ' ' + a.payload.resendId : ''}${a.payload.error ? ' ' + a.payload.error : ''}`).join(', ') || 'no delivery rows'}`);
const watches = await prisma.savedSearch.findMany({ where: { email: { startsWith: TAG }, createdAt: { gte: since } }, select: { id: true, createdAt: true, email: true, name: true, env: true, alertEnabled: true } }).catch(async () => prisma.savedSearch.findMany({ where: { createdAt: { gte: since } }, take: 20 }));
console.log(`WATCHES (${watches.length}):`); for (const w of watches) console.log(`  ${w.createdAt?.toISOString?.()} ${w.env ?? ''} ${w.name ?? ''} ${w.email ?? ''} alert:${w.alertEnabled}`);
const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true, createdAt: true, email: true, verified: true, verifyCode: true, verifyTokenHash: true, passwordHash: true, consentText: true } });
console.log(`USERS (${users.length}):`); for (const u of users) console.log(`  ${u.createdAt.toISOString()} ${u.email} verified:${u.verified} code:${u.verifyCode ? 'set' : '-'} token:${u.verifyTokenHash ? 'set' : '-'} password:${u.passwordHash ? 'set' : '-'}`);
if (APPLY) {
  const la = await prisma.leadActivity.deleteMany({ where: { leadId: { in: all.map((l) => l.id) } } });
  const ld = await prisma.lead.deleteMany({ where: { id: { in: all.map((l) => l.id) } } });
  const wd = await prisma.savedSearch.deleteMany({ where: { id: { in: watches.map((w) => w.id) } } });
  const ud = await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  console.log(`DELETED: leadActivity ${la.count}, lead ${ld.count}, savedSearch ${wd.count}, user ${ud.count}`);
}
await prisma.$disconnect();
