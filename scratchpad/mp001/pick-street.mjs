import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.SOLD_DATABASE_URL);
const rows = await sql`SELECT street_slug, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise = TRUE AND transaction_type='For Sale' AND sold_date >= NOW() - INTERVAL '90 days' AND sold_date <= NOW() GROUP BY 1 ORDER BY 2 DESC LIMIT 12`;
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const pub = await p.streetContent.findMany({ where: { streetSlug: { in: rows.map(r=>r.street_slug) } }, select: { streetSlug: true } });
console.log(rows.map(r => `${r.street_slug} ${r.n} ${pub.find(x=>x.streetSlug===r.street_slug) ? "page" : "no page"}`).join('\n'));
await p.$disconnect();
