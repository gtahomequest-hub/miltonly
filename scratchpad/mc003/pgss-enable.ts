import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { neon } from "@neondatabase/serverless";
function loadEnvLocal() { const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8"); for (const line of content.split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
loadEnvLocal();
async function main() {
  for (const [label, url] of [["DB1", process.env.DATABASE_URL], ["DB2", process.env.SOLD_DATABASE_URL]]) {
    const sql = neon((url || "").trim());
    try { await sql`create extension if not exists pg_stat_statements`; console.log(label, "pg_stat_statements enabled"); }
    catch (e) { console.log(label, "enable failed:", (e as Error).message.slice(0, 160)); }
    try { await sql`select pg_stat_statements_reset()`; console.log(label, "stats reset at", new Date().toISOString()); } catch (e) { console.log(label, "reset:", (e as Error).message.slice(0, 120)); }
    const d = await sql`select tup_returned, tup_fetched, blks_hit, blks_read from pg_stat_database where datname=current_database()`;
    console.log(label, "pg_stat_database now:", JSON.stringify(d[0]));
  }
}
main();
