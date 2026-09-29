import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const rows = await prisma.lead.findMany({ where: { env: 'production' }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, createdAt: true, source: true, firstName: true, email: true, phone: true, message: true, userAgent: true, ip: true, landingPage: true, mlsNumber: true, consentText: true, activities: { select: { type: true, payload: true, createdAt: true } } } });
for (const r of rows) console.log(JSON.stringify({ ...r, email: (r.email || '').replace(/^(..).*(@.*)$/, '$1…$2'), phone: r.phone ? 'present' : null, ip: r.ip ? 'present' : null, userAgent: (r.userAgent || '').slice(0, 60), consentText: r.consentText ? r.consentText.slice(0, 40) + '…' : null }, null, 0));
await prisma.$disconnect();
