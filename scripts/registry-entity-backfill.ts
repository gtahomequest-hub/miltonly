// scripts/registry-entity-backfill.ts
// ONE-OFF (registry ingest, 2026-07). Makes every official Milton street (944) a
// ResidentialStreet entity, then PUBLISHES the minimal-template page for the 19
// high-value streets (14 new-construction w/ active listings + 5 low-sale). All
// other new entities stay DORMANT (0 sold, 0 listings, hasPublishedPage=false) —
// present in the DB, unsurfaced, until a first sale/listing auto-promotes them.
//
// Dry-run by default; pass --commit to write. Idempotent (skip/upsert).
//
// NOT a replacement for ws3-backfill (still the sold-driven entity writer). This
// only ADDS registry-missing entities + publishes the 19; it never deletes.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) {
  try {
    for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue;
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
const COMMIT = process.argv.includes("--commit");
// The 188 dormant entities are only safe to create once the surfacing gate is
// LIVE on prod (they'd 404-leak into prod autocomplete otherwise, since prod +
// preview share one DB). Preview run uses --skip-dormant (creates only the 19's
// entities); the merge run drops the flag to create the full 944.
const SKIP_DORMANT = process.argv.includes("--skip-dormant");

const ABBR: Record<string, string> = { rd:"road", st:"street", ave:"avenue", av:"avenue", blvd:"boulevard", crt:"court", ct:"court", dr:"drive", cres:"crescent", pl:"place", trl:"trail", cir:"circle", ln:"lane", terr:"terrace", ter:"terrace", grv:"grove", hts:"heights", hllw:"hollow", pkwy:"parkway", sdrd:"sideroad", gdns:"garden", gardens:"garden", hwy:"highway", pt:"point", ldg:"landing", cr:"crescent", wy:"way", xing:"crossing", cirle:"circle", cross:"crossing" };
const ORD: Record<string, string> = { "1":"first","1st":"first","2":"second","2nd":"second","3":"third","3rd":"third","4":"fourth","4th":"fourth","5":"fifth","5th":"fifth","6":"sixth","6th":"sixth","7":"seventh","7th":"seventh","8":"eighth","8th":"eighth","9":"ninth","9th":"ninth","10":"tenth","10th":"tenth" };
const DIR = new Set(["e","w","n","s","ne","nw","se","sw","east","west","north","south"]);
const TYPE = new Set(["street","court","crescent","terrace","place","way","road","avenue","gate","lane","heights","landing","boulevard","trail","point","circle","line","crossing","garden","common","path","close","drive","parkway","centre","townline","sideroad","grove","hollow","ridge","hill","view","square","park","walk","mews","row","vale","villas","green"]);
const TRAILJUNK = /^(?:[a-z]|\d+|th\d+|unit\d*|ll|upl|upr|upper|lower|main|bsmt|milton|only|flr)$/;
function toks(name: string): string[] {
  const s = String(name || "").toLowerCase().replace(/-milton$/, "").replace(/[-_]/g, " ").replace(/[^a-z0-9\s]/g, " ");
  const t = s.split(/\s+/).filter(Boolean).map(x => ORD[x] || ABBR[x] || x);
  while (t.length > 1 && DIR.has(t[t.length - 1])) t.pop();
  while (t.length > 1 && DIR.has(t[0])) t.shift();
  return t;
}
const norm = (n: string) => toks(n).join(" ");
function baseKey(t: string[]): string { const a = [...t]; while (a.length > 1 && TYPE.has(a[a.length - 1])) a.pop(); return a.join(" "); }
function titleCase(s: string): string { return s.toLowerCase().split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" "); }

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { neon } = await import("@neondatabase/serverless");
  const { MILTON_STREET_REGISTRY: REG } = await import("../src/data/miltonStreetRegistry");
  const p = new PrismaClient();
  const soldDb = neon(process.env.SOLD_DATABASE_URL!);

  const regBySlug = new Map(REG.map(r => [r.slug, r]));
  const byNorm = new Map<string, any>(); const byBase = new Map<string, any[]>();
  for (const r of REG) { byNorm.set(norm(r.name), r); const bk = baseKey(toks(r.name)); if (!byBase.has(bk)) byBase.set(bk, []); byBase.get(bk)!.push(r); }
  function matchReg(name: string, slug?: string): any | null {
    if (slug && regBySlug.has(slug)) return regBySlug.get(slug);
    const t = toks(name);
    let hit = byNorm.get(t.join(" ")); if (hit) return hit;
    let bk = baseKey(t); let bm = byBase.get(bk); if (bm && bm.length === 1) return bm[0];
    const t2 = [...t]; let s = false; while (t2.length > 1 && TRAILJUNK.test(t2[t2.length - 1])) { t2.pop(); s = true; }
    if (s) { hit = byNorm.get(t2.join(" ")); if (hit) return hit; bk = baseKey(t2); bm = byBase.get(bk); if (bm && bm.length === 1) return bm[0]; }
    return null;
  }

  // matched registry -> missing set
  const rows = await p.residentialStreet.findMany({ select: { name: true, slug: true } });
  const matched = new Set<string>();
  for (const r of rows) { const m = matchReg(r.name, r.slug); if (m) matched.add(m.slug); }
  const missing = REG.filter(r => !matched.has(r.slug));

  // DB2 sold + dominant neighbourhood; DB1 listings + neighbourhood — per registry slug
  const soldRows = await soldDb`SELECT street_slug, street_name, neighbourhood, COUNT(*)::int AS c FROM sold.sold_records GROUP BY street_slug, street_name, neighbourhood` as any[];
  const soldByReg = new Map<string, number>(); const nbCountByReg = new Map<string, Map<string, number>>();
  for (const s of soldRows) { const m = matchReg(s.street_name || "", s.street_slug); if (!m) continue; soldByReg.set(m.slug, (soldByReg.get(m.slug) || 0) + s.c); if (s.neighbourhood) { if (!nbCountByReg.has(m.slug)) nbCountByReg.set(m.slug, new Map()); const mm = nbCountByReg.get(m.slug)!; mm.set(s.neighbourhood, (mm.get(s.neighbourhood) || 0) + s.c); } }
  const listRows = await p.listing.groupBy({ by: ["streetSlug", "neighbourhood"], _count: { _all: true } }) as any[];
  const listByReg = new Map<string, number>();
  for (const l of listRows) { const m = matchReg(l.streetSlug || "", l.streetSlug); if (!m) continue; listByReg.set(m.slug, (listByReg.get(m.slug) || 0) + l._count._all); if (l.neighbourhood) { if (!nbCountByReg.has(m.slug)) nbCountByReg.set(m.slug, new Map()); const mm = nbCountByReg.get(m.slug)!; mm.set(l.neighbourhood, (mm.get(l.neighbourhood) || 0) + 1); } }
  const domNb = (slug: string): string | null => { const mm = nbCountByReg.get(slug); if (!mm) return null; let best = "", bc = 0; for (const [k, v] of mm) if (v > bc) { bc = v; best = k; } return best || null; };

  // neighbourhood entity resolution by raw string
  const nbs = await p.neighbourhood.findMany({ select: { id: true, name: true, slug: true, rawStrings: true } });
  const nbByRaw = new Map<string, { id: string; name: string; slug: string }>();
  for (const nb of nbs) for (const rs of nb.rawStrings) nbByRaw.set(rs, { id: nb.id, name: nb.name, slug: nb.slug });

  // the 19 to publish: missing with (1-4 sold) OR (0 sold + active listings)
  const publish = missing.filter(r => { const c = soldByReg.get(r.slug) || 0; const l = listByReg.get(r.slug) || 0; return (c >= 1 && c <= 4) || (c === 0 && l > 0); });
  const publishSlugs = new Set(publish.map(r => r.slug));

  console.log(`=== registry-entity-backfill ${COMMIT ? "(COMMIT)" : "(DRY RUN)"} ===`);
  console.log(`  registry: ${REG.length} | existing rows: ${rows.length} | missing entities to create: ${missing.length}`);
  console.log(`  to PUBLISH (minimal template): ${publish.length}`);

  // ── PHASE 1: create missing entities (dormant unless in publish set) ──
  let created = 0, skipped = 0;
  let dormantDeferred = 0;
  for (const r of missing) {
    const isPub = publishSlugs.has(r.slug);
    if (!isPub && SKIP_DORMANT) { dormantDeferred++; continue; } // defer dormant to the post-merge run
    const exists = await p.residentialStreet.findUnique({ where: { slug: r.slug }, select: { slug: true } });
    if (exists) { skipped++; continue; }
    const raw = isPub ? domNb(r.slug) : null;
    const nb = raw ? nbByRaw.get(raw) : null;
    if (COMMIT) {
      await p.residentialStreet.create({ data: {
        slug: r.slug, name: titleCase(r.name), streetType: r.type,
        neighbourhoodId: nb?.id ?? null, soldCount12mo: 0, recencyWeightedSold: 0,
        hasPublishedPage: false, crossStreets: [], lastClassifiedAt: new Date(),
      } });
    }
    created++;
  }
  console.log(`  PHASE 1 — entities created: ${created}, already existed: ${skipped}, dormant DEFERRED (run without --skip-dormant post-merge): ${dormantDeferred}`);

  // ── PHASE 2: publish the 19 (StreetContent minimal + flag + neighbourhood) ──
  console.log(`\n  PHASE 2 — publishing ${publish.length} minimal pages:`);
  for (const r of publish) {
    const raw = domNb(r.slug); const nb = raw ? nbByRaw.get(raw) : null;
    const nm = titleCase(r.name);
    const sold = soldByReg.get(r.slug) || 0; const list = listByReg.get(r.slug) || 0;
    const desc = `No home resales are recorded on ${nm} in the last ~2 years of Milton sales. ` +
      `${nb ? `Area market context for ${nb.name}, ` : ""}nearby streets, schools, and any active listings are below. ` +
      `This page fills in with ${nm}'s own price history when a home here sells.`;
    if (COMMIT) {
      await p.streetContent.upsert({
        where: { streetSlug: r.slug },
        create: { streetSlug: r.slug, streetName: nm, neighbourhood: raw ?? null, description: desc, status: "published", template: "minimal", needsReview: false, aiGenerated: false, publishedAt: new Date() },
        update: { streetName: nm, neighbourhood: raw ?? null, description: desc, status: "published", template: "minimal", needsReview: false, publishedAt: new Date() },
      });
      await p.residentialStreet.update({ where: { slug: r.slug }, data: { hasPublishedPage: true, neighbourhoodId: nb?.id ?? undefined } });
    }
    console.log(`    ${nm.padEnd(30)} [${r.slug}] nb=${nb?.name ?? "?"} raw="${raw ?? "?"}" sold=${sold} listings=${list}`);
  }

  // ── PHASE 3: reconcile hasPublishedPage with published StreetContent ──
  const pubContent = await p.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } });
  const pubSlugs = pubContent.map(c => c.streetSlug);
  let flagged = 0;
  if (COMMIT) { const res = await p.residentialStreet.updateMany({ where: { slug: { in: pubSlugs }, hasPublishedPage: false }, data: { hasPublishedPage: true } }); flagged = res.count; }
  console.log(`\n  PHASE 3 — published StreetContent slugs: ${pubSlugs.length}; hasPublishedPage flipped to true: ${flagged}`);

  // ── FINAL counts ──
  if (COMMIT) {
    const total = await p.residentialStreet.count();
    const surfaced = await p.residentialStreet.count({ where: { OR: [{ recencyWeightedSold: { gt: 0 } }, { hasPublishedPage: true }] } });
    const publishedFlag = await p.residentialStreet.count({ where: { hasPublishedPage: true } });
    console.log(`\n=== FINAL: entities=${total} | surfaced=${surfaced} | dormant=${total - surfaced} | hasPublishedPage=${publishedFlag} ===`);
  } else {
    console.log(`\n(dry run — no writes. Re-run with --commit to apply.)`);
  }
  await p.$disconnect(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
