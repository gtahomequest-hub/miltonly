// MC-049 proofs on a served host.
//   node scratchpad/mc049/prod-proof.mjs snapshot <label>     the sitemap's URL set and street lastmods,
//                                                            and the canonical of each proof page
//   node scratchpad/mc049/prod-proof.mjs compare <a> <b>      the two snapshots, key by key
//   node scratchpad/mc049/prod-proof.mjs www                  curl -I equivalents: each www URL's status
//                                                            and Location, and the apex status
import fs from "node:fs";

const BASE = "https://miltonly.com";
const PAGES = ["/", "/streets/zilio-terrace-milton", "/listings", "/listings?page=2&sort=newest"];
const [mode, a, b] = process.argv.slice(2);
fs.mkdirSync("scratchpad/mc049/proof", { recursive: true });

async function sitemap(url) {
  const xml = await (await fetch(url, { headers: { "user-agent": "miltonly-verify mc049" } })).text();
  const locs = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [m[1], m[2] ?? null]);
  const subs = /<sitemapindex/i.test(xml) ? [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
  if (subs.length) return (await Promise.all(subs.map(sitemap))).flat();
  return locs;
}

if (mode === "snapshot") {
  const sm = await sitemap(`${BASE}/sitemap.xml`);
  const canon = {};
  for (const p of PAGES) {
    const r = await fetch(BASE + p, { headers: { "user-agent": "miltonly-verify mc049" } });
    const h = await r.text();
    canon[p] = { status: r.status, canonical: (h.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) || [])[1] ?? null };
  }
  const build = (await (await fetch(`${BASE}/api/build`)).json()).commit;
  const out = {
    at: new Date().toISOString(), build,
    urls: sm.map(([u]) => u).sort(),
    streetLastmods: Object.fromEntries(sm.filter(([u]) => /\/streets\/[^/]+$/.test(u)).map(([u, l]) => [u, l])),
    hosts: [...new Set(sm.map(([u]) => new URL(u).host))],
    canonical: canon,
  };
  fs.writeFileSync(`scratchpad/mc049/proof/snapshot-${a}.json`, JSON.stringify(out, null, 1));
  console.log(`${a}: build ${build.slice(0, 7)}; sitemap ${out.urls.length} URLs on hosts ${out.hosts.join(",")}; ${Object.keys(out.streetLastmods).length} street URLs; canonicals ${JSON.stringify(canon)}`);
} else if (mode === "compare") {
  const A = JSON.parse(fs.readFileSync(`scratchpad/mc049/proof/snapshot-${a}.json`, "utf8"));
  const B = JSON.parse(fs.readFileSync(`scratchpad/mc049/proof/snapshot-${b}.json`, "utf8"));
  const onlyA = A.urls.filter((u) => !B.urls.includes(u)), onlyB = B.urls.filter((u) => !A.urls.includes(u));
  const lmDiff = Object.keys(A.streetLastmods).filter((u) => B.streetLastmods[u] !== A.streetLastmods[u]);
  const canonDiff = Object.keys(A.canonical).filter((p) => JSON.stringify(A.canonical[p]) !== JSON.stringify(B.canonical[p]));
  console.log(`${a} (${A.build.slice(0, 7)}) -> ${b} (${B.build.slice(0, 7)}): sitemap URLs ${A.urls.length} -> ${B.urls.length}; only before ${onlyA.length}, only after ${onlyB.length}${onlyA.length + onlyB.length ? ` (${[...onlyA.map((u) => `-${u}`), ...onlyB.map((u) => `+${u}`)].slice(0, 8).join(" ")})` : ""}; hosts ${B.hosts.join(",")}; street lastmods changed ${lmDiff.length}${lmDiff.length ? ` (${lmDiff.slice(0, 5).join(" ")})` : ""}; canonicals changed ${canonDiff.length}`);
  for (const p of Object.keys(B.canonical)) console.log(`  ${p}: ${B.canonical[p].status} canonical ${B.canonical[p].canonical}`);
} else if (mode === "www") {
  const rows = [];
  for (const p of ["/streets/zilio-terrace-milton", "/", "/listings", "/listings?page=2&sort=newest", "/streets/scott-boulevard-milton?utm_source=mc049&x=a%20b"]) {
    const r = await fetch(`https://www.miltonly.com${p}`, { method: "HEAD", redirect: "manual", headers: { "user-agent": "miltonly-verify mc049" } });
    const loc = r.headers.get("location");
    const want = `https://miltonly.com${p === "/" ? "" : p}`;
    rows.push(`HEAD https://www.miltonly.com${p} -> ${r.status} ${loc}  ${r.status === 308 && (loc === want || loc === `${want}/` || (p === "/" && loc === "https://miltonly.com/")) ? "OK" : "UNEXPECTED"}`);
    const ap = await fetch(`https://miltonly.com${p}`, { method: "GET", redirect: "manual", headers: { "user-agent": "miltonly-verify mc049" } });
    rows.push(`GET  https://miltonly.com${p} -> ${ap.status}`);
  }
  console.log(rows.join("\n"));
}
