import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { neon } from "@neondatabase/serverless";
function loadEnvLocal() { const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8"); for (const line of content.split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
loadEnvLocal();
const read = async (url: string) => (await neon(url.trim())`select tup_returned::bigint as r, tup_fetched::bigint as f from pg_stat_database where datname=current_database()`)[0];
async function main() {
  const db1 = process.env.DATABASE_URL!, db2 = process.env.SOLD_DATABASE_URL!;
  const a1 = await read(db1), a2 = await read(db2);
  const pages = process.argv.slice(2);
  for (const p of pages) await fetch(`https://miltonly.com${p}`, { cache: "no-store" });
  const b1 = await read(db1), b2 = await read(db2);
  console.log(`${pages.length} render(s) ${pages.join(" ")}: DB1 tup_returned +${Number(b1.r) - Number(a1.r)} tup_fetched +${Number(b1.f) - Number(a1.f)} | DB2 tup_returned +${Number(b2.r) - Number(a2.r)} tup_fetched +${Number(b2.f) - Number(a2.f)}`);
}
main();
