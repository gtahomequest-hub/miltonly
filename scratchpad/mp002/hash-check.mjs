import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const u = await p.user.findUnique({ where: { email: process.argv[2] }, select: { passwordHash: true, passwordSetAt: true, vowAcknowledgementText: true } });
console.log('hash prefix:', u.passwordHash?.slice(0, 7), 'length:', u.passwordHash?.length, 'setAt:', u.passwordSetAt);
console.log('ack text version 3:', u.vowAcknowledgementText?.includes('my password is mine alone'));
await p.$disconnect();
