// scripts/test-street-regen-gate.ts, MC-049 and MC-047: scheduled street-prose generation is off unless
// STREET_REGEN_ENABLED is exactly "true", and nothing turns it on.
//
//   - streetRegenEnabled() is false for unset, "", "false", "1", "TRUE" and " true", true for "true";
//   - /api/sync/regenerate, called for real with the cron secret and the switch off, answers 200
//     {paused:true} with the database pointed at an address that cannot answer, so the pause is
//     proven to come before any read or write, not only read in the source;
//   - the same route with a wrong secret still answers 401 (the gate did not move the auth);
//   - /api/sync/generate leaves a "regenerate" decision AND, since MC-047, a "build" decision (a
//     new page) queued when the switch is off, writing nothing for either (src/lib/streetQueuePlan.ts,
//     driven directly and through a simulated queue);
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

  // the hourly route's decisions (MC-047 step 0): a queued BUILD is left queued when the switch is
  // off, as a queued regenerate is. The plan is driven directly, then a queue is run through it the
  // way the route carries it out (a write only on "close", a page only on "generate").
  const { planQueueItem } = await import("@/lib/streetQueuePlan");
  const off = { generationEnabled: false, newPageBudget: 20 };
  const on = { generationEnabled: true, newPageBudget: 20 };
  ok(planQueueItem("build", off).action.kind === "held" && planQueueItem("build", off).newPageBudget === 20, "off: a build is held and spends no budget");
  ok(planQueueItem("regenerate", off).action.kind === "held", "off: a regenerate is held");
  ok(JSON.stringify(planQueueItem("skip_current", off).action) === JSON.stringify({ kind: "close", status: "done" }), "off: skip_current still closes done");
  ok(JSON.stringify(planQueueItem("skip_low_data", off).action) === JSON.stringify({ kind: "close", status: "ineligible" }), "off: skip_low_data still closes ineligible");
  ok(planQueueItem("build", on).action.kind === "generate" && planQueueItem("build", on).newPageBudget === 19, "on: a build generates and spends one of the budget");
  ok(planQueueItem("build", { generationEnabled: true, newPageBudget: 0 }).action.kind === "deferred", "on: a build over the cap is deferred");
  ok(planQueueItem("regenerate", on).action.kind === "generate" && planQueueItem("regenerate", on).newPageBudget === 20, "on: a regenerate generates and spends no budget");
  const simulate = (enabled: boolean) => {
    const queue = [
      { id: "a", decision: "build", status: "pending", attempts: 0 },
      { id: "b", decision: "regenerate", status: "pending", attempts: 1 },
      { id: "c", decision: "skip_current", status: "pending", attempts: 0 },
      { id: "d", decision: "skip_low_data", status: "pending", attempts: 0 },
    ];
    const generated: string[] = [];
    let budget = 20;
    for (const row of queue) {
      const step = planQueueItem(row.decision, { generationEnabled: enabled, newPageBudget: budget });
      budget = step.newPageBudget;
      if (step.action.kind === "generate") generated.push(row.id);
      if (step.action.kind === "close") row.status = step.action.status;
    }
    return { queue, generated };
  };
  const heldRun = simulate(false);
  const build = heldRun.queue.find((r) => r.id === "a")!;
  ok(build.status === "pending" && build.attempts === 0 && !heldRun.generated.includes("a"), "off: the queued build is left queued (pending, no attempt), and no page is built");
  ok(heldRun.queue.find((r) => r.id === "b")!.status === "pending" && heldRun.queue.find((r) => r.id === "b")!.attempts === 1, "off: the queued regenerate is left as it was");
  ok(heldRun.generated.length === 0, "off: nothing is generated");
  ok(simulate(true).generated.join(",") === "a,b", "on: the build and the regenerate are generated");

  // the route carries the plan out, from source
  const gen = fs.readFileSync("src/app/api/sync/generate/route.ts", "utf8");
  ok(/const generationEnabled = streetRegenEnabled\(\);/.test(gen), "the hourly route reads the switch once per run");
  ok(/const step = planQueueItem\(decision, \{ generationEnabled, newPageBudget \}\);/.test(gen), "the hourly route decides every queued street through the plan");
  const heldAt = gen.indexOf('if (action.kind === "held") {');
  const heldEnd = gen.indexOf("continue;", heldAt);
  const heldBlock = gen.slice(heldAt, heldEnd + "continue;".length);
  ok(heldAt > 0 && heldEnd > heldAt && /held\.push\(/.test(heldBlock) && !/prisma\.|generateStreetContent|toBuild/.test(heldBlock), "a held decision writes nothing: no queue status, no attempt");
  ok(heldAt < gen.indexOf("toBuild.push(item);") && gen.indexOf("toBuild.push(item);") < gen.indexOf("generateStreetContent(item.streetSlug"), "the hold comes before anything is queued to be built");
  ok(!/decision === "build"|decision === "regenerate"/.test(gen.replace(/\/\/.*$/gm, "")), "the route has no decision branch of its own outside the plan");
  ok(/generation: \{ paused: !generationEnabled, held \}/.test(gen), "the hourly response names what it held");

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
  console.log(`[street-regen-gate] PASS: ${assertions} assertions. The weekly rewrite answers 200 {paused:true} with the database unreachable; the hourly route holds queued builds and regenerations; nothing sets STREET_REGEN_ENABLED.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
