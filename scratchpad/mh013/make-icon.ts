// MH-013: writes src/app/design-preview/home/icon.svg, the tab icon for the preview segment only:
// the live icon's "M" (public/icon.svg) in palette 1's on-navy colour on palette 1's navy, from
// tokens.ts. npx tsx scratchpad/mh013/make-icon.ts
import fs from "node:fs";
import { PALETTES } from "../../src/components/home-design/tokens";

const live = fs.readFileSync("public/icon.svg", "utf8");
const d = live.match(/<path d="([^"]+)"/)?.[1];
if (!d) throw new Error("no path in public/icon.svg");
const p = PALETTES["1"];
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="102" fill="${p.navy}"/>
  <path d="${d}" fill="${p.onNavy}"/>
</svg>
`;
fs.writeFileSync("src/app/design-preview/home/icon.svg", out);
console.log(`icon.svg: ${out.length} bytes, ground ${p.navy}, glyph ${p.onNavy}`);
