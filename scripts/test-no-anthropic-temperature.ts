// Regression check: forbid `temperature:` inside any Anthropic
// `messages.create({...})` call.
//
// History: claude-opus-4-7 deprecated the `temperature` parameter at some
// point between 2026-04-21 and 2026-05-06. compliance.ts:123 silently kept
// passing `temperature: 0.7`, returning 400 invalid_request_error on every
// cron pass and burning each street's 3-retry budget. ~83 streets hit the
// failure cap before the fix shipped (aaf56c6, 2026-05-08).
//
// This check scans every `messages.create(` block under src/lib/ai/ and
// fails the build if `temperature:` appears inside one. DeepSeek calls
// (callDeepSeek, CallDeepSeekOptions) keep the parameter — DeepSeek still
// accepts it — but those don't go through `messages.create`, so they're
// unaffected by this check.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SCAN_DIR = "src/lib/ai";

function findOffendingBlocks(content: string, file: string): string[] {
  const lines = content.split("\n");
  const issues: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("messages.create(")) continue;
    // Walk forward, tracking paren depth, until we close the call.
    let depth = 0;
    let started = false;
    let endLine = i;
    let captured = "";
    for (let j = i; j < lines.length; j++) {
      const line = lines[j];
      captured += line + "\n";
      for (const ch of line) {
        if (ch === "(") { depth++; started = true; }
        else if (ch === ")") depth--;
      }
      if (started && depth === 0) { endLine = j; break; }
    }
    if (/\btemperature\s*:/.test(captured)) {
      issues.push(`${file}:${i + 1}-${endLine + 1} — messages.create() block contains \`temperature:\`\n${captured.split("\n").slice(0, 15).map(l => "    " + l).join("\n")}`);
    }
  }
  return issues;
}

function walkTs(dir: string): string[] {
  const files: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...walkTs(p));
    else if (ent.name.endsWith(".ts")) files.push(p);
  }
  return files;
}

function main(): void {
  let stat;
  try { stat = statSync(SCAN_DIR); } catch { stat = null; }
  if (!stat || !stat.isDirectory()) {
    console.error(`[temperature-regression] FAIL — ${SCAN_DIR} not a directory`);
    process.exit(2);
  }
  const files = walkTs(SCAN_DIR);
  const allIssues: string[] = [];
  for (const f of files) {
    const content = readFileSync(f, "utf-8");
    allIssues.push(...findOffendingBlocks(content, f));
  }
  if (allIssues.length > 0) {
    console.error(`[temperature-regression] FAIL — ${allIssues.length} Anthropic messages.create() call(s) include \`temperature:\`:`);
    for (const i of allIssues) console.error("\n" + i);
    console.error(`\nclaude-opus-4-7 (and other claude-4.x models) deprecated the temperature parameter. Passing it returns 400 invalid_request_error and burns the cron's 3-retry budget. Remove the temperature line from the messages.create() block above.`);
    process.exit(1);
  }
  console.log(`[temperature-regression] PASS — scanned ${files.length} files under ${SCAN_DIR}, no Anthropic calls pass \`temperature:\``);
}
main();
