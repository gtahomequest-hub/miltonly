import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.SOLD_DATABASE_URL);
const r = await sql`SELECT COUNT(*)::int n, MAX(sold_date)::date latest, MAX(created_at) latest_row FROM sold.sold_records WHERE street_slug='gordon-krantz-avenue-milton' AND perm_advertise = TRUE AND transaction_type='For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`;
console.log('gordon-krantz 12-month sales:', JSON.stringify(r));
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='sold' AND table_name='sold_records' AND column_name IN ('created_at','updated_at','ingested_at','synced_at')`;
console.log('timestamp columns:', cols.map(c=>c.column_name).join(','));
