import fs from 'node:fs'; import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,'')]}));
const out = {};
for (const [name, url] of [['db1', env.DATABASE_URL], ['db2', env.SOLD_DATABASE_URL], ['db3', env.ANALYTICS_DATABASE_URL]]) {
  const sql = neon(url);
  try {
    const t = (await sql`SELECT count(*)::int n, sum(calls)::bigint calls, sum(rows)::bigint rows, round(sum(total_exec_time))::bigint ms, sum(shared_blks_hit+shared_blks_read)::bigint blks FROM pg_stat_statements`)[0];
    const top = await sql`SELECT queryid::text id, calls, rows, round(total_exec_time)::bigint ms, left(regexp_replace(query, '\s+', ' ', 'g'), 110) q FROM pg_stat_statements ORDER BY rows DESC LIMIT 40`;
    out[name] = { total: t, top };
  } catch (e) { out[name] = { err: e.message.slice(0, 100) }; }
  console.log(name, JSON.stringify(out[name].total || out[name].err));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
