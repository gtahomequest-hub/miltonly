import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
function loadEnvLocal(){const f=path.join(ROOT,'.env.local');if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const u = await p.$queryRaw`SELECT date_trunc('month', "createdAt")::date AS m, COUNT(*)::int n, COUNT("verifyCode")::int with_code, COUNT("firstName")::int with_name, COUNT(phone)::int with_phone FROM "User" GROUP BY 1 ORDER BY 1`;
const l = await p.$queryRaw`SELECT source, COUNT(*)::int n, MIN("createdAt")::date first, MAX("createdAt")::date last, COUNT("consentText")::int consent FROM "Lead" WHERE env='production' GROUP BY 1 ORDER BY 2 DESC`;
const lr = await p.$queryRaw`SELECT MIN("createdAt")::date first, MAX("createdAt")::date last FROM "Lead" WHERE env='production'`;
const ov = await p.$queryRaw`SELECT l.source, COUNT(*)::int n FROM "User" u JOIN "Lead" l ON lower(l.email)=u.email GROUP BY 1 ORDER BY 2 DESC`;
console.log(JSON.stringify({ u, l, lr, ov }, null, 1));
await p.$disconnect();
