import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
function loadEnvLocal(){const f=path.join(ROOT,'.env.local');if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const r = await p.$queryRaw`SELECT u.email, u."createdAt" u_at, l."createdAt" l_at, l.source FROM "User" u JOIN "Lead" l ON lower(l.email)=u.email ORDER BY u."createdAt" DESC LIMIT 5`;
const bot = await p.$queryRaw`SELECT COUNT(*)::int n FROM "User" WHERE email ~ '\.\w\.\w' OR email ~ '\.\.'`;
console.log(JSON.stringify({ r, bot }, null, 1));
await p.$disconnect();
