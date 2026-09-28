// Prebuild case for MC-040: scripts/vercel-ignore.sh decides every production build, and the
// failure that matters is the wrong way round. A rule that builds too often costs a few billed
// minutes; a rule that SKIPS a build it should have run ships nothing and nobody notices. So the
// cases below are real SHAs out of this repository's own history, and each one asserts the exit
// code Vercel reads: 0 = skip the build, 1 = build.
//
// The regression this exists for: MC-034's first attempt diffed the TIP COMMIT alone. Every task
// here ends in a docs commit, so that rule would have skipped every merge beneath one. The pair
// marked "the MC-034 regression" holds both halves of it: the tip alone is docs-only (a naive rule
// skips), the true range from the last successful deployment carries the merge (this rule builds).
//
// A shallow clone (Vercel's own, for one) may not carry the older SHAs. A case whose commits are
// missing is reported and not counted rather than failed, because a fixture that cannot be
// resolved is not evidence about the rule. The two cases that need no history always run.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

let assertions = 0;
const failures: string[] = [];
const unrunnable: string[] = [];

const SKIP = 0; // exit 0 tells Vercel to skip the build
const BUILD = 1; // exit 1 tells Vercel to build

function have(rev: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${rev}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Run the rule and return its exit code, the way Vercel runs it.
 *  Judged as main unless a case names a branch (MC-045): this test runs in `prebuild`, and a build
 *  on Vercel carries its own VERCEL_GIT_COMMIT_REF. A preview deployed with `npx vercel` from a
 *  worktree branch (DEC-ONE-PREVIEW) inherited that branch, the rule's branch gate skipped before the
 *  range logic under test ever ran, and "an unreachable base/head must BUILD" failed the build. */
function decide(args: string[], env: NodeJS.ProcessEnv = {}): number {
  try {
    execFileSync("bash", ["scripts/vercel-ignore.sh", ...args], {
      stdio: "pipe",
      env: { ...process.env, VERCEL_GIT_COMMIT_REF: "main", ...env },
    });
    return 0;
  } catch (e) {
    const code = (e as { status?: number }).status;
    return typeof code === "number" ? code : 99;
  }
}

function assertRange(base: string, head: string, want: number, label: string) {
  if (!have(base) || !have(head)) {
    unrunnable.push(`${label} (${base}..${head} not in this clone)`);
    return;
  }
  assertions++;
  const got = decide([base, head]);
  if (got !== want) {
    failures.push(`${label}: ${base}..${head} answered ${got === SKIP ? "SKIP" : got === BUILD ? "BUILD" : got}, expected ${want === SKIP ? "SKIP" : "BUILD"}`);
  }
}

// ── the seven cases, by real SHA ────────────────────────────────────────────────────────────────
// 1. A merge whose tip commit is docs-only. MC-037: the merge 2411e8e, then the fix, then the
//    handoff and the report. b4ebcd6 alone touches HANDOFF.md, QUEUE.md and a report.
assertRange("1cb431e", "b4ebcd6", BUILD, "a merge whose tip commit is docs-only builds");
assertRange("b4ebcd6~1", "b4ebcd6", SKIP, "the MC-034 regression: the tip commit ALONE looks skippable");
// 2. The nightly audit's own commit: scratchpad/audit/nightly only.
assertRange("17faadc", "b3bced3", SKIP, "a push touching only scratchpad/ skips");
// 3. A docs commit: HANDOFF.md, QUEUE.md, a report.
assertRange("c1565b7", "4ffad6e", SKIP, "a push touching only *.md skips");
// 4. The MA-008 addendum: scripts/audit/morning/*, HANDOFF-audit.md, a report. This is the push
//    that built the whole site for byte-identical app code before MC-040.
assertRange("f50bfba", "c1565b7", SKIP, "a push touching only scripts/audit/ skips");
// 5. The prompt files the generators read at runtime.
assertRange("320e406~1", "320e406", BUILD, "a push touching only docs/phase-4.1/ builds");
// 6. Application code.
assertRange("6524a20~1", "6524a20", BUILD, "a push touching src/ builds");

// 7. A base the clone does not carry: a force-push, a shallow clone, a deleted branch. Build.
assertions++;
if (decide(["000000000000000000000000000000000000dead", "HEAD"]) !== BUILD) {
  failures.push("an unreachable base must BUILD, not skip");
}
assertions++;
if (decide(["HEAD", "000000000000000000000000000000000000dead"]) !== BUILD) {
  failures.push("an unreachable head must BUILD, not skip");
}

// Not in the list, but the rule's first line: a branch build is Vercel's to cancel, and a branch
// takes its preview from `npx vercel` in its worktree (CLAUDE.md).
assertions++;
if (decide(["6524a20~1", "6524a20"], { VERCEL_GIT_COMMIT_REF: "feat/anything" }) !== SKIP) {
  failures.push("a push to a branch other than main must skip, even when it carries src/");
}
// And the same range on main still builds, so the branch gate is what decided it.
assertions++;
if (have("6524a20~1") && decide(["6524a20~1", "6524a20"], { VERCEL_GIT_COMMIT_REF: "main" }) !== BUILD) {
  failures.push("the same range on main must build");
}

// The rule Vercel actually invokes is the one in vercel.json.
assertions++;
const vercelJson = JSON.parse(readFileSync("vercel.json", "utf8")) as { ignoreCommand?: string };
if (vercelJson.ignoreCommand !== "bash scripts/vercel-ignore.sh") {
  failures.push(`vercel.json ignoreCommand is ${JSON.stringify(vercelJson.ignoreCommand)}, expected "bash scripts/vercel-ignore.sh"`);
}

for (const u of unrunnable) console.log(`[vercel-ignore] not runnable in this clone: ${u}`);
if (failures.length > 0) {
  console.error(`[vercel-ignore] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[vercel-ignore] PASS: ${assertions} assertions${unrunnable.length ? `, ${unrunnable.length} not runnable in this clone` : ""}.`);
