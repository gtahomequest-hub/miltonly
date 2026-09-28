// scripts/audit/verify-strip.mjs — MC-048: are MC-045's WRONG compass sentences gone from the live pages?
//
//   node scripts/audit/verify-strip.mjs [base]        (base defaults to https://miltonly.com)
//
// For each page in scratchpad/mc045/out/class2-wrong-verified.csv (56 pages, 60 claims, 58 distinct
// sentences) it fetches the served HTML and looks for every sentence in the whole document: the prose,
// the hero, the JSON-LD and the meta tags. HTML entities and JSON string escapes are decoded first, and
// curly quotes are folded to straight ones on both sides, so an encoding difference cannot hide a match.
//
// A POSITIVE CONTROL keeps a clean result honest: on every page stripped in MC-048, a sentence that
// the page renders after the strip must be found by the same matcher. The controls come from
// scratchpad/mc048/strip-render.json (scratchpad/mc048/render-diff.ts): sentences that the page's own
// render (stripNumericParagraphs, then the fragment and caveat filters) keeps under all 16 of its option
// combinations, or, for a minimal or needsReview page whose generated prose is not rendered, the
// description's first sentence where the page's summary rule keeps it (hero and JSON-LD place), and the
// JSON-LD place fallback ("A residential street in ...") where that rule keeps nothing. A page whose control is missing is
// reported as UNVERIFIED, not clean.
//
// Exit 0 only when 0 sentences are found and every control is found.
import fs from "node:fs";

const BASE = (process.argv[2] || "https://miltonly.com").replace(/\/$/, "");
const CSV = "scratchpad/mc045/out/class2-wrong-verified.csv";
const RENDER = "scratchpad/mc048/strip-render.json";

function parseCsv(t) {
  const rows = []; let f = "", row = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...b] = rows;
  return b.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, j) => [k, r[j]])));
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };
function normalize(s) {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(["\\/])/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/g, (m, n) => ENT[n] ?? m)
    .replace(/<[^>]+>/g, " ")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
}
const fold = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

const claims = parseCsv(fs.readFileSync(CSV, "utf8"));
const render = fs.existsSync(RENDER) ? JSON.parse(fs.readFileSync(RENDER, "utf8")) : { controls: {} };
const controls = new Map(Object.entries(render.controls || {}).map(([k, v]) => [k, v.map(fold)]));

const bySlug = new Map();
for (const c of claims) bySlug.set(c.slug, [...(bySlug.get(c.slug) || []), c]);
let found = 0, sentences = 0, unverified = [], fetchErrors = [];
const lines = [];
for (const [slug, cs] of bySlug) {
  let html;
  try {
    const r = await fetch(`${BASE}/streets/${slug}`, { headers: { "user-agent": "miltonly-verify mc048-strip" } });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    html = normalize(await r.text());
  } catch (e) { fetchErrors.push(`${slug} ${e.message}`); continue; }
  const texts = [...new Set(cs.map((c) => fold(c.text)))];
  const hits = texts.filter((t) => html.includes(t));
  sentences += texts.length; found += hits.length;
  const pool = controls.get(slug);
  const control = pool ? pool.find((s) => html.includes(s.startsWith("@fallback:") ? s.slice("@fallback:".length) : s)) : null;
  if (pool && !control) unverified.push(slug);
  lines.push(`${hits.length ? "FOUND" : "clean"}  ${slug}: ${hits.length} of ${texts.length} sentence(s) on the page${hits.length ? ` :: ${hits.map((h) => h.slice(0, 70)).join(" | ")}` : ""}; control ${pool ? (control ? "found" : "MISSING") : "none (page not stripped)"}`);
}
for (const l of lines) console.log(l);
console.log(`\n${BASE}: ${found} of ${sentences} distinct sentences found on ${bySlug.size} pages (${claims.length} claims). Controls: ${controls.size - unverified.length} of ${controls.size} found${unverified.length ? `; MISSING on ${unverified.join(", ")}` : ""}. Fetch errors: ${fetchErrors.length}${fetchErrors.length ? ` (${fetchErrors.join("; ")})` : ""}.`);
process.exit(found === 0 && unverified.length === 0 && fetchErrors.length === 0 ? 0 : 1);
