// MH-012: every text pair the hero paints, measured from tokens.ts (the file the page reads).
// npx tsx scratchpad/mh012/contrast.ts > scratchpad/mh012/contrast.md ; exits 1 if any pair < 4.5:1
import { HD, TEXT_PAIRS } from "../../src/components/home-design/tokens";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let low = 0;
console.log("# MH-012 · hero text contrast, from tokens.ts\n");
console.log("| Pair | Text | Ground | Ratio | 4.5:1 |");
console.log("|---|---|---|---|---|");
for (const [name, fg, bg] of TEXT_PAIRS) {
  const r = ratio(HD[fg], HD[bg]);
  if (r < 4.5) low++;
  console.log(`| ${name} | \`${HD[fg]}\` | \`${HD[bg]}\` | ${r.toFixed(2)}:1 | ${r >= 4.5 ? "pass" : "FAIL"} |`);
}
console.log(`\n${TEXT_PAIRS.length} pairs, ${low} under 4.5:1.`);
process.exit(low ? 1 : 0);
