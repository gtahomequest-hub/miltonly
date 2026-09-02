// PARITY GUARD: nothing reaches the index that the page itself will not print.
//
// The defect this exists to prevent. StreetContent.description is stored LLM prose. The visible
// hero runs it through stripNumericSentences (compliance suppression) and then the ASSERTS_NO_SALES
// gate. For a long time street.characterSummary was set from the RAW sentence instead, and TWO
// index-facing surfaces read that field:
//     src/app/streets/[slug]/page.tsx   -> the meta description
//     src/lib/schema/street-schema.ts   -> the Place JSON-LD "description"
// So 98 of 431 published streets sent Google a sentence the page refuses to print — 28 opening with
// an absence claim, 16 contradicting themselves inside one snippet. A comment in page.tsx asserted
// "one suppression pass, no second path to the index". There were two, and nothing checked.
//
// WHY THIS IS A SOURCE-LEVEL TEST. The real property — "index copy equals visible copy" — can only
// be measured by loading every street, which takes minutes and cannot run on every build. The
// invariant that PRODUCES that property is structural and free to check: characterSummary must be
// fed from the suppressed value, and no index-facing surface may read stored prose directly. That
// is what regresses when someone adds a surface or re-points the field, and it is what this catches.
//
// It does NOT prove parity for any given street. The measured check is a separate, deliberate run.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

type Check = { file: string; label: string; ok: boolean; detail: string };
const checks: Check[] = [];
const add = (file: string, label: string, ok: boolean, detail: string) =>
  checks.push({ file, label, ok, detail });

// ── 1. characterSummary is fed from the SUPPRESSED value ────────────────────────
const sd = read("src/lib/street-data.ts");
add("src/lib/street-data.ts", "characterSummary reads the suppressed value",
  /characterSummary:\s*heroProps\.suppressedSummary/.test(sd),
  "expected `characterSummary: heroProps.suppressedSummary`");
add("src/lib/street-data.ts", "characterSummary is NOT fed raw stored prose",
  !/characterSummary:\s*characterSummaryFrom\(/.test(sd),
  "found `characterSummary: characterSummaryFrom(...)` — that is the raw sentence, ungated");

// ── 2. the suppressed value actually passes through both guards ─────────────────
add("src/lib/street-data.ts", "suppressedSummary derives from stripNumericSentences",
  /rawSummary[\s\S]{0,200}stripNumericSentences\(/.test(sd),
  "rawSummary must come from stripNumericSentences(...)");
add("src/lib/street-data.ts", "suppressedSummary applies the ASSERTS_NO_SALES gate",
  /suppressedSummary\s*=[\s\S]{0,200}summaryClaimsAbsence/.test(sd),
  "suppressedSummary must be gated on summaryClaimsAbsence");
add("src/lib/street-data.ts", "suppressedSummary falls to \"\" not the neutral placeholder",
  /suppressedSummary\s*=[\s\S]{0,200}:\s*""/.test(sd),
  'must be "" so consumers fall through to their own fallback rather than publishing the placeholder');

// ── 3. no index-facing surface reads stored prose directly ──────────────────────
for (const f of ["src/app/streets/[slug]/page.tsx", "src/lib/schema/street-schema.ts"]) {
  const src = read(f);
  add(f, "does not read StreetContent.description directly",
    !/streetContent[?.]*\.description/.test(src) && !/characterSummaryFrom\(/.test(src),
    "an index-facing surface must go through street.characterSummary, never the stored prose");
}

const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  console.error(`[index-copy-parity] FAIL — ${failed.length} of ${checks.length} invariants broken:`);
  for (const f of failed) console.error(`  ${f.file}\n    ${f.label}\n    ${f.detail}`);
  console.error("\nA break here means the index can receive copy the page suppresses.");
  process.exit(1);
}
console.log(`[index-copy-parity] PASS — ${checks.length} invariants hold across ${new Set(checks.map((c) => c.file)).size} files.`);
