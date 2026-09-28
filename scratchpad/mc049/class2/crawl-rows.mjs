// MC-049: the served HTML of the street pages whose StreetContent row has generatedAt on or after
// 2026-09-24, in the layout MC-045's method reads (<cache>/slugs.json, <cache>/html/<slug>.html).
//   node scratchpad/mc049/class2/crawl-rows.mjs <cacheDir>
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const OUT = process.argv[2];
const rows = await sql`SELECT "streetSlug" s, status, to_char("generatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') g FROM public."StreetContent" WHERE "generatedAt" >= '2026-09-24' ORDER BY "generatedAt"`;
const slugs = rows.filter((r) => r.status === "published").map((r) => r.s);
fs.writeFileSync(`${OUT}/rows.json`, JSON.stringify(rows, null, 1));
fs.writeFileSync(`${OUT}/slugs.json`, JSON.stringify(slugs));
const meta = {};
for (const s of slugs) {
  const r = await fetch(`https://miltonly.com/streets/${s}`, { headers: { "user-agent": "miltonly-verify MC-049" } });
  const h = await r.text();
  fs.writeFileSync(`${OUT}/html/${s}.html`, h);
  meta[s] = { status: r.status, cache: r.headers.get("x-vercel-cache"), bytes: h.length };
}
const build = await (await fetch("https://miltonly.com/api/build")).json();
fs.writeFileSync(`${OUT}/crawl-meta.json`, JSON.stringify({ at: new Date().toISOString(), build: build.commit, meta }, null, 1));
console.log(`rows ${rows.length} (published ${slugs.length}); fetched ${JSON.stringify(meta)}; build ${build.commit.slice(0, 7)}`);
