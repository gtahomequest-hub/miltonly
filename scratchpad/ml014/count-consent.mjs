// ML-014: count the helper calls per file the way scripts/test-lead-forms.ts does (all of src/, comments stripped).
import fs from 'node:fs';
import path from 'node:path';
function walk(d, out = []) { for (const e of fs.readdirSync(d)) { const p = path.join(d, e); if (fs.statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e)) out.push(p); } return out; }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
let total = 0;
for (const f of walk('src')) {
  const c = strip(fs.readFileSync(f, 'utf8'));
  const n = (c.match(/\bpostLead(?:Detailed)?\s*\(\s*\{/g) || []).length;
  if (n) { total += n; console.log(n, f.split(path.sep).join('/')); }
}
console.log('total', total);
