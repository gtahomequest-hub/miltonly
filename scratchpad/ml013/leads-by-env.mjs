import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const sep = new Date('2026-09-01T04:00:00Z');
const byEnv = await prisma.lead.groupBy({ by: ['env'], where: { createdAt: { gte: sep } }, _count: true });
console.log('September leads by env (all rows):', byEnv.map((e) => `${e.env} ${e._count}`).join(' | ') || '(none)');
const bySrc = await prisma.lead.groupBy({ by: ['source', 'env'], where: { createdAt: { gte: sep } }, _count: true });
console.log('September by source/env:', bySrc.map((e) => `${e.source}/${e.env} ${e._count}`).join(' | ') || '(none)');
const total = await prisma.lead.count(); const prod = await prisma.lead.count({ where: { env: 'production' } });
console.log(`all-time rows: ${total}, production: ${prod}`);
const aug = await prisma.lead.count({ where: { env: 'production', createdAt: { gte: new Date('2026-08-01T04:00:00Z'), lt: sep } } });
console.log(`August production leads: ${aug}`);
const users = await prisma.user.count({ where: { createdAt: { gte: sep } } });
const watches = await prisma.savedSearch.count({ where: { createdAt: { gte: sep } } });
console.log(`September User rows: ${users}, SavedSearch rows: ${watches}`);
const acts = await prisma.leadActivity.groupBy({ by: ['type'], where: { createdAt: { gte: sep } }, _count: true });
console.log('September LeadActivity by type:', acts.map((a) => `${a.type} ${a._count}`).join(' | ') || '(none)');
await prisma.$disconnect();
