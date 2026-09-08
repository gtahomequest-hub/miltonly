// scripts/verify/address-anchors.mjs
// Verify the address-anchor section on a deployed host. Read-only, no auth.
//
//   BASE=https://<preview>.vercel.app node scripts/verify/address-anchors.mjs
//
// Checks the three things the section can get wrong in a way a local build cannot see: the
// section rendered at all, the anchors are the bare house numbers, and the ItemList that ships
// with the page carries no price-shaped key or value on any address.

const BASE = process.env.BASE || "https://miltonly.com";
const STREETS = [
  { slug: "pine-street-milton", name: "Pine Street", anchor: 262 },
  { slug: "mae-court-milton", name: "Mae Court", anchor: 71 },
  { slug: "mcphail-way-milton", name: "McPhail Way", anchor: 3165 },
  { slug: "bell-school-line-milton", name: "Bell School Line", anchor: 7295 },
];

const PRICE_KEY = /price|offer|amount|currency|cost|valuation/i;
const PRICE_VALUE = /\$|\b\d{3},\d{3}\b|\b\d{6,}\b/;

function scanForPrice(node, path, out) {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    if (PRICE_VALUE.test(node)) out.push(`price-shaped VALUE at ${path}: ${node}`);
    return;
  }
  if (typeof node === "number") {
    if (node >= 100000) out.push(`price-shaped NUMBER at ${path}: ${node}`);
    return;
  }
  if (Array.isArray(node)) return node.forEach((v, i) => scanForPrice(v, `${path}[${i}]`, out));
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (PRICE_KEY.test(k)) out.push(`price-shaped KEY at ${path}.${k}`);
      scanForPrice(v, `${path}.${k}`, out);
    }
  }
}

let failures = 0;
const say = (mark, line) => console.log(`  ${mark} ${line}`);

for (const s of STREETS) {
  const url = `${BASE}/streets/${s.slug}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.log(`${s.slug}: HTTP ${res.status} — no page`);
    if (res.status !== 404) failures += 1;
    continue;
  }
  // React SSR writes a <!-- --> separator between adjacent text nodes, so the heading arrives as
  // "<h2>Addresses on <!-- -->Pine Street</h2>". Strip the markers before matching text.
  const html = (await res.text()).replaceAll("<!-- -->", "");
  console.log(`${s.slug}: HTTP 200`);

  const hasH2 = html.includes(`<h2>Addresses on ${s.name}</h2>`);
  if (!hasH2) failures += 1;
  say(hasH2 ? "ok" : "XX", `H2 "Addresses on ${s.name}"`);

  const marks = [...html.matchAll(/<(?:a|span)\s[^>]*id="([^"]+)"[^>]*class="s-m[^"]*"/g)].map((m) => m[1]);
  const marksAlt = [...html.matchAll(/<(?:a|span)\s[^>]*class="s-m[^"]*"[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  const allIds = [...new Set([...marks, ...marksAlt])];
  const numeric = allIds.length > 0 && allIds.every((v) => /^[0-9]+$/.test(v));
  if (!numeric) failures += 1;
  say(numeric ? "ok" : "XX", `${allIds.length} address anchors, all numeric`);

  const anchored = html.includes(`id="${s.anchor}"`) && html.includes(`href="#${s.anchor}"`);
  if (!anchored) failures += 1;
  say(anchored ? "ok" : "XX", `${url}#${s.anchor} resolves to a mark`);

  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  let list = null;
  for (const b of blocks) {
    let json;
    try {
      json = JSON.parse(b[1]);
    } catch {
      continue;
    }
    const graph = Array.isArray(json?.["@graph"]) ? json["@graph"] : [json];
    for (const node of graph) {
      if (node?.["@type"] === "ItemList" && String(node["@id"] ?? "").endsWith("#addresses")) list = node;
    }
  }
  if (!list) {
    failures += 1;
    say("XX", "addresses ItemList in JSON-LD");
    continue;
  }
  say("ok", `ItemList ${list.numberOfItems} items`);

  const bad = [];
  scanForPrice(list, "ItemList", bad);
  if (bad.length > 0) failures += 1;
  say(bad.length === 0 ? "ok" : "XX", `no price in the ItemList${bad.length ? `: ${bad.slice(0, 3).join("; ")}` : ""}`);

  const shapes = list.itemListElement.every(
    (li) =>
      li.item?.["@type"] === "PostalAddress" &&
      li.item.addressLocality === "Milton" &&
      li.item.addressRegion === "ON" &&
      !("addressCountry" in li.item) &&
      /#\d+$/.test(String(li.item.url))
  );
  if (!shapes) failures += 1;
  say(shapes ? "ok" : "XX", "every item is a PostalAddress in Milton, ON, anchored by number");
}

console.log(failures === 0 ? `\naddress-anchors PASS on ${BASE}` : `\naddress-anchors FAIL (${failures}) on ${BASE}`);
process.exit(failures === 0 ? 0 : 1);
