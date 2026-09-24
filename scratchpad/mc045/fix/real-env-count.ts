import fs from "node:fs"; import vm from "node:vm"; import ts from "typescript";
for (const [file, label] of [["D:/miltonly/scripts/create-street-page.ts", "after"]]) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  let fnText = ""; const visit = (n: ts.Node) => { if (ts.isFunctionDeclaration(n) && n.name?.text === "loadEnvLocal") fnText = n.getText(sf); ts.forEachChild(n, visit); }; visit(sf);
  const js = ts.transpileModule(fnText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const env: Record<string, string> = {};
  vm.runInNewContext(`${js}\n;loadEnvLocal();`, { readFileSync: (p: string) => fs.readFileSync("D:/miltonly/" + p, "utf8"), process: { env } });
  const raw = fs.readFileSync("D:/miltonly/.env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).length;
  const cr = Object.values(env).filter((v) => v.includes("\r")).length;
  console.log(`${label}: loaded ${Object.keys(env).length} of ${raw} assignments; values with a stray CR: ${cr}; DEEPSEEK_API_KEY present: ${!!env.DEEPSEEK_API_KEY}; AI_PROVIDER = ${env.AI_PROVIDER}`);
}
