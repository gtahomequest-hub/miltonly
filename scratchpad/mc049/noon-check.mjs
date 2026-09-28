// MC-049: after the next 12:00 UTC run, is max(StreetContent.generatedAt) still unchanged?
//   node scratchpad/mc049/noon-check.mjs <target ISO, UTC> <expected max generatedAt>
// Waits until the server's clock (the Date header of miltonly.com) passes the target, then reads the
// database and writes scratchpad/mc049/proof/noon-check.txt.
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const [target, expected] = process.argv.slice(2);
const serverNow = async () => Date.parse((await fetch("https://miltonly.com/api/build", { method: "HEAD" })).headers.get("date"));
while ((await serverNow().catch(() => 0)) < Date.parse(target)) await new Promise((r) => setTimeout(r, 5 * 60_000));
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const [{ m }] = await sql`SELECT to_char(max("generatedAt"),'YYYY-MM-DD"T"HH24:MI:SS.MS') m FROM public."StreetContent"`;
const since = await sql`SELECT "streetSlug" s, to_char("generatedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS') g FROM public."StreetContent" WHERE "generatedAt" > ${expected}::timestamp ORDER BY "generatedAt"`;
const queue = await sql`SELECT status, count(*)::int n FROM public."StreetQueue" GROUP BY 1 ORDER BY 1`;
const build = (await (await fetch("https://miltonly.com/api/build")).json()).commit;
const line = `${new Date(await serverNow()).toISOString()} (server clock), after the ${target} run: max(generatedAt) ${m}, expected ${expected}: ${m === expected ? "UNCHANGED" : "CHANGED"}; rows rewritten since: ${since.length ? since.map((r) => `${r.s} ${r.g}`).join(", ") : "none"}; queue ${queue.map((q) => `${q.status} ${q.n}`).join(", ")}; production ${build.slice(0, 7)}`;
fs.mkdirSync("scratchpad/mc049/proof", { recursive: true });
fs.writeFileSync("scratchpad/mc049/proof/noon-check.txt", line + "\n");
console.log(line);
