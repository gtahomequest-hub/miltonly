// MH-013: list every declaration that paints a green in the stylesheets the homepage preview loads,
// with its selector and media query, so each can be given a palette token.
// node scratchpad/mh013/green-decls.mjs [--json]
import fs from "node:fs";

export const FILES = [
  "src/components/nav/site-nav.css",
  "src/components/home/home-theme.css",
  "src/components/home/home-sections.css",
  "src/components/home/footer.css",
  "src/components/vow/vow-card.css",
];

const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b);
  let h = 0, s = 0; const l = (M + m) / 2;
  if (M !== m) {
    const d = M - m;
    s = l > 0.5 ? d / (2 - M - m) : d / (M + m);
    h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
};
export const COLOR_RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
export function isGreen(r, g, b) {
  const [h, s] = hsl(r, g, b);
  return h >= 70 && h <= 175 && s > 0.12;
}
export function parseColor(m) {
  if (m[1]) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1, hex: "#" + h.toLowerCase() };
  }
  return { r: +m[2], g: +m[3], b: +m[4], a: m[5] === undefined ? 1 : +m[5], hex: null };
}

/** Walk a stylesheet into rules: { media, selector, decls: [{prop, value}] }. Comments stripped. */
export function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const walk = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith("@media") || head.startsWith("@supports")) walk(body, [...media, head]);
      else if (!head.startsWith("@")) {
        const decls = body.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
          const k = d.indexOf(":");
          return { prop: d.slice(0, k).trim(), value: d.slice(k + 1).trim() };
        });
        out.push({ media, selector: head, decls });
      }
      i = j;
    }
  };
  walk(css, []);
  return out;
}

export function greenDecls() {
  const found = [];
  for (const f of FILES) {
    for (const r of rules(fs.readFileSync(f, "utf8"))) {
      for (const d of r.decls) {
        const greens = [];
        for (const m of d.value.matchAll(COLOR_RE)) {
          const c = parseColor(m);
          if (isGreen(c.r, c.g, c.b)) greens.push(m[0]);
        }
        if (greens.length) found.push({ file: f, media: r.media, selector: r.selector, prop: d.prop, value: d.value, greens });
      }
    }
  }
  return found;
}

if (process.argv[1] && process.argv[1].endsWith("green-decls.mjs")) {
  const g = greenDecls();
  if (process.argv.includes("--json")) console.log(JSON.stringify(g, null, 1));
  else {
    for (const d of g) console.log(`${d.file.split("/").pop()} | ${d.media.join(" ")} | ${d.selector.replace(/\s+/g, " ")} | ${d.prop}: ${d.value}`);
    console.log(`\n${g.length} declarations in ${new Set(g.map((d) => d.file)).size} files`);
  }
}
