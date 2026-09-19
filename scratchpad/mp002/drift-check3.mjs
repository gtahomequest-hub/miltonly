import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.SOLD_DATABASE_URL);
const r = await sql`SELECT street_slug, COUNT(*)::int n FROM sold.sold_records WHERE street_slug LIKE 'gordon-krantz%' AND perm_advertise = TRUE AND transaction_type='For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW() GROUP BY 1`;
console.log(JSON.stringify(r));
const a = await sql`SELECT sold_count_12months FROM analytics.street_sold_stats WHERE street_slug='gordon-krantz-avenue-milton'`;
console.log('DB3 aggregate:', JSON.stringify(a));
