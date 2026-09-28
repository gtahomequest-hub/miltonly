// scripts/test-street-regen-gate.ts, MC-049: the scheduled rewrite of street prose is off unless
// STREET_REGEN_ENABLED is exactly "true", and nothing turns it on.
//
//   - streetRegenEnabled() is false for unset, "", "false", "1", "TRUE" and " true", true for "true";
//   - /api/sync/regenerate, called for real with the cron secret and the switch off, answers 200
//     {paused:true} with the database pointed at an address that cannot answer, so the pause is
//     proven to come before any read or write, not only read in the source;
//   - the same route with a wrong secret still answers 401 (the gate did not move the auth);
//   - /api/sync/generate leaves a "regenerate" decision queued when the switch is off, before any
//     page is built, and still builds new pages ("build" is not gated);
//   - no tracked file sets STREET_REGEN_ENABLED.
import fs from "node:fs";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(msg);
}

async function main() {
  // the switch
  const { streetRegenEnabled } = await import("@/lib/streetRegen");
  const saved = process.env.STREET_REGEN_ENABLED;
  for (const v of [undefined, "", "false", "1", "TRUE", " true", "yes"]) {
    if (v === undefined) delete process.env.STREET_REGEN_ENABLED; else process.env.STREET_REGEN_ENABLED = v;
    ok(streetRegenEnabled() === false, `streetRegenEnabled() is off for ${JSON.stringify(v)}`);
  }
  process.env.STREET_REGEN_ENABLED = "true";
  ok(streetRegenEnabled() === true, 'streetRegenEnabled() is on for "true"');
  delete process.env.STREET_REGEN_ENABLED;

  // the weekly route, called for real, with a database that cannot answer
  process.env.CRON_SECRET = "mc049-test-secret";
  process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/none?connect_timeout=1";
  const { NextRequest } = await import("next/server");
  const route = await import("../src/app/api/sync/regenerate/route");
  const t0 = Date.now();
  const res = await route.GET(new NextRequest("http://localhost/api/sync/regenerate?secret=mc049-test-secret"));
  const body = await res.json();
  ok(res.status === 200 && body.paused === true, `the weekly route answers 200 {paused:true} when off (${res.status} ${JSON.stringify(body)})`);
  ok(!("checked" in body) && !("staleQueued" in body), "the paused answer reports no check and no queueing");
  ok(Date.now() - t0 < 2000, "the paused answer came without waiting on a database");
  const denied = await route.GET(new NextRequest("http://localhost/api/sync/regenerate?secret=wrong"));
  ok(denied.status === 401, `a wrong secret is still refused (${denied.status})`);

  // the hourly route, from source: the regenerate decision is caught before anything is built
  const gen = fs.readFileSync("src/app/api/sync/generate/route.ts", "utf8");
  const gate = gen.indexOf('if (decision === "regenerate" && !regenEnabled) {');
  const build = gen.indexOf('if (decision === "build" || decision === "regenerate") {');
  const push = gen.indexOf("toBuild.push(item);");
  const firstGenerate = gen.indexOf("generateStreetContent(item.streetSlug");
  ok(/const regenEnabled = streetRegenEnabled\(\);/.test(gen), "the hourly route reads the switch once per run");
  ok(gate > 0 && gate < build && build < push && push < firstGenerate, "the hourly route leaves a regenerate decision queued before it can be built");
  const gateBlock = gen.slice(gate, gen.indexOf("}", gate));
  ok(/regenPaused\.push\(item\.streetName\);\s*continue;/.test(gateBlock) && !/prisma\./.test(gateBlock), "a paused regenerate writes nothing: no queue status, no attempt");
  ok(/decision === "build"/.test(gen.slice(build, push)), "new pages (build) are still built");
  ok(/regeneration: \{ paused: !regenEnabled, leftQueued: regenPaused \}/.test(gen), "the hourly response names what it left queued");

  // nothing turns it on. A setter is an assignment (an env line, a JSON or YAML key, `= "..."`), not
  // the switch's own comparison (`=== "true"`); the filter is checked on fixtures before it is used.
  const isSetter = (line: string) => /STREET_REGEN_ENABLED["']?\s*(?::|=(?!=))/.test(line);
  ok(isSetter("STREET_REGEN_ENABLED=true") && isSetter('"STREET_REGEN_ENABLED": "true"') && isSetter('process.env.STREET_REGEN_ENABLED = "true";') && isSetter("  STREET_REGEN_ENABLED: true"),
    "the setter filter catches an env line, a JSON key, an assignment and a YAML key");
  ok(!isSetter('return process.env.STREET_REGEN_ENABLED === "true";') && !isSetter("// off unless STREET_REGEN_ENABLED is exactly \"true\""), "the setter filter passes the switch's comparison and a comment");
  // The tree is walked with fs, not git: a CLI deploy uploads files with no .git, and this runs in
  // that prebuild too. Every file but dependencies, build output and working notes, dotenv files
  // included where they exist.
  const SKIP = new Set(["node_modules", ".next", ".git", ".vercel", "scratchpad", ".turbo"]);
  const lines: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); continue; }
      if (p === "./scripts/test-street-regen-gate.ts" || !/\.(ts|tsx|mjs|cjs|js|json|ya?ml|sh|toml)$|^\.env/.test(e.name)) continue;
      const text = fs.readFileSync(p, "utf8");
      if (!text.includes("STREET_REGEN_ENABLED")) continue;
      text.split(/\r?\n/).forEach((l, i) => { if (l.includes("STREET_REGEN_ENABLED")) lines.push(`${p}:${i + 1}:${l}`); });
    }
  };
  walk(".");
  const setters = lines.filter((l) => isSetter(l.replace(/^[^:]+:\d+:/, "")));
  ok(lines.some((l) => l.startsWith("./src/lib/streetRegen.ts:")), "the switch is found in source (the walk is looking at the right tree)");
  ok(setters.length === 0, `no file sets STREET_REGEN_ENABLED (${setters[0] || "none"})`);
  if (saved !== undefined) process.env.STREET_REGEN_ENABLED = saved;

  if (failures.length) {
    console.error(`[street-regen-gate] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[street-regen-gate] PASS: ${assertions} assertions. The weekly rewrite answers 200 {paused:true} with the database unreachable; the hourly route leaves regenerations queued and still builds new pages; nothing sets STREET_REGEN_ENABLED.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
