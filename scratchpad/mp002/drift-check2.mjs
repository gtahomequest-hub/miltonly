import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.SOLD_DATABASE_URL);
const r = await sql`SELECT sold_date::date d FROM sold.sold_records WHERE street_slug='gordon-krantz-avenue-milton' AND perm_advertise = TRUE AND transaction_type='For Sale' AND sold_date >= '2025-09-01' AND sold_date < '2025-10-15' ORDER BY 1`;
console.log('gordon-krantz sales Sep to mid-Oct 2025:', r.map(x=>x.d.toISOString().slice(0,10)).join(', ') || 'none');
const h = await sql`SELECT COUNT(*)::int n FROM sold.sold_records WHERE neighbourhood ILIKE '%harrison%' AND perm_advertise = TRUE AND transaction_type='For Sale' AND sold_date >= '2025-09-01' AND sold_date < '2025-09-25'`;
console.log('harrison sales 2025-09-01..24:', JSON.stringify(h));
