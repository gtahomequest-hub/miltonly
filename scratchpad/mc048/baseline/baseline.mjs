// MC-048 step 0: the GSC baseline for street pages, before anything changes.
//
//   node scratchpad/mc048/baseline/baseline.mjs [endDate]
//
// Window: 28 days ending yesterday (endDate defaults to yesterday in America/Toronto), sc-domain:miltonly.com,
// filtered to pages containing /streets/. The service-account JSON is read from .env
// (GSC_SERVICE_ACCOUNT_KEY, the same credential MC-045's gsc28.mjs read; the morning report calls
// its copy GSC_SERVICE_ACCOUNT_JSON) and is never printed.
//
// Writes, next to this file:
//   pages.csv            page, clicks, impressions, ctr, position (GSC, dimension page)
//   queries.csv          query, clicks, impressions, ctr, position (GSC, dimension query, street pages only)
//   queries-by-page.csv  query, page, clicks, impressions, ctr, position
//   sitemap-join.csv     page, in_sitemap, is_placeholder, impressions, clicks, ctr, position
//   baseline.json        the window, the latest date with data, and the printed numbers
//
// is_placeholder is read off the SERVED page, not inferred: a sitemap street page is a placeholder
// when its HTML carries the "No written profile yet" block (class s-placeholder), which is what a
// searcher lands on. A GSC page that is not in the sitemap gets "n/a".
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const SITE = "https://miltonly.com";
const ymd = (d) => d.toISOString().slice(0, 10);
const shift = (iso, n) => ymd(new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 864e5));
// "Yesterday" is the desk's yesterday, America/Toronto, not UTC's.
const torontoToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
const END = process.argv[2] || shift(torontoToday, -1);
const START = shift(END, -27);

// ── GSC ──────────────────────────────────────────────────────────────────────────────────────
const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find((l) => l.startsWith("GSC_SERVICE_ACCOUNT_KEY="));
if (!line) { console.log("GSC_SERVICE_ACCOUNT_KEY is not in .env: stop and ask for the export files"); process.exit(3); }
let v = line.slice("GSC_SERVICE_ACCOUNT_KEY=".length).trim();
if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
const sa = JSON.parse(v);
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: sa.token_uri, iat: now, exp: now + 3600 })}`;
const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), sa.private_key).toString("base64url");
const tok = await (await fetch(sa.token_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` })).json();
if (!tok.access_token) { console.log(`GSC token refused (${tok.error || "unknown"}): stop and ask for the export files`); process.exit(3); }
const PROP = encodeURIComponent("sc-domain:miltonly.com");
async function q(body) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${PROP}/searchAnalytics/query`, { method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`GSC ${r.status}: ${j.error?.message || "error"}`);
  return j.rows || [];
}
async function all(body) {
  const out = [];
  for (let startRow = 0; ; startRow += 25000) {
    const rows = await q({ ...body, rowLimit: 25000, startRow });
    out.push(...rows);
    if (rows.length < 25000) break;
  }
  return out;
}
const STREETS = [{ filters: [{ dimension: "page", operator: "contains", expression: "/streets/" }] }];
const days = await q({ startDate: START, endDate: END, dimensions: ["date"], rowLimit: 100 });
const latestWithData = days.map((r) => r.keys[0]).sort().pop() || null;
const pages = (await all({ startDate: START, endDate: END, dimensions: ["page"], dimensionFilterGroups: STREETS }))
  .map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
const queries = (await all({ startDate: START, endDate: END, dimensions: ["query"], dimensionFilterGroups: STREETS }))
  .map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
const qbp = (await all({ startDate: START, endDate: END, dimensions: ["query", "page"], dimensionFilterGroups: STREETS }))
  .map((r) => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));

// ── the sitemap and the served placeholder flag ──────────────────────────────────────────────
async function sitemapUrls(url) {
  const xml = await (await fetch(url)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (/<sitemapindex/i.test(xml)) return (await Promise.all(locs.map(sitemapUrls))).flat();
  return locs;
}
const STREET_PAGE = /^https:\/\/(www\.)?miltonly\.com\/streets\/[^/?#]+$/;
const smAll = await sitemapUrls(`${SITE}/sitemap.xml`);
const smStreets = [...new Set(smAll.filter((u) => STREET_PAGE.test(u)))];
const placeholder = new Map();
let idx = 0;
async function worker() {
  while (idx < smStreets.length) {
    const u = smStreets[idx++];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(u, { headers: { "user-agent": "miltonly-verify mc048-baseline" } });
        const html = await r.text();
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        placeholder.set(u, /class="s-placeholder"/.test(html));
        break;
      } catch (e) {
        if (attempt === 2) placeholder.set(u, `error: ${e.message}`);
      }
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

// ── write ────────────────────────────────────────────────────────────────────────────────────
const csvCell = (x) => { const s = String(x ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const writeCsv = (name, cols, rows) => fs.writeFileSync(path.join(HERE, name), [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n");
const r4 = (x) => (typeof x === "number" ? Math.round(x * 10000) / 10000 : x);
writeCsv("pages.csv", ["page", "clicks", "impressions", "ctr", "position"], pages.map((p) => ({ ...p, ctr: r4(p.ctr), position: r4(p.position) })));
writeCsv("queries.csv", ["query", "clicks", "impressions", "ctr", "position"], queries.map((p) => ({ ...p, ctr: r4(p.ctr), position: r4(p.position) })));
writeCsv("queries-by-page.csv", ["query", "page", "clicks", "impressions", "ctr", "position"], qbp.map((p) => ({ ...p, ctr: r4(p.ctr), position: r4(p.position) })));

const gsc = new Map(pages.map((p) => [p.page, p]));
const joinPages = [...new Set([...smStreets, ...pages.map((p) => p.page)])].sort();
const join = joinPages.map((page) => {
  const g = gsc.get(page);
  const inSm = placeholder.has(page);
  return { page, in_sitemap: inSm, is_placeholder: inSm ? placeholder.get(page) : "n/a", impressions: g?.impressions ?? 0, clicks: g?.clicks ?? 0, ctr: g ? r4(g.ctr) : "", position: g ? r4(g.position) : "" };
});
writeCsv("sitemap-join.csv", ["page", "in_sitemap", "is_placeholder", "impressions", "clicks", "ctr", "position"], join);

// ── the numbers the re-read compares against ─────────────────────────────────────────────────
// A "street page" is a /streets/<slug> URL (the /streets index and any URL with a query or a
// fragment are excluded and counted separately). The four numbers, over street pages that had
// at least one impression in the window: how many, their clicks, clicks per page, zero-click share.
function four(rows) {
  const withImp = rows.filter((r) => r.impressions > 0);
  const clicks = withImp.reduce((a, r) => a + r.clicks, 0);
  const zero = withImp.filter((r) => r.clicks === 0).length;
  return {
    pages_with_impressions: withImp.length,
    clicks,
    impressions: withImp.reduce((a, r) => a + r.impressions, 0),
    clicks_per_page: withImp.length ? Math.round((clicks / withImp.length) * 1000) / 1000 : null,
    zero_click_share: withImp.length ? Math.round((zero / withImp.length) * 1000) / 1000 : null,
  };
}
const streetRows = join.filter((r) => STREET_PAGE.test(r.page));
const excluded = join.filter((r) => !STREET_PAGE.test(r.page));
const out = {
  property: "sc-domain:miltonly.com",
  window: { start: START, end: END, latestDateWithData: latestWithData, daysWithData: days.length },
  fetchedAt: new Date().toISOString(),
  sitemap: { streetUrls: smStreets.length, placeholders: [...placeholder.values()].filter((x) => x === true).length, fetchErrors: [...placeholder.values()].filter((x) => typeof x === "string").length },
  gsc: { streetPageRows: pages.length, queryRows: queries.length, queryPageRows: qbp.length },
  all: four(streetRows),
  placeholder: four(streetRows.filter((r) => r.is_placeholder === true)),
  written: four(streetRows.filter((r) => r.is_placeholder === false)),
  notInSitemap: four(streetRows.filter((r) => r.is_placeholder === "n/a")),
  // The n/a rows, split: a www twin of a street URL (the pre-flip host, still indexed) or an apex
  // slug the sitemap does not carry (unpublished, renamed or redirected).
  notInSitemapWww: four(streetRows.filter((r) => r.is_placeholder === "n/a" && /^https:\/\/www\./.test(r.page))),
  notInSitemapApex: four(streetRows.filter((r) => r.is_placeholder === "n/a" && !/^https:\/\/www\./.test(r.page))),
  sitemapPages: four(streetRows.filter((r) => r.in_sitemap)),
  excludedNonStreetUrls: excluded.map((r) => ({ page: r.page, impressions: r.impressions, clicks: r.clicks })),
};
fs.writeFileSync(path.join(HERE, "baseline.json"), JSON.stringify(out, null, 1));
const fmt = (k, o) => `${k.padEnd(34)} pages with impressions ${String(o.pages_with_impressions).padStart(4)} · clicks ${String(o.clicks).padStart(4)} · impressions ${String(o.impressions).padStart(6)} · clicks per page ${o.clicks_per_page} · zero-click share ${o.zero_click_share}`;
console.log(`window ${START}..${END} (latest date with data ${latestWithData}, ${days.length} days with data) · sitemap street URLs ${smStreets.length}, placeholders ${out.sitemap.placeholders}, fetch errors ${out.sitemap.fetchErrors}`);
console.log(fmt("all street pages", out.all));
console.log(fmt("sitemap street pages (the 719)", out.sitemapPages));
console.log(fmt("  of which is_placeholder = true", out.placeholder));
console.log(fmt("  of which is_placeholder = false", out.written));
console.log(fmt("not in the sitemap (n/a)", out.notInSitemap));
console.log(fmt("  of which www twins", out.notInSitemapWww));
console.log(fmt("  of which apex, not published", out.notInSitemapApex));
console.log(`excluded (not /streets/<slug>): ${excluded.length} URL(s), ${excluded.reduce((a, r) => a + r.impressions, 0)} impressions, ${excluded.reduce((a, r) => a + r.clicks, 0)} clicks`);
