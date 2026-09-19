// scripts/hub-membership-reconcile.ts
//
// MC-027 item 5. Hub membership comes from the registry only (ResidentialStreet.neighbourhoodId):
// the street page's up-link and the hub's ladder read that one column now. This script says, for
// every published street page, whether the SALES STRINGS on its sold records (the TREB
// neighbourhood string, mapped through Neighbourhood.rawStrings) agree with the registry row,
// and applies the data fixes the disagreement licenses:
//
//   · registry row has NO neighbourhood and the sales strings map to exactly one published hub:
//     the row takes that hub (the Town's polygon assignment never reached it; the records say
//     where it is).
//   · registry row names one hub and the sales strings name another: LISTED, never changed here.
//     The Town's polygon put the street where it is; a record that says otherwise is a listing
//     agent's choice of string, and which is right is a look at the map, not a script.
//   · registry row has no ResidentialStreet at all: listed (no row to fix).
//
// Usage:
//   npx tsx --tsconfig tsconfig.test.json scripts/hub-membership-reconcile.ts            # dry run
//   npx tsx --tsconfig tsconfig.test.json scripts/hub-membership-reconcile.ts --write

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();
const WRITE = process.argv.includes("--write");
const db1 = neon((process.env.DATABASE_URL || "").trim());
const db2 = neon((process.env.SOLD_DATABASE_URL || "").trim());

async function main() {
  const hoods = (await db1`SELECT id, slug, name, "rawStrings" FROM public."Neighbourhood"`) as Array<{ id: string; slug: string; name: string; rawStrings: string[] }>;
  const published = new Set(((await db1`SELECT "neighbourhoodSlug" s FROM public."HubContent" WHERE status = 'published'`) as Array<{ s: string }>).map((r) => r.s));
  const rawToHub = new Map<string, string>();
  const slugById = new Map<string, string>();
  for (const h of hoods) { slugById.set(h.id, h.slug); for (const r of h.rawStrings ?? []) rawToHub.set(r, h.slug); }
  const idBySlug = new Map(hoods.map((h) => [h.slug, h.id]));

  const pages = (await db1`SELECT "streetSlug" s FROM public."StreetContent" WHERE status = 'published' ORDER BY 1`) as Array<{ s: string }>;
  const rows = (await db1`SELECT slug, "neighbourhoodId" nid FROM public."ResidentialStreet"`) as Array<{ slug: string; nid: string | null }>;
  const registry = new Map(rows.map((r) => [r.slug, r.nid]));

  // the sales strings per street: every For Sale record, all time, counted by string
  const strings = (await db2`SELECT street_slug s, neighbourhood n, COUNT(*)::int c FROM sold.sold_records
                              WHERE transaction_type = 'For Sale' AND perm_advertise = TRUE AND street_slug IS NOT NULL AND neighbourhood IS NOT NULL
                              GROUP BY 1, 2`) as Array<{ s: string; n: string; c: number }>;
  const byStreet = new Map<string, Map<string, number>>();
  for (const r of strings) {
    if (!byStreet.has(r.s)) byStreet.set(r.s, new Map());
    const hub = rawToHub.get(r.n);
    if (!hub) continue;
    const m = byStreet.get(r.s)!;
    m.set(hub, (m.get(hub) ?? 0) + Number(r.c));
  }

  const agree: string[] = [], fixable: Array<{ slug: string; hub: string; c: number }> = [], conflict: string[] = [], noRow: string[] = [], noStrings: string[] = [];
  for (const { s } of pages) {
    const nid = registry.get(s);
    const regHub = nid ? slugById.get(nid) ?? null : null;
    const votes = byStreet.get(s);
    if (!registry.has(s)) { noRow.push(`${s}: no ResidentialStreet row; sales say ${votes ? [...votes.entries()].map(([h, c]) => `${h}×${c}`).join(", ") : "nothing"}`); continue; }
    if (!votes || votes.size === 0) { noStrings.push(s); continue; }
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const [topHub, topC] = ranked[0];
    if (regHub === topHub) { agree.push(s); continue; }
    if (!regHub && ranked.length === 1 && published.has(topHub)) { fixable.push({ slug: s, hub: topHub, c: topC }); continue; }
    conflict.push(`${s}: registry ${regHub ?? "none"}; sales ${ranked.map(([h, c]) => `${h}×${c}`).join(", ")}`);
  }

  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · published pages ${pages.length}`);
  console.log(`agree ${agree.length} · no sales string ${noStrings.length} · fixable (registry empty, one hub in the records) ${fixable.length} · conflict ${conflict.length} · no registry row ${noRow.length}\n`);
  if (fixable.length) { console.log("FIXES (registry row takes the hub the records name):"); for (const f of fixable) console.log(`  ${f.slug} -> ${f.hub} (${f.c} sales)`); }
  if (conflict.length) { console.log("\nCONFLICTS (listed, not changed):"); for (const c of conflict) console.log(`  ${c}`); }
  if (noRow.length) { console.log("\nNO REGISTRY ROW:"); for (const c of noRow) console.log(`  ${c}`); }

  if (WRITE) {
    let n = 0;
    for (const f of fixable) {
      const id = idBySlug.get(f.hub);
      if (!id) continue;
      await db1`UPDATE public."ResidentialStreet" SET "neighbourhoodId" = ${id} WHERE slug = ${f.slug} AND "neighbourhoodId" IS NULL`;
      n++;
    }
    console.log(`\nupdated ${n} registry rows`);
  }
}
main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });
