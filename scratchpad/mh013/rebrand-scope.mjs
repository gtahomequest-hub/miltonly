// MH-013: where the green brand lives today, counted, so a site-wide switch to orange, navy and white
// can be sized. Report only: it reads files and writes scratchpad/mh013/rebrand-scope.md.
// node scratchpad/mh013/rebrand-scope.mjs
// A colour counts as green when its hue is 70 to 175 degrees and its saturation is over 0.15 (the same
// rule verify.mjs applies on the page); hex (#rgb, #rrggbb) and rgb()/rgba() are read.
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "scripts", "public", ".github", "tailwind.config.ts", "vercel.json"];
const SKIP = /node_modules|\.next|scratchpad|[\\/]\.git[\\/]|src[\\/]components[\\/]home-design/;
const TEXT = /\.(css|ts|tsx|mjs|js|cjs|json|svg|yml|yaml|md|html)$/;
const files = [];
const walk = (p) => {
  if (SKIP.test(p) || !fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f));
  else files.push(p.split(path.sep).join("/"));
};
ROOTS.forEach(walk);

const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b); let h = 0, s = 0; const l = (M + m) / 2; if (M !== m) { const d = M - m; s = l > 0.5 ? d / (2 - M - m) : d / (M + m); h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s]; };
const RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
const greens = (text) => {
  const out = [];
  for (const m of text.matchAll(RE)) {
    let r, g, b, key;
    if (m[1]) { let h = m[1]; if (h.length === 3) h = h.split("").map((c) => c + c).join(""); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); key = "#" + h.toLowerCase(); }
    else { r = +m[2]; g = +m[3]; b = +m[4]; key = `rgb(${r},${g},${b})`; }
    const [h, s] = hsl(r, g, b);
    if (h >= 70 && h <= 175 && s > 0.15) out.push({ key, index: m.index });
  }
  return out;
};

const cat = (f) => {
  if (f === "tailwind.config.ts") return "Tailwind theme (a green utility scale, not the brand greens)";
  if (f === "src/app/manifest.ts" || f === "src/app/layout.tsx") return "metadata, manifest and theme-color";
  if (/^scripts\/(verify|audit)\//.test(f) || /^scripts\/test-/.test(f) || /^scripts\/probe-/.test(f)) return "checks, tests and probes";
  if (f.startsWith(".github/")) return "workflows";
  if (f.startsWith("public/")) return "public assets";
  if (/og\.png|opengraph-image|twitter-image|card\/|ImageResponse/.test(f)) return "share images";
  if (/^src\/lib\/(email|brief|digest|seo|mail)|email/i.test(f)) return "email templates";
  if (f.endsWith(".css")) return "stylesheets";
  if (/\.(tsx|ts)$/.test(f) && f.startsWith("src/")) return "components and pages (TS/TSX)";
  if (f.startsWith("scripts/")) return "other scripts";
  return "other";
};

const rows = [];
const byKey = {};
const cssVars = [];
let tailwind = 0;
const tailwindByClass = {};
for (const f of files.filter((x) => TEXT.test(x))) {
  const t = fs.readFileSync(f, "utf8");
  const g = greens(t);
  if (!g.length) continue;
  // ImageResponse routes are share images whatever their path
  const c = /ImageResponse/.test(t) && /\.tsx$/.test(f) ? "share images" : /<html|font-family:|style="/.test(t) && /(mail|brief|digest|resend)/i.test(f + t.slice(0, 2000)) && !f.endsWith(".css") && !f.startsWith("scripts/verify") ? (f.startsWith("scripts/") ? "email templates (scripts)" : "email templates") : cat(f);
  rows.push({ f, n: g.length, c });
  for (const x of g) byKey[x.key] = (byKey[x.key] || 0) + 1;
  if (f.endsWith(".css")) {
    for (const m of t.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) if (greens(m[2]).length) cssVars.push(`${f} ${m[1]}`);
  }
  for (const m of t.matchAll(/\b(bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow|accent|placeholder|caret|divide)-\[(#[0-9a-fA-F]{3,6}|rgba?\([^\]]+\))\]/g)) {
    if (greens(m[2]).length) { tailwind++; tailwindByClass[m[1]] = (tailwindByClass[m[1]] || 0) + 1; }
  }
}
const binaries = files.filter((f) => /\.(png|ico|jpg|jpeg|webp)$/.test(f) && f.startsWith("public/") || f === "src/app/favicon.ico");

// the wordmark: its gradient and its face
const wordmark = files.filter((f) => TEXT.test(f) && !f.startsWith("src/components/home-design/")).map((f) => [f, fs.readFileSync(f, "utf8")]).filter(([, t]) => /#ffc400|#ff3d3d/i.test(t)).map(([f, t]) => `${f} (${(t.match(/#ffc400|#ff3d3d/gi) || []).length})`);
const kaushan = files.filter((f) => /\.(css|tsx|ts)$/.test(f)).filter((f) => /font-kaushan|Kaushan_Script/.test(fs.readFileSync(f, "utf8")));

// checks that ASSERT a green (a green inside a comparison, an expect, an ok(), a regex or an includes())
const asserting = [];
for (const r of rows.filter((x) => x.c === "checks, tests and probes")) {
  const lines = fs.readFileSync(r.f, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (!greens(l).length) return;
    if (/\b(ok|assert|expect|includes|test|match|===|!==)\b|\.test\(|\/.*#[0-9a-f]{6}.*\//i.test(l)) asserting.push(`${r.f}:${i + 1}`);
  });
}

// check lines that name the green or the forest (assertion titles, labels, expected strings)
const byName = [];
for (const f of files.filter((x) => /^scripts\/(verify\/checks|audit)\/[^/]+\.mjs$/.test(x))) {
  fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => {
    if (/\bforest (footer|bar|ground|band|nav|panel|theme|header|hero|body|chrome)\b|forest green|signal green|green (signal|cta|button|ring|eyebrow)/i.test(l) && !/^\s*(\/\/|\*)/.test(l)) byName.push(`${f}:${i + 1}`);
  });
}

const sum = (c) => rows.filter((r) => r.c === c).reduce((a, r) => a + r.n, 0);
const cats = [...new Set(rows.map((r) => r.c))].sort((a, b) => sum(b) - sum(a));
let md = `# MH-013 · where the green brand lives\n\nGenerated by \`scratchpad/mh013/rebrand-scope.mjs\` over \`src/\`, \`scripts/\`, \`public/\`, \`.github/\`, \`tailwind.config.ts\` and \`vercel.json\` (not \`scratchpad/\`, and not this branch's own preview under \`src/components/home-design/\`, whose only greens are selectors that match the live classes). A green is any colour with hue 70 to 175 degrees and saturation over 0.15.\n\n`;
md += `**${rows.reduce((a, r) => a + r.n, 0)} green values in ${rows.length} files.**\n\n| Where | Files | Values |\n|---|---|---|\n`;
for (const c of cats) md += `| ${c} | ${rows.filter((r) => r.c === c).length} | ${sum(c)} |\n`;
md += `\n**The values most used:** ${Object.entries(byKey).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `\`${k}\` ${v}`).join(", ")}.\n`;
md += `\n**CSS variables that define a green:** ${cssVars.length}, in ${new Set(cssVars.map((v) => v.split(" ")[0])).size} stylesheets. Switching these switches most of each theme; the hard-coded values beside them do not follow.\n`;
md += `\n**Tailwind arbitrary classes holding a green:** ${tailwind} (${Object.entries(tailwindByClass).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}). These do not follow any variable; each is an edit.\n`;
md += `\n**Checks that assert or compare a green:** ${asserting.length} lines: ${asserting.join(", ") || "none"}.\n`;
md += `\n**Check and audit lines that name the green or the forest in code** (titles, labels and expected strings; read each before changing it, as some describe a layout rather than a colour): ${byName.length}: ${byName.join(", ")}.\n`;
md += `\n**The wordmark:** the gold-to-red gradient appears in ${wordmark.length} files (${wordmark.join("; ")}); the Kaushan face is bound in ${kaushan.length} files (${kaushan.join(", ")}).\n`;
md += `\n**Binary images that may carry the green and cannot be counted by text** (${binaries.length}): ${binaries.join(", ")}. The favicon set and the PNG icons are drawn from \`public/icon.svg\` (forest ground); they are regenerated, not edited.\n`;
md += `\n## Every file\n\n| File | Where | Values |\n|---|---|---|\n`;
for (const r of rows.sort((a, b) => b.n - a.n)) md += `| \`${r.f}\` | ${r.c} | ${r.n} |\n`;
fs.writeFileSync("scratchpad/mh013/rebrand-scope.md", md);
console.log(md.split("## Every file")[0]);
