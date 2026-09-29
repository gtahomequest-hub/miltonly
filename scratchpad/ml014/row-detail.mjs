import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/); if (m && !process.env[m[1]]) { let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const r = await prisma.lead.findUnique({ where: { id: 'cmulwlmk100001ktawhv3ypf3' }, select: { source: true, env: true, intent: true, firstName: true, phone: true, email: true, message: true, notes: true, landingPage: true, firstPage: true, referrer: true, street: true, mlsNumber: true, consentText: true, consentTimestamp: true, score: true, utmSource: true, gclid: true } });
console.log(JSON.stringify({ ...r, consentText: r?.consentText?.slice(0, 50) + '…' }, null, 0));
await prisma.$disconnect();
