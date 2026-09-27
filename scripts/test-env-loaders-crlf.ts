// scripts/test-env-loaders-crlf.ts
// THE ENV LOADERS READ A CRLF FILE (MC-045). `.env.local` on this desk is CRLF (92 of 99 lines), and
// the loader copied into 70 scripts matched each line with /^([A-Z_][A-Z0-9_]*)=(.*)$/ after a
// split on "\n". Without the m flag `(.*)$` cannot match a line that still ends in "\r", so every
// CRLF line was skipped: 2 of 83 assignments loaded, the runners threw "DEEPSEEK_API_KEY unset",
// and MC-042 had to run them with `tsx --env-file`. The fix is `(.*?)\r?$`. This test holds it.
//
// Two checks, neither reads `.env.local`, so the test runs on Vercel:
//   1. STATIC: the old regex text appears nowhere under scripts/ (Audit's scripts/audit/ excepted,
//      whose loaders were never affected) or src/.
//   2. EXECUTED: every named loader function in scripts/ (loadEnvLocal, loadEnv, ...) that reads a
//      file is extracted with the TypeScript compiler API, transpiled, and run in node:vm against an
//      inline fixture of CRLF and LF lines, with fs stubbed. Each must load every key, and no value
//      may keep a stray "\r".
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const ROOT = process.cwd();
const OLD = "/^([A-Z_][A-Z0-9_]*)=(.*)$/";
const walk = (dir: string, skip: (p: string) => boolean): string[] => {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p).split(path.sep).join("/");
    if (skip(rel)) continue;
    if (e.isDirectory()) out.push(...walk(p, skip));
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const skip = (rel: string) => rel.startsWith("scripts/audit") || rel.includes("node_modules") || rel.startsWith("scripts/.") || rel === "scripts/test-env-loaders-crlf.ts";
let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL  ${msg}`); };

// ── 1. static ─────────────────────────────────────────────────────────────────────────────
const files = [...walk(path.join(ROOT, "scripts"), skip), ...walk(path.join(ROOT, "src"), skip)];
const stale = files.filter((f) => fs.readFileSync(f, "utf8").includes(OLD));
for (const f of stale) fail(`${path.relative(ROOT, f)} still carries the CRLF-blind loader regex ${OLD}`);
console.log(`[env-loaders] static: ${files.length} files scanned, ${stale.length} with the old regex`);

// ── 2. executed ───────────────────────────────────────────────────────────────────────────
const CR = "\r";
const FIXTURE =
  `# a comment${CR}\n` +
  `A_PLAIN=plain-value${CR}\n` +
  `B_QUOTED="quoted value"${CR}\n` +
  `C_EQ="postgres://u:p@h/db?sslmode=require&x=y"${CR}\n` +
  `${CR}\n` +
  `D_LF=lf-value\n` +
  `E_LAST=last-value`;
const EXPECT: Record<string, string> = { A_PLAIN: "plain-value", B_QUOTED: "quoted value", C_EQ: "postgres://u:p@h/db?sslmode=require&x=y", D_LF: "lf-value", E_LAST: "last-value" };
const unquote = (v: string) => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);

let ran = 0;
const notRunnable: string[] = [];
for (const file of files.filter((f) => f.includes(`${path.sep}scripts${path.sep}`) || f.startsWith(path.join(ROOT, "scripts")))) {
  const text = fs.readFileSync(file, "utf8");
  if (!/readFileSync/.test(text) || !/\.env/.test(text)) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fns: ts.FunctionDeclaration[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name && /^load(?:Env|Dotenv)/i.test(n.name.text) && /readFileSync/.test(n.getText(sf))) fns.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const fn of fns) {
    const name = fn.name!.text;
    const where = `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(fn.getStart(sf)).line + 1} ${name}`;
    const js = ts.transpileModule(fn.getText(sf).replace(/^export\s+(?:default\s+)?/, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const env: Record<string, string | undefined> = {};
    const readFileSync = (p: unknown) => { if (/\.env/.test(String(p))) return FIXTURE; throw Object.assign(new Error(`ENOENT ${String(p)}`), { code: "ENOENT" }); };
    const fsStub = { readFileSync, existsSync: (p: unknown) => /\.env\.local$/.test(String(p)) };
    const sandbox: Record<string, unknown> = {
      readFileSync, existsSync: fsStub.existsSync, fs: fsStub, path, join: path.join, resolve: path.resolve,
      process: { env, cwd: () => ROOT }, console: { log() {}, warn() {}, error() {} },
      require: (m: string) => (m === "fs" || m === "node:fs" ? fsStub : m === "path" || m === "node:path" ? path : {}),
      __dirname: path.join(ROOT, "scripts"), ROOT, REPO_ROOT: ROOT,
    };
    // A loader is called the way its callers call it: with no argument, with a file name, or with a
    // file name and a target object (loadEnv(".env", into)). What it loaded is read from wherever it
    // put it: process.env, the target, or its return value.
    const target: Record<string, string> = {};
    sandbox.__target = target;
    const args = fn.parameters.length === 0 ? "" : fn.parameters.length === 1 ? `".env.local"` : `".env.local", __target`;
    let returned: unknown;
    try {
      returned = vm.runInNewContext(`${js}\n;${name}(${args});`, sandbox, { timeout: 2000 });
    } catch (e) {
      notRunnable.push(`${where}: ${(e as Error).message.slice(0, 80)}`);
      continue;
    }
    ran++;
    const loaded: Record<string, string | undefined> = { ...(returned && typeof returned === "object" ? (returned as Record<string, string>) : {}), ...target, ...env };
    for (const [k, want] of Object.entries(EXPECT)) {
      const got = loaded[k];
      if (got === undefined) { fail(`${where} did not load ${k} (a ${k === "D_LF" || k === "E_LAST" ? "LF" : "CRLF"} line)`); continue; }
      if (got.includes("\r")) fail(`${where} kept a carriage return in ${k}`);
      else if (unquote(got) !== want) fail(`${where} loaded ${k} as ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
  }
}
console.log(`[env-loaders] executed: ${ran} named loaders run against a CRLF/LF fixture` + (notRunnable.length ? `; ${notRunnable.length} not runnable in isolation (the static check covers their regex):` : ""));
for (const n of notRunnable) console.log(`    · ${n}`);
if (ran === 0) fail("no loader was executed: the extractor found nothing, which would make this test vacuous");
if (failures) { console.error(`[env-loaders] FAIL: ${failures}`); process.exit(1); }
console.log("[env-loaders] PASS");
