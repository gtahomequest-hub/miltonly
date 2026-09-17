import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { neon } from "@neondatabase/serverless";
function loadEnvLocal() { const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8"); for (const line of content.split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
loadEnvLocal();
async function main() {
  const sql = neon((process.env.DATABASE_URL || "").trim());
  const rows = await sql`select calls, rows, regexp_replace(query, '\s+', ' ', 'g') as q from pg_stat_statements where query like '%"Listing"%' and query not like '%pg_stat%' order by rows desc limit 4`;
  for (const r of rows) console.log(`rows=${r.rows} calls=${r.calls}\n  ${r.q}\n`);
}
main();
