// MC-048: the street heads after the deploy, against the snapshot before it, on every sitemap street.
//   node scratchpad/mc048/head-diff.mjs <before-label> <after-label> [slug ...]
// Asserts on every page: the title is the one format for the page's own H1 and within 65; the meta is
// one of the shapes and within 155; no en-dash or em-dash, no $, no statistic, no sales or days word,
// "sold" only as "sold history", "price" only in the title's ", prices"; og:title = twitter:title =
// title and og:description = twitter:description = meta; the H1, the canonical, the JSON-LD WebPage
// name, Place name and node types unchanged; the sitemap lastmod on or after the head's revision date.
// Prints the named slugs in full with their lengths.
import fs from "node:fs";

const [bl, al, ...named] = process.argv.slice(2);
const B = JSON.parse(fs.readFileSync(`scratchpad/mc048/heads/${bl}.json`, "utf8"));
const A = JSON.parse(fs.readFileSync(`scratchpad/mc048/heads/${al}.json`, "utf8"));
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REVISED = "2026-09-28";
const fails = [];
const tally = { pages: 0, rung: { 1: 0, 2: 0, 3: 0 }, meta: { addresses: 0, "addresses-short": 0, "no-address-data": 0 } };
for (const [slug, a] of Object.entries(A.pages)) {
  const b = B.pages[slug];
  const f = (m) => fails.push(`${slug}: ${m}`);
  if (a.error || a.status !== 200) { f(`fetch ${a.error || a.status}`); continue; }
  tally.pages++;
  const name = a.h1;
  const t = a.title, d = a.description;
  const tm = t.match(new RegExp(`^${esc(name)}, Milton: homes, sold history(, prices)?( \\| Miltonly)?$`));
  if (!tm) f(`title not the format for H1 "${name}": "${t}"`);
  else tally.rung[tm[1] ? 1 : tm[2] ? 2 : 3]++;
  if (t.length > 65) f(`title ${t.length} > 65`);
  const mA = d.match(new RegExp(`^(\\d+) addresses on ${esc(name)}, numbered (\\d+) to (\\d+)\\. Every one listed, with its sold history for registered readers\\.( Free to register\\.)?$`));
  const mN = d === `${name}, Milton: every address on the street, with sold history for registered readers.`;
  if (mA) { tally.meta[mA[4] ? "addresses" : "addresses-short"]++; if (!(Number(mA[2]) < Number(mA[3]) && Number(mA[1]) >= 2)) f(`meta range not a range: "${d}"`); }
  else if (mN) tally.meta["no-address-data"]++;
  else f(`meta not a shape: "${d}"`);
  if (d.length > 155) f(`meta ${d.length} > 155`);
  for (const [k, s] of [["title", t], ["meta", d]]) {
    const rest = s.split(name).join(" ");
    if (DASH.test(s)) f(`${k} has an en-dash or em-dash`);
    if (/\$|\b(median|typical|typically|average|days?|sales?)\b/i.test(rest)) f(`${k} carries a banned word or $: "${s}"`);
    if (/\bsold\b(?! history)/i.test(rest)) f(`${k} uses "sold" outside "sold history"`);
    if (/pric/i.test(k === "title" ? rest.replace(", prices | Miltonly", "") : rest)) f(`${k} mentions a price outside ", prices"`);
  }
  if (a.ogTitle !== t || a.twitterTitle !== t) f(`og/twitter title differs: og "${a.ogTitle}" twitter "${a.twitterTitle}"`);
  if (a.ogDescription !== d || a.twitterDescription !== d) f(`og/twitter description differs`);
  if (!b) { f("not in the before snapshot"); continue; }
  for (const k of ["h1", "canonical", "ldWebPageName", "ldPlaceName", "ldTypes"]) if (a[k] !== b[k]) f(`${k} changed: "${b[k]}" -> "${a[k]}"`);
  if (!a.lastmod || a.lastmod.slice(0, 10) < REVISED) f(`sitemap lastmod ${a.lastmod} is before ${REVISED}`);
}
for (const slug of Object.keys(B.pages)) if (!A.pages[slug]) fails.push(`${slug}: in the before snapshot, missing after`);
console.log(`${A.base} at ${A.commit} against ${B.commit}: ${tally.pages} street pages; title rungs 1/2/3 ${tally.rung[1]}/${tally.rung[2]}/${tally.rung[3]}; meta ${JSON.stringify(tally.meta)}; failures ${fails.length}`);
for (const x of fails.slice(0, 40)) console.log(`  FAIL ${x}`);
for (const slug of named) {
  const a = A.pages[slug], b = B.pages[slug];
  if (!a) { console.log(`\n${slug}: not in the sitemap`); continue; }
  console.log(`\n${slug}  (H1 "${a.h1}", ${a.h1.length} characters)`);
  console.log(`  title (${a.title.length}): ${a.title}`);
  console.log(`  meta (${a.description.length}): ${a.description}`);
  console.log(`  og:title = title: ${a.ogTitle === a.title}; twitter:title = title: ${a.twitterTitle === a.title}; canonical ${a.canonical}; lastmod ${a.lastmod}`);
  if (b) console.log(`  before: title (${b.title.length}) ${b.title} | meta (${b.description.length}) ${b.description}`);
}
process.exit(fails.length ? 1 : 0);
