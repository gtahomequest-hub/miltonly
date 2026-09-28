import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const u = await p.user.update({ where: { email: process.argv[2] }, data: { passwordHash: null, passwordSetAt: null }, select: { email: true, vowAcknowledgedAt: true, passwordHash: true } });
console.log('password nulled, acknowledgement kept:', JSON.stringify(u));
await p.$disconnect();
