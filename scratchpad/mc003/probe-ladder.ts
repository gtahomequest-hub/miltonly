import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { neon } from "@neondatabase/serverless";
function loadEnvLocal() { const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8"); for (const line of content.split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); if (process.env[k] === undefined) process.env[k] = v; } }
loadEnvLocal();
const db1 = neon((process.env.DATABASE_URL || "").trim());
async function main() {
  const r = await db1`select count(*)::int n from "StreetContent" c join "ResidentialStreet" r on r.slug = c."streetSlug" join "Neighbourhood" n on n.id = r."neighbourhoodId" where c.status='published' and n.slug='timberlea'`;
  const html = await (await fetch("https://miltonly.com/neighbourhoods/timberlea", { cache: "no-store" })).text();
  const body = html.replace(/<script[\s\S]*?<\/script>/g, " ");
  const rows = (body.match(/class="hh-ladname"/g) || []).length;
  const sitemap = await (await fetch("https://miltonly.com/sitemap.xml")).text();
  const inSitemap = [...sitemap.matchAll(/<loc>[^<]*\/streets\/([^<]+)<\/loc>/g)].map((m) => m[1]);
  const slugs = (await db1`select c."streetSlug" from "StreetContent" c join "ResidentialStreet" r on r.slug = c."streetSlug" join "Neighbourhood" n on n.id = r."neighbourhoodId" where c.status='published' and n.slug='timberlea'`).map((x) => x.streetSlug as string);
  const listed = slugs.filter((s) => inSitemap.includes(s)).length;
  console.log(`timberlea: published rows ${r[0].n}, of which in the sitemap ${listed}; ladder rows rendered ${rows}`);
}
main();
