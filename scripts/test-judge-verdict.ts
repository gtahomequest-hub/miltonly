// Prebuild case: the fair-housing judge's verdict is persisted on every run.
//
// MC-009 (2026-09-11). The judge's findings lived only in .judge-log.jsonl in the process's
// working directory; on Vercel that is the function's ephemeral filesystem, so for every page
// the cron built the round-1 findings were gone when the function returned. Every run now
// carries its rounds out of generatePhase41StreetContent (result or error payload) and
// generateStreet.ts writes buildJudgeVerdict(rounds) to StreetGeneration.judgeVerdict on every
// terminal update, which is the one path the cron and the local runners share.
//
// Behavioural half: buildJudgeVerdict, pure, on the four shapes a run can end in.
// Structural half: the column, its migration, and the three terminal writes in
// generateStreet.ts, read from the source so a future edit that drops one fails here.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildJudgeVerdict, type JudgeRound } from "../src/lib/ai/compliance";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };
const eq = <T,>(a: T, b: T, label: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const r1fail: JudgeRound = { round: 1, pass: false, spans: [{ span: "For families, the schools are close", class: "family status" }], at: "2026-09-11T20:00:00.000Z" };
const r2pass: JudgeRound = { round: 2, pass: true, spans: [], at: "2026-09-11T20:00:30.000Z" };
const r2fail: JudgeRound = { round: 2, pass: false, spans: [{ span: "a rental-oriented pocket", class: "tenure characterization" }], at: "2026-09-11T20:00:30.000Z" };
const r1err: JudgeRound = { round: 1, pass: false, spans: [], judgeError: "timeout", at: "2026-09-11T20:00:00.000Z" };

// ── behavioural ───────────────────────────────────────────────────────────────────────────────
eq(buildJudgeVerdict([]), { result: "not_run", round: null, rounds: [] }, "no rounds: not_run");
eq(buildJudgeVerdict([r2pass]).result, "pass", "one passing round: pass");
eq(buildJudgeVerdict([r1fail, r2pass]).result, "pass", "round 1 refused, round 2 passed: pass");
eq(buildJudgeVerdict([r1fail, r2pass]).round, 2, "final round is 2");
eq(buildJudgeVerdict([r1fail, r2pass]).rounds.length, 2, "both rounds kept, spans included");
eq(buildJudgeVerdict([r1fail, r2pass]).rounds[0].spans[0].class, "family status", "round-1 span survives a round-2 pass");
eq(buildJudgeVerdict([r1fail, r2fail]).result, "fail", "refused twice: fail");
eq(buildJudgeVerdict([r1err]).result, "fail", "judge error: fail (fail-closed)");
eq(buildJudgeVerdict([r1fail]).result, "fail", "round 1 refused and the retry exhausted its budget: fail");

// ── structural ────────────────────────────────────────────────────────────────────────────────
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const modelStart = schema.indexOf("model StreetGeneration {");
const model = schema.slice(modelStart, schema.indexOf("\n}", modelStart));
ok(/^\s*judgeVerdict\s+Json\?/m.test(model), "prisma: StreetGeneration.judgeVerdict Json? is declared");

const migrations = join(process.cwd(), "prisma/migrations");
const dir = existsSync(migrations) ? readdirSync(migrations).find((d) => d.endsWith("_street_generation_judge_verdict")) : undefined;
ok(!!dir, "migration: a *_street_generation_judge_verdict directory exists");
if (dir) {
  const sql = readFileSync(join(migrations, dir, "migration.sql"), "utf8");
  ok(/ALTER TABLE "public"\."StreetGeneration" ADD COLUMN "judgeVerdict" JSONB;/.test(sql), "migration: adds the nullable JSONB column and nothing else");
  ok(!/DROP|NOT NULL|DEFAULT/.test(sql), "migration: additive, no drop, no default, no NOT NULL");
}

const gen = stripComments(readFileSync(join(process.cwd(), "src/lib/generateStreet.ts"), "utf8"));
const writes = (gen.match(/judgeVerdict: buildJudgeVerdict\(/g) || []).length;
eq(writes, 3, "generateStreet.ts: the three terminal StreetGeneration updates each write judgeVerdict");
const updates = (gen.match(/prisma\.streetGeneration\.update\(/g) || []).length;
eq(updates, writes, "generateStreet.ts: every streetGeneration.update writes the verdict");

const comp = stripComments(readFileSync(join(process.cwd(), "src/lib/ai/compliance.ts"), "utf8"));
ok(/judgeRounds: \[\],/.test(comp), "compliance.ts: the retry-exhausted error carries judgeRounds");
ok((comp.match(/^\s*judgeRounds,\s*$/gm) || []).length >= 2, "compliance.ts: the judge-refused and the passing returns both carry judgeRounds");
ok(/judgeRounds: \[\.\.\.judgeRounds, \.\.\.retry\.judgeRounds\]/.test(comp), "compliance.ts: a round-2 result keeps round 1");

if (failures.length > 0) {
  console.error(`[judge-verdict] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[judge-verdict] PASS: ${assertions} assertions; buildJudgeVerdict on four run shapes, the column, its migration, and three terminal writes.`);
