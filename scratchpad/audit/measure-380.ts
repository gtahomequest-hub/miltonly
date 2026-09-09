// One-off measurement for QUEUE item 3, step 6: at 380px, is every mark tappable when its label
// is suppressed, and is no label clipped at either end of the spine?
//
// Pure. No DB, no network at render time — buildAddressLadder takes the listing rows as an
// argument, so passing none renders the ladder the Town's data alone produces. `active` marks are
// the only thing DB1 changes and they do not move a mark; the placement walk is identical.
//
// At <=560px (which is what 380px is) a suppressed mark is `.s-m.s-q { width: 58px; height: 14px }`.
// So the invariant to prove corpus-wide is: no two marks on the SAME SIDE are closer than 14px,
// and nothing sits above the reserved end padding.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { buildAddressLadder } from "../../src/lib/streetAddresses";
import { StreetAddresses } from "../../src/components/street/v2/AddressLadder";
import type { StreetV2Data } from "../../src/components/street/v2/types";

const HIT = 14; // .s-m.s-q height at <=560px, and DOT_GAP
const END_PAD = 34;

const slugs = readFileSync("scratchpad/audit/060-slugs.txt", "utf8").split("\n").map((s) => s.trim()).filter(Boolean);

let withLadder = 0;
let marksTotal = 0;
let quietTotal = 0;
let minGapSeen = Infinity;
let minTopSeen = Infinity;
let minGapStreet = "";
const tooClose: string[] = [];
const clipped: string[] = [];
let widest = { slug: "", marks: 0 };

for (const slug of slugs) {
  const ladder = buildAddressLadder({ slug, streetName: "Street", listings: [], linkableSlugs: new Set() });
  if (!ladder) continue;
  withLadder++;
  const data = { name: "Street", addresses: ladder } as unknown as StreetV2Data;
  const markup = renderToStaticMarkup(createElement(StreetAddresses, { data }));

  const rows = [...markup.matchAll(/class="(s-m[^"]*)"[^>]*style="top:(\d+)px"/g)].map((m) => ({
    even: m[1].includes("s-e"),
    quiet: m[1].includes("s-q"),
    top: Number(m[2]),
  }));
  marksTotal += rows.length;
  quietTotal += rows.filter((r) => r.quiet).length;
  if (rows.length > widest.marks) widest = { slug, marks: rows.length };

  const top = Math.min(...rows.map((r) => r.top));
  if (top < minTopSeen) minTopSeen = top;
  if (top < END_PAD - 4) clipped.push(`${slug} top=${top}`);

  for (const side of [true, false]) {
    const col = rows.filter((r) => r.even === side).sort((a, b) => a.top - b.top);
    for (let i = 1; i < col.length; i++) {
      const gap = col[i].top - col[i - 1].top;
      if (gap < minGapSeen) {
        minGapSeen = gap;
        minGapStreet = `${slug} ${side ? "even" : "odd"}`;
      }
      if (gap < HIT) tooClose.push(`${slug} ${side ? "even" : "odd"} ${col[i - 1].top}->${col[i].top} gap=${gap}`);
    }
  }
}

console.log(`streets with a ladder      ${withLadder} of ${slugs.length} published`);
console.log(`marks rendered             ${marksTotal}`);
console.log(`labels suppressed          ${quietTotal}`);
console.log(`densest street             ${widest.slug} (${widest.marks} marks)`);
console.log(`minimum same-side gap      ${minGapSeen}px  (hit area ${HIT}px)  at ${minGapStreet}`);
console.log(`minimum top                ${minTopSeen}px  (END_PAD ${END_PAD}px)`);
console.log(`marks closer than the hit area   ${tooClose.length}`);
console.log(`streets with a clipped end label ${clipped.length}`);
if (tooClose.length) console.log(tooClose.slice(0, 10).join("\n"));
if (clipped.length) console.log(clipped.slice(0, 10).join("\n"));
process.exit(tooClose.length === 0 && clipped.length === 0 ? 0 : 1);
