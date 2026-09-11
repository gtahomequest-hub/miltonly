// Prebuild case: every sold-derived cache key is covered by the sold sync's purge.
//
// MC-010 (2026-09-11). The sold sync wrote rows and the figures computed from them stayed in
// Upstash for up to an hour. purgeSoldDerivedCaches now runs at the end of every writing sync.
// The risk is drift: a new cached() site reading sold.sold_records that nobody adds to the
// purge list. So this case READS THE SOURCE: every cached(`...`) key prefix in src/lib that
// lives in a module reading sold.sold_records must be matched by the purge's exact keys or
// its patterns for a sample write. And the sync must call the purge, on the write path only.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SOLD_WIDE_KEYS, soldPurgePatterns } from "../src/lib/soldCachePurge";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.tsx?$/.test(e)) out.push(f);
  }
  return out;
}
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

// ── every sold-derived cached() key in src/lib is purged ────────────────────────────────────
const sample = soldPurgePatterns({ streetSlugs: ["pine-street-milton"], neighbourhoods: ["Old Milton"] });
const globToRe = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const matchers = sample.map(globToRe);
const covered = (key: string) => (SOLD_WIDE_KEYS as readonly string[]).includes(key) || matchers.some((re) => re.test(key));

let sitesSeen = 0;
for (const file of walk(join(process.cwd(), "src"))) {
  const src = stripComments(readFileSync(file, "utf8"));
  if (!/sold\.sold_records/.test(src)) continue;
  if (file.endsWith("soldCachePurge.ts")) continue;
  for (const m of src.matchAll(/cached(?:<[^>]*>)?\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/g)) {
    sitesSeen++;
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    // instantiate the template: a street slug, a neighbourhood, a date, a type, numbers
    const key = raw
      .replace(/\$\{[^}]*streetSlug[^}]*\}/g, "pine-street-milton")
      .replace(/\$\{[^}]*neighbourhood[^}]*\}/g, "Old Milton")
      .replace(/\$\{[^}]*through[^}]*\}/g, "2026-09-11")
      .replace(/\$\{[^}]*\}/g, "x");
    ok(covered(key), `${file.replace(process.cwd(), "").replace(/\\/g, "/")}: cached key "${raw}" (as "${key}") is not purged by the sold sync`);
  }
}
ok(sitesSeen >= 12, `walked ${sitesSeen} sold-derived cached() sites; expected at least 12 (the parser found too few)`);

// ── the sync calls the purge on the write path, and only then ───────────────────────────────
const sync = stripComments(readFileSync(join(process.cwd(), "src/lib/vow-sync.ts"), "utf8"));
ok(/purgeSoldDerivedCaches\(/.test(sync), "vow-sync.ts calls purgeSoldDerivedCaches");
ok(/if \(inserted \+ updated > 0\) \{\s*purge = await purgeSoldDerivedCaches/.test(sync), "vow-sync.ts purges only when a row was inserted or updated");
ok(/touchedSlugs\.add\(mSlug\)/.test(sync) && /touchedNeighbourhoods\.add\(/.test(sync), "vow-sync.ts collects the streets and neighbourhoods it wrote");

// ── the pattern set itself ───────────────────────────────────────────────────────────────────
ok(sample.includes("home:sold-mtd:*"), "the homepage month-to-date key is purged whole (every date suffix)");
ok(sample.includes("street-sale-stats:pine-street-milton*"), "a written street's sale stats are purged");
ok(sample.includes("sold-list:nbhd:Old Milton*"), "a written neighbourhood's sold list is purged");
ok(soldPurgePatterns({ streetSlugs: [], neighbourhoods: [] }).length === 2, "a write with no slugs still purges the Milton-wide patterns and nothing per-street");

if (failures.length > 0) {
  console.error(`[sold-cache-purge] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[sold-cache-purge] PASS: ${assertions} assertions; ${sitesSeen} sold-derived cache keys all covered by the sync's purge, which runs on the write path only.`);
