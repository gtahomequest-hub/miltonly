// scripts/test-street-head.ts, MC-048: every street's <title> and meta description, held to the one
// format (src/lib/streetHead.ts) at prebuild.
//
// OVER EVERY STREET, TWO WAYS:
//   - every PUBLISHED street (StreetContent, status published), named the way the page names it:
//     resolveStreetName(slug, ruralSideRoadName(slug) ?? StreetContent.streetName), the H1's name
//     (street-data.ts:448-461; the H1 renders data.name, which is data.street.name);
//   - every street in the Town registry, named by the registry, so a street published after this
//     build is already held to the rule.
// For each: the title within 65 characters on the first rung that fits (a street that fits none
// FAILS THE BUILD and is named); the meta within 155; no en-dash or em-dash; nothing sold-derived
// (no $, no price figure or the word outside the title's own ", prices", no sales, no days, no
// "typical", no "median", "sold" only as "sold history"); exactly one format each, byte for byte;
// sentence case after the colon; the address count and range the Town's, never invented.
// Then the wiring, read from source: generateMetadata passes the one title to og:title and
// twitter:title, and the sitemap floors a street's lastmod at the head's revision date.
import fs from "node:fs";

function loadEnvLocal(): void {
  try {
    const raw = fs.readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";
import { streetTitle, streetMeta, addressRangeOf, STREET_TITLE_MAX, STREET_META_MAX, type StreetAddressRange } from "@/lib/streetHead";
import { townAddressesForSlug } from "@/lib/town/addresses";
import { resolveStreetName } from "@/lib/streetName";
import { ruralSideRoadName } from "@/lib/streetUtils";
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { config } from "@/lib/config";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(msg);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`); // en-dash, em-dash
const CITY = config.CITY_NAME;
const SITE = config.SITE_NAME;

function rangeFor(slug: string): StreetAddressRange | null {
  return addressRangeOf(townAddressesForSlug(slug)?.addresses.map((a) => a.n));
}

/** Every rule, for one street. Returns the rung and the meta shape for the tallies. */
function check(where: string, slug: string, name: string) {
  const t = streetTitle(name);
  const range = rangeFor(slug);
  const m = streetMeta(name, range);
  const tag = `${where} ${slug} ("${name}")`;

  // the ceilings; a street no rung fits fails the build by name
  ok(t.fits && t.title.length <= STREET_TITLE_MAX, `${tag}: title over ${STREET_TITLE_MAX} on every rung (${t.title.length}): "${t.title}"`);
  ok(m.fits && m.description.length <= STREET_META_MAX, `${tag}: meta over ${STREET_META_MAX} (${m.description.length}): "${m.description}"`);

  // exactly one format each, byte for byte, and the first rung that fits
  const titleShape = new RegExp(`^${esc(name)}, ${CITY}: homes, sold history(, prices)?( \\| ${SITE})?$`);
  ok(titleShape.test(t.title), `${tag}: title is not the one format: "${t.title}"`);
  const rungs = [`${name}, ${CITY}: homes, sold history, prices | ${SITE}`, `${name}, ${CITY}: homes, sold history | ${SITE}`, `${name}, ${CITY}: homes, sold history`];
  const first = rungs.find((r) => r.length <= STREET_TITLE_MAX);
  ok(!first || t.title === first, `${tag}: title is not the first rung that fits`);
  if (range) {
    const exact = `${range.count} addresses on ${name}, numbered ${range.low} to ${range.high}. Every one listed, with its sold history for registered readers.`;
    ok(m.description === `${exact} Free to register.` || (m.description === exact && `${exact} Free to register.`.length > STREET_META_MAX),
      `${tag}: meta is not the address shape with the Town's count ${range.count} and range ${range.low} to ${range.high}: "${m.description}"`);
  } else {
    ok(m.description === `${name}, ${CITY}: every address on the street, with sold history for registered readers.`, `${tag}: meta is not the no-address-data shape: "${m.description}"`);
    ok(!/\d/.test(m.description.replace(name, "")), `${tag}: a street with no Town address count carries a number: "${m.description}"`);
  }

  // banned characters and patterns, outside the street's own name
  for (const [label, text] of [["title", t.title], ["meta", m.description]] as const) {
    const rest = text.split(name).join(" ");
    ok(!DASH.test(text), `${tag}: ${label} carries an en-dash or em-dash: "${text}"`);
    ok(!/\$/.test(rest), `${tag}: ${label} carries a $`);
    ok(!/\b(median|typical|typically|average)\b/i.test(rest), `${tag}: ${label} names a statistic: "${text}"`);
    ok(!/\b(days?|sales?|sold for|listings? sold)\b/i.test(rest), `${tag}: ${label} carries a sales or days figure word: "${text}"`);
    ok(!/\bsold\b(?! history)/i.test(rest), `${tag}: ${label} uses "sold" other than "sold history": "${text}"`);
    const noPriceSuffix = label === "title" ? rest.replace(`, prices | ${SITE}`, "") : rest;
    ok(!/pric/i.test(noPriceSuffix), `${tag}: ${label} mentions a price outside the title's ", prices": "${text}"`);
    const afterColon = text.match(/: (.)/);
    ok(!afterColon || afterColon[1] === afterColon[1].toLowerCase(), `${tag}: ${label} is not sentence case after the colon: "${text}"`);
  }
  ok(!/\d/.test(t.title.split(name).join(" ")), `${tag}: the title carries a number outside the name`);
  return { rung: t.rung, shape: m.shape };
}

async function main() {
  // ── the rule on its own, on fixtures ───────────────────────────────────────────────────────
  ok(streetTitle("Main Street").title === "Main Street, Milton: homes, sold history, prices | Miltonly", "fixture: rung 1");
  const r2 = streetTitle("Centennial Forest Drive");
  ok(r2.rung === 2 && r2.title === "Centennial Forest Drive, Milton: homes, sold history | Miltonly", `fixture: rung 2 (${r2.title})`);
  const r3 = streetTitle("Nassagaweya Esquesing Townline");
  ok(r3.rung === 3 && r3.title === "Nassagaweya Esquesing Townline, Milton: homes, sold history", `fixture: rung 3 (${r3.title})`);
  ok(!streetTitle("A Street Name Long Enough To Break Every Rung Of The Ladder").fits, "fixture: a name no rung fits is reported as not fitting");
  ok(addressRangeOf([12]) === null && addressRangeOf([]) === null && addressRangeOf(null) === null && addressRangeOf([7, 7]) === null, "fixture: fewer than two distinct numbers is no range");
  ok(streetMeta("Main Street", addressRangeOf([2, 40, 8])).description === "3 addresses on Main Street, numbered 2 to 40. Every one listed, with its sold history for registered readers. Free to register.", "fixture: the address shape");
  const longName = "X".repeat(60);
  const short = streetMeta(longName, { count: 999, low: 1, high: 9999 });
  ok(short.shape === "addresses-short" && !short.description.endsWith("Free to register."), "fixture: over 155, the last sentence goes");
  ok(streetMeta("Main Street", null).description === "Main Street, Milton: every address on the street, with sold history for registered readers.", "fixture: the no-address-data shape");

  // ── every published street, named as the page names it ─────────────────────────────────────
  const published = await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true, streetName: true } });
  ok(published.length > 600, `the published set read back (${published.length} rows)`);
  const tally = { rung: { 1: 0, 2: 0, 3: 0 } as Record<number, number>, shape: {} as Record<string, number> };
  for (const p of published) {
    const name = resolveStreetName(p.streetSlug, ruralSideRoadName(p.streetSlug) ?? p.streetName).name;
    const r = check("published", p.streetSlug, name);
    tally.rung[r.rung]++;
    tally.shape[r.shape] = (tally.shape[r.shape] || 0) + 1;
  }
  // ── every registry street, so a street published after this build is already held ──────────
  for (const reg of MILTON_STREET_REGISTRY) check("registry", reg.slug, resolveStreetName(reg.slug).name);

  // ── the wiring, from source ────────────────────────────────────────────────────────────────
  const page = fs.readFileSync("src/app/streets/[slug]/page.tsx", "utf8");
  const gm = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("export default async function StreetPage"));
  ok(/const \{ title \} = streetTitle\(data\.street\.name\);/.test(gm), "generateMetadata builds the title from data.street.name, the H1's name");
  ok(/streetMeta\(data\.street\.name, addressRangeOf\(town\?\.addresses\.map\(\(a\) => a\.n\)\)\)/.test(gm), "generateMetadata builds the meta from the Town's addresses for the slug");
  ok(/openGraph: \{\s*title,\s*description,/.test(gm), "og:title is the title and og:description the meta");
  ok(/twitter: \{ card: "summary_large_image", title, description,/.test(gm), "twitter:title is the title and twitter:description the meta");
  ok(!/formatCAD|windowDisclosure|saleBasis|sale12mo|lease12mo|characterSummary|typical/.test(gm.replace(/\/\/.*$/gm, "")), "generateMetadata reads nothing sold-derived");
  const v2 = fs.readFileSync("src/lib/streetV2Data.ts", "utf8");
  ok(/name: data\.street\.name,/.test(v2), "the H1's name is data.street.name");
  const sitemap = fs.readFileSync("src/app/sitemap.ts", "utf8");
  ok(/lastModified: s\.updatedAt > STREET_HEAD_REVISED_AT \? s\.updatedAt : STREET_HEAD_REVISED_AT,/.test(sitemap), "the sitemap floors a street's lastmod at the head's revision date");

  await prisma.$disconnect();
  if (failures.length) {
    console.error(`[street-head] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures.slice(0, 60)) console.error(`  ${f}`);
    if (failures.length > 60) console.error(`  … and ${failures.length - 60} more`);
    process.exit(1);
  }
  console.log(`[street-head] PASS: ${assertions} assertions. ${published.length} published streets (title rungs 1/2/3: ${tally.rung[1]}/${tally.rung[2]}/${tally.rung[3]}; meta ${Object.entries(tally.shape).map(([k, n]) => `${k} ${n}`).join(", ")}) and ${MILTON_STREET_REGISTRY.length} registry streets, one format each, within ${STREET_TITLE_MAX} and ${STREET_META_MAX}.`);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
