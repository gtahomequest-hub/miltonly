// scripts/test-www-redirect.ts, MC-049: www.miltonly.com goes to the apex, by one permanent rule, and
// nothing else in the app keys on the host.
//
// THE RULE LIVES IN TWO PLACES, ON PURPOSE. The Vercel project redirects www.miltonly.com to
// miltonly.com with a 308 at the domain layer (read from the project's domain settings on
// 2026-09-28, MC-049), and next.config.mjs pins the same rule in code (f429b6a, 2026-09-02) so a
// dashboard edit cannot remove it unseen. This test holds the code half:
//   - exactly ONE redirect carries a host condition, and it is www.miltonly.com;
//   - that rule is /:path* -> https://miltonly.com/:path*, permanent (Next answers 308), with no
//     query in the destination, so Next carries the request's query across intact;
//   - nothing touches the apex: no redirect, rewrite or header rule conditions on miltonly.com, no
//     destination points at www or at another origin, vercel.json declares no redirects, and the
//     middleware reads no host.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Cond = { type: string; key?: string; value?: string };
type Rule = { source: string; destination?: string; permanent?: boolean; statusCode?: number; has?: Cond[]; missing?: Cond[]; basePath?: boolean };

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(msg);
}
const hostConds = (r: Rule) => [...(r.has ?? []), ...(r.missing ?? [])].filter((c) => c.type === "host");

async function main() {
  const cfg = (await import(pathToFileURL(path.resolve("next.config.mjs")).href)).default as {
    redirects?: () => Promise<Rule[]>;
    rewrites?: () => Promise<Rule[] | { beforeFiles?: Rule[]; afterFiles?: Rule[]; fallback?: Rule[] }>;
    headers?: () => Promise<Rule[]>;
  };
  ok(typeof cfg.redirects === "function", "next.config.mjs declares redirects()");
  const redirects = cfg.redirects ? await cfg.redirects() : [];

  // exactly one host rule, and it is www
  const hostRules = redirects.filter((r) => hostConds(r).length > 0);
  ok(hostRules.length === 1, `exactly one redirect conditions on the host (found ${hostRules.length})`);
  const www = hostRules[0];
  if (www) {
    const conds = hostConds(www);
    ok(conds.length === 1 && conds[0].value === "www.miltonly.com" && (www.has ?? []).includes(conds[0]), `the host rule is has: host www.miltonly.com (${JSON.stringify(conds)})`);
    ok((www.has ?? []).length === 1 && !(www.missing ?? []).length, "the host rule has no other condition");
    ok(www.source === "/:path*", `the host rule takes every path (${www.source})`);
    ok(www.destination === "https://miltonly.com/:path*", `the host rule lands on the same path at the apex (${www.destination})`);
    ok(www.permanent === true && www.statusCode === undefined, "the host rule is permanent (Next answers 308)");
    ok(!String(www.destination).includes("?"), "the destination carries no query, so the request's query is kept");
    ok(www.basePath === undefined, "the host rule does not opt out of basePath handling");
  }

  // nothing touches the apex
  for (const r of redirects) {
    for (const c of hostConds(r)) ok(c.value !== "miltonly.com" && !/^\^?\(?miltonly/.test(String(c.value)), `no redirect conditions on the apex host (${r.source})`);
    if (r === www) continue;
    ok(typeof r.destination === "string" && r.destination.startsWith("/"), `every other redirect stays on the requested host (${r.source} -> ${r.destination})`);
  }
  ok(!redirects.some((r) => String(r.destination).includes("www.")), "no redirect points at www");
  const rw = cfg.rewrites ? await cfg.rewrites() : [];
  const rewrites = Array.isArray(rw) ? rw : [...(rw.beforeFiles ?? []), ...(rw.afterFiles ?? []), ...(rw.fallback ?? [])];
  ok(!rewrites.some((r) => hostConds(r).length > 0), "no rewrite conditions on the host");
  const headers = cfg.headers ? await cfg.headers() : [];
  ok(!headers.some((r) => hostConds(r).length > 0), "no header rule conditions on the host");

  const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  ok(!("redirects" in vercel) && !("rewrites" in vercel) && !("routes" in vercel), "vercel.json declares no redirects, rewrites or routes");

  const mw = fs.readFileSync("src/middleware.ts", "utf8").replace(/\/\/.*$/gm, "");
  ok(!/www\./.test(mw), "the middleware names no www host");
  ok(!/\.host\b|\.hostname\b|get\(\s*["']host["']\s*\)/.test(mw), "the middleware reads no host");

  if (failures.length) {
    console.error(`[www-redirect] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[www-redirect] PASS: ${assertions} assertions. One permanent host rule, www.miltonly.com -> https://miltonly.com/:path* with the query kept; ${redirects.length - 1} other redirects stay on the requested host; nothing conditions on the apex.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
