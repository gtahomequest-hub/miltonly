// MC-048 step 1, read-only: where does each of MC-045's 60 WRONG compass sentences live in the
// stored street content? Exact substring match of the CSV's `text` in every stored field a street
// page can render. Prints one line per sentence and a summary; writes nothing.
//   node scratchpad/mc048/strip-census.mjs
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const parse = (t) => { const rows = []; let i = 0, f = "", row = [], q = false; for (; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += c; } if (f || row.length) { row.push(f); rows.push(row); } const [h, ...b] = rows; return b.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, j) => [k, r[j]]))); };
const wrong = parse(fs.readFileSync("scratchpad/mc045/out/class2-wrong-verified.csv", "utf8"));
const slugs = [...new Set(wrong.map((w) => w.slug))];
const content = await sql`SELECT "streetSlug" s, status, template, "needsReview" nr, description, "metaTitle", "metaDescription", "faqJson", "vipDescription", "rawAiOutput" FROM public."StreetContent" WHERE "streetSlug" = ANY(${slugs})`;
const gens = await sql`SELECT "streetSlug" s, "sectionsJson", "faqJson" FROM public."StreetGeneration" WHERE "streetSlug" = ANY(${slugs})`;
const C = new Map(content.map((r) => [r.s, r])), G = new Map(gens.map((r) => [r.s, r]));

const count = (hay, needle) => (hay ? hay.split(needle).length - 1 : 0);
const summary = {};
for (const w of wrong) {
  const c = C.get(w.slug), g = G.get(w.slug);
  const hits = [];
  if (c) {
    for (const f of ["description", "metaTitle", "metaDescription", "faqJson", "vipDescription", "rawAiOutput"]) { const n = count(c[f], w.text); if (n) hits.push(`StreetContent.${f}×${n}`); }
  }
  if (g) {
    (Array.isArray(g.sectionsJson) ? g.sectionsJson : []).forEach((s) => (s.paragraphs || []).forEach((p, pi) => { const n = count(p, w.text); if (n) hits.push(`sections[${s.id}].p${pi}×${n}`); }));
    (Array.isArray(g.faqJson) ? g.faqJson : []).forEach((q, qi) => { for (const k of ["question", "answer"]) { const n = count(q[k], w.text); if (n) hits.push(`gen.faq[${qi}].${k}×${n}`); } });
  }
  for (const h of hits) { const k = h.replace(/\[[^\]]*\]|\.p\d+|×\d+/g, "").replace(/\[\d+\]/, ""); summary[k] = (summary[k] || 0) + 1; }
  if (!hits.length) summary["NOT FOUND"] = (summary["NOT FOUND"] || 0) + 1;
  console.log(`${w.slug.padEnd(40)} ${c ? `${c.status}/${c.template}${c.nr ? "/needsReview" : ""}` : "NO CONTENT ROW"} gen:${g ? "yes" : "no"} surfaces:[${w.surfaces}] -> ${hits.join(" ") || "NOT FOUND"}`);
}
console.log("\nsummary (sentences by field):", JSON.stringify(summary));
