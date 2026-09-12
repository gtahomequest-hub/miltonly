import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { neon } from "@neondatabase/serverless";
function loadEnvLocal() { const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8"); for (const line of content.split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
loadEnvLocal();
async function main() {
  for (const [label, url] of [["DB1", process.env.DATABASE_URL], ["DB2", process.env.SOLD_DATABASE_URL]]) {
    const sql = neon((url || "").trim());
    console.log(`\n== ${label}`);
    const widths = await sql`select c.relname, c.reltuples::bigint as rows, case when c.reltuples > 0 then (c.relpages::bigint*8192/c.reltuples)::int else 0 end as avg_width from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','sold','analytics') and c.relkind='r' and c.reltuples > 100 order by c.relpages desc limit 8`;
    console.log("  table widths:", widths.map((w) => `${w.relname}:${w.avg_width}B×${w.rows}`).join("  "));
    const rows = await sql`select calls, rows, round(total_exec_time)::bigint as ms, shared_blks_hit+shared_blks_read as blks, left(regexp_replace(query, '\s+', ' ', 'g'), 170) as q from pg_stat_statements where query not like '%pg_stat%' order by rows desc limit 12`;
    for (const r of rows) console.log(`   rows=${String(r.rows).padStart(9)} calls=${String(r.calls).padStart(6)} rows/call=${String(Math.round(Number(r.rows)/Number(r.calls))).padStart(6)} blks=${String(r.blks).padStart(8)}  ${r.q}`);
    const tot = await sql`select sum(rows)::bigint as rows, sum(calls)::bigint as calls, round(sum(total_exec_time))::bigint as ms from pg_stat_statements where query not like '%pg_stat%'`;
    console.log("  totals since reset:", JSON.stringify(tot[0]));
  }
}
main();
