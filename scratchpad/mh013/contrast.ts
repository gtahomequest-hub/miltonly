// MH-013: every text pair the preview paints, in all three palettes, measured from tokens.ts (the file
// the page reads). npx tsx scratchpad/mh013/contrast.ts > scratchpad/mh013/contrast.md ; exits 1 if any pair < 4.5:1
import { PALETTES, TEXT_PAIRS, type PaletteKey } from "../../src/components/home-design/tokens";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const keys: PaletteKey[] = ["1", "2", "3"];
let low = 0;
let min = 99;
console.log("# MH-013 · text contrast, every pair, from tokens.ts\n");
console.log(`| Pair | ${keys.map((k) => `${k} · ${PALETTES[k].name}`).join(" | ")} |`);
console.log(`|---|${keys.map(() => "---").join("|")}|`);
for (const [name, fg, bg] of TEXT_PAIRS) {
  const cells = keys.map((k) => {
    const p = PALETTES[k];
    const r = ratio(p[fg], p[bg]);
    min = Math.min(min, r);
    if (r < 4.5) low++;
    return `\`${p[fg]}\` on \`${p[bg]}\` ${r.toFixed(2)}:1${r < 4.5 ? " FAIL" : ""}`;
  });
  console.log(`| ${name} | ${cells.join(" | ")} |`);
}
console.log(`\n${TEXT_PAIRS.length} pairs × 3 palettes = ${TEXT_PAIRS.length * 3} measurements, ${low} under 4.5:1, lowest ${min.toFixed(2)}:1.`);
process.exit(low ? 1 : 0);
