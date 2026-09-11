// Prebuild guard: the dead maintenance-fee column is read nowhere.
//
// `Listing` carries two fee columns. `maintenanceFeeAmt` (Float) is the one the sync writes,
// from the feed's AssociationFee, and the one every surface reads. `maintenanceFee` (Int) was
// declared beside it in the same commit (c0a694e, 2026-04-09) and nothing has ever written it:
// NULL on all 3,394 rows, measured 2026-09-11. The condo-fees guide once read the Int column
// and published "No Milton condo currently for sale states a monthly maintenance fee", an
// absence claim that was false on all 73 listings it described.
//
// The guard is structural and blunt on purpose: the identifier `maintenanceFee` (word-bounded,
// so `maintenanceFeeAmt` and `avgMaintenanceFee` do not match) may not appear in any code
// under src/. Comments are stripped first, so history can be written about without tripping
// it. Presentational fields that used to share the name were renamed `monthlyFee` in MC-003,
// which is what makes a plain identifier search a sufficient test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");
const DEAD = /\bmaintenanceFee\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ").replace(/[ \t]\/\/.*$/gm, " ");
}

const files = walk(ROOT);
const hits: string[] = [];
for (const file of files) {
  const code = stripComments(readFileSync(file, "utf8"));
  const lines = code.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (DEAD.test(line)) hits.push(`${file.replace(process.cwd(), "").replace(/\\/g, "/")}:${i + 1}: ${line.trim()}`);
    DEAD.lastIndex = 0;
  });
}

if (files.length < 50) {
  console.error(`[fee-column] FAIL: walked only ${files.length} files under src/, which is not the tree`);
  process.exit(1);
}
if (hits.length > 0) {
  console.error(`[fee-column] FAIL: the dead column identifier \`maintenanceFee\` is read in ${hits.length} place(s); only \`maintenanceFeeAmt\` may be read:`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`[fee-column] PASS: ${files.length} files under src/ carry no read of the dead \`maintenanceFee\` column.`);
