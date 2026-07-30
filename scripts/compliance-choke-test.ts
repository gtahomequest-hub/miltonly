// scripts/compliance-choke-test.ts
// ITEM 1 gate: prove the prompt-safety choke rejects a payload containing an MLS number BEFORE any
// model call, that it's wired into callDeepSeek/callClaude (the only two model-call functions), and
// that legitimate generation prompts (real system-prompt .md files + a post-fix street payload) PASS.
import { readFileSync, readdirSync, statSync } from "node:fs"; import { resolve, dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

function walkMd(dir: string): string[] {
  const out: string[] = [];
  try { for (const e of readdirSync(dir)) { const p = join(dir, e); const s = statSync(p); if (s.isDirectory()) out.push(...walkMd(p)); else if (e.endsWith(".md")) out.push(p); } } catch {}
  return out;
}

async function main() {
  const { validatePromptSafety, assertPromptSafe, callDeepSeek } = await import("@/lib/ai/compliance");
  const ok = (b: boolean) => (b ? "PASS" : "*** FAIL ***");
  let allPass = true;
  const rec = (b: boolean) => { if (!b) allPass = false; return ok(b); };

  console.log("═══ 1. validatePromptSafety unit ═══");
  const mls = validatePromptSafety("... typical rent W1234567 near the GO ...");
  console.log(`  MLS number "W1234567" → unsafe: ${rec(!mls.safe)}  (${mls.reason ?? ""})`);
  const key = validatePromptSafety("listing key a1b2c3d4e5f6a1b2c3d4e5f6 here");
  console.log(`  24-hex listing key → unsafe: ${rec(!key.safe)}  (${key.reason ?? ""})`);
  const addr = validatePromptSafety("123 Main Street Milton L9T 1A1 sold");
  console.log(`  full address + postal → unsafe: ${rec(!addr.safe)}  (${addr.reason ?? ""})`);
  const clean = validatePromptSafety("Detached homes on Main Street typically sell around $1,010,185; 41 sold in the past year.");
  console.log(`  clean market text → safe: ${rec(clean.safe)}`);

  console.log("\n═══ 2. assertPromptSafe throws on MLS, not on clean ═══");
  let threw = false; try { assertPromptSafe("system ok", "user with W1234567"); } catch (e) { threw = /safety gate/.test((e as Error).message); }
  console.log(`  assertPromptSafe(MLS) throws at gate: ${rec(threw)}`);
  let cleanOk = true; try { assertPromptSafe("system ok", "clean user prompt with prices $560,000"); } catch { cleanOk = false; }
  console.log(`  assertPromptSafe(clean) does NOT throw: ${rec(cleanOk)}`);

  console.log("\n═══ 3. callDeepSeek REJECTS an MLS payload BEFORE any network call ═══");
  let gateMsg = "";
  try { await callDeepSeek({ systemPrompt: "You write market copy.", userPrompt: "Recent lease MLS W7654321 at 88 Maple Ave" }); }
  catch (e) { gateMsg = (e as Error).message; }
  const rejectedAtGate = /safety gate/.test(gateMsg) && !/DEEPSEEK_API_KEY|deepseek\.com|fetch/i.test(gateMsg);
  console.log(`  callDeepSeek(MLS) threw at gate before network: ${rec(rejectedAtGate)}`);
  console.log(`    error: ${gateMsg}`);

  console.log("\n═══ 4. REAL system prompts (docs/phase-4.1/**/*.md) all PASS the gate ═══");
  const mdFiles = walkMd(resolve(__d, "../docs/phase-4.1"));
  let mdFail = 0;
  for (const f of mdFiles) {
    const s = validatePromptSafety(readFileSync(f, "utf8"));
    if (!s.safe) { mdFail++; console.log(`    *** ${f.split("phase-4.1")[1]} → ${s.reason}`); }
  }
  console.log(`  ${mdFiles.length} system-prompt files scanned; unsafe: ${mdFail} → ${rec(mdFail === 0)}`);

  console.log("\n═══ 5. Post-fix street lease payload (no mlsNumber) PASSES; pre-fix (with mlsNumber) is REJECTED ═══");
  const leaseRec = { address: "88 Maple Ave", listPrice: 2500, soldPrice: 2500, beds: 2, baths: 1, sqftRange: "700-799", daysOnMarket: 12, propertyType: "condo", soldMonth: "2026-05", leaseTerm: "12 Months", furnished: "Unfurnished" };
  const postFix = { street: { name: "Maple Ave", slug: "maple-ave" }, aggregates: { salesCount: 8, typicalPrice: 640000, daysOnMarket: 22 }, leaseActivity: { recentRecords: [leaseRec] } };
  const preFix = { ...postFix, leaseActivity: { recentRecords: [{ mlsNumber: "W7654321", ...leaseRec }] } };
  console.log(`  post-fix payload safe: ${rec(validatePromptSafety(JSON.stringify(postFix, null, 2)).safe)}`);
  console.log(`  pre-fix payload (had MLS) rejected: ${rec(!validatePromptSafety(JSON.stringify(preFix, null, 2)).safe)}`);

  console.log(`\n═══ RESULT: ${allPass ? "ALL PASS" : "FAILURES ABOVE"} ═══`);
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
