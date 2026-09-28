// MC-048: every sitemap street page's head and identity, from a served host, for a before/after diff.
//   node scratchpad/mc048/head-snapshot.mjs <base> <label>
// Writes scratchpad/mc048/heads/<label>.json: per page the served commit, <title>, meta description,
// og:title, og:description, twitter:title, twitter:description, canonical, H1 text, and the JSON-LD
// names that identify the page (WebPage.name, Place.name, Place.description).
import fs from "node:fs";

const [base, label] = process.argv.slice(2);
const B = base.replace(/\/$/, "");
const decode = (s) => (s || "").replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const metaOf = (html, attr, key) => decode((html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, "i")) || html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${key}"`, "i")) || [])[1]);
async function sitemapUrls(url) {
  const xml = await (await fetch(url)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const lastmods = Object.fromEntries([...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
  if (/<sitemapindex/i.test(xml)) { const parts = await Promise.all(locs.map(sitemapUrls)); return { locs: parts.flatMap((p) => p.locs), lastmods: Object.assign({}, ...parts.map((p) => p.lastmods)) }; }
  return { locs, lastmods };
}
const sm = await sitemapUrls(`${B}/sitemap.xml`);
const urls = sm.locs.filter((u) => /\/streets\/[^/?#]+$/.test(u)).map((u) => u.replace(/^https:\/\/miltonly\.com/, B));
const out = {};
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    const slug = u.split("/streets/")[1];
    for (let a = 0; a < 3; a++) {
      try {
        const r = await fetch(u, { headers: { "user-agent": "miltonly-verify mc048-head" } });
        const html = await r.text();
        const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => { try { return [JSON.parse(m[1])]; } catch { return []; } });
        const nodes = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o["@type"]) nodes.push(o); Object.values(o).forEach(walk); } }; walk(ld);
        const web = nodes.find((n) => n["@type"] === "WebPage"); const place = nodes.find((n) => n["@type"] === "Place");
        out[slug] = {
          status: r.status,
          title: decode((html.match(/<title>([^<]*)<\/title>/) || [])[1]),
          description: metaOf(html, "name", "description"),
          ogTitle: metaOf(html, "property", "og:title"), ogDescription: metaOf(html, "property", "og:description"),
          twitterTitle: metaOf(html, "name", "twitter:title"), twitterDescription: metaOf(html, "name", "twitter:description"),
          canonical: decode((html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) || [])[1]),
          h1: decode(((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()),
          ldWebPageName: web?.name ?? null, ldPlaceName: place?.name ?? null, ldPlaceDescription: place?.description ?? null,
          ldTypes: [...new Set(nodes.map((n) => n["@type"]))].sort().join(","),
          lastmod: sm.lastmods[`https://miltonly.com/streets/${slug}`] ?? null,
        };
        break;
      } catch (e) { if (a === 2) out[slug] = { error: e.message }; }
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const build = await (await fetch(`${B}/api/build`)).json().catch(() => ({}));
fs.mkdirSync("scratchpad/mc048/heads", { recursive: true });
fs.writeFileSync(`scratchpad/mc048/heads/${label}.json`, JSON.stringify({ base: B, at: new Date().toISOString(), commit: build.commit ?? null, count: Object.keys(out).length, pages: out }, null, 1));
console.log(`${label}: ${Object.keys(out).length} street pages from ${B} at ${build.commit ?? "?"}; errors ${Object.values(out).filter((p) => p.error || p.status !== 200).length}`);
