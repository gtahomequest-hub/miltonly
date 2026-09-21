import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
function loadEnvLocal(){const f=path.join(ROOT,'.env.local');if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const r = await p.$queryRaw`SELECT "createdAt"::date d, COUNT(*)::int n, COUNT(DISTINCT ip)::int ips, COUNT(DISTINCT "firstName")::int names, MAX("landingPage") lp FROM "Lead" WHERE env='production' AND source='sale-detail' GROUP BY 1 ORDER BY 1`;
const s = await p.$queryRaw`SELECT "firstName", email, "mlsNumber", "landingPage", "userAgent" FROM "Lead" WHERE env='production' AND source='sale-detail' ORDER BY "createdAt" DESC LIMIT 4`;
console.log(JSON.stringify({ r, s }, null, 1));
await p.$disconnect();
