// MH-011: WCAG 2.x contrast for every text pair the street design preview uses, per palette,
// read from the same palettes.ts the page renders. Exit 1 if any pair is under 4.5:1.
import { PALETTES, BRAND } from "../../src/components/street-design/palettes";

const lum = (hex: string) => {
  const c = hex.replace("#", "").match(/../g)!.map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

let fail = 0;
for (const p of Object.values(PALETTES)) {
  const pairs: [string, string, string, string][] = [
    ["body ink on page", "ink", p.ink, p.bg],
    ["body ink on card", "ink", p.ink, p.paper],
    ["muted on page", "muted", p.muted, p.bg],
    ["muted on card", "muted", p.muted, p.paper],
    ["accent on page", "accent", BRAND.accent, p.bg],
    ["accent on card", "accent", BRAND.accent, p.paper],
    ["support on page", "support", p.support, p.bg],
    ["support on card", "support", p.support, p.paper],
    ["support on tint", "support", p.support, p.supportTint],
    ["ink on tint", "ink", p.ink, p.supportTint],
    ["muted on tint", "muted", p.muted, p.supportTint],
    ["forest on tint (found row link)", "forest", BRAND.forest, p.supportTint],
    ["ink on line (map road labels)", "ink", p.ink, p.line],
    ["white on forest", "white", BRAND.white, BRAND.forest],
    ["soft white on forest", "onForestMuted", BRAND.onForestMuted, BRAND.forest],
    ["soft white on forest-soft", "onForestMuted", BRAND.onForestMuted, BRAND.forestSoft],
    ["support-on-dark on forest", "supportOnDark", p.supportOnDark, BRAND.forest],
    ["support-on-dark on forest-soft", "supportOnDark", p.supportOnDark, BRAND.forestSoft],
    ["forest on CTA green", "forest", BRAND.forest, BRAND.cta],
    ["white on accent (button)", "white", BRAND.white, BRAND.accent],
    ["forest on support-on-dark (tag)", "forest", BRAND.forest, p.supportOnDark],
  ];
  console.log(`\n## ${p.key.toUpperCase()} · ${p.name}`);
  console.log("| Pair | Text | Ground | Ratio |\n|---|---|---|---|");
  for (const [label, , fg, bg] of pairs) {
    const r = ratio(fg, bg);
    if (r < 4.5) fail++;
    console.log(`| ${label} | \`${fg}\` | \`${bg}\` | ${r.toFixed(2)}:1${r < 4.5 ? " FAIL" : ""} |`);
  }
}
console.log(`\nPairs under 4.5:1: ${fail}`);
process.exit(fail ? 1 : 0);
