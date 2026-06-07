// WS3 STEP C — backfill entities on STAGING. Reads DB2 sold (prod, read-only) +
// DB1-staging published slugs; writes Neighbourhood / ResidentialStreet /
// CondoBuilding + runs VIP classification. Uses pg (Prisma engine hits Neon
// cold-start P1001 on this branch). HARD GUARD on the write target host.
//
// Usage: npx tsx scripts/ws3-backfill.ts

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NEIGHBOURHOOD_SEED } from "../src/lib/neighbourhood";
import { groupCondoClusters } from "../src/lib/condoIdentity";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv(name: string, into: Record<string, string>) {
  try {
    for (const line of readFileSync(resolve(__dirname, "..", name), "utf8").split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("="); if (eq === -1) continue;
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      into[k] = v;
    }
  } catch { /* ignore */ }
}
// PROD promotion (Option A). Three-layer guard: explicit --prod flag + prod env
// (.env, ep-patient-paper) + prod-host assertion. READ source stays DB2 sold (.env.local).
const prod: Record<string, string> = {}; loadEnv(".env", prod);
const local: Record<string, string> = {}; loadEnv(".env.local", local);

const WRITE_URL = (prod.DIRECT_DATABASE_URL || prod.DATABASE_URL || "").trim();
const SOLD_URL = (local.SOLD_DATABASE_URL || "").trim();
const wHost = (WRITE_URL.match(/@([^/?]+)/) || [])[1] || "";
if (!process.argv.includes("--prod")) { console.error("❌ GUARD: prod backfill requires the explicit --prod flag. Refusing to run."); process.exit(1); }
if (!wHost.startsWith("ep-patient-paper-aebh7f93")) { console.error(`❌ GUARD: write target ${wHost} is not prod (ep-patient-paper-aebh7f93). Refusing to run.`); process.exit(1); }

const WEIGHT = `CASE
  WHEN sold_date >= NOW()-INTERVAL '12 months' THEN 1.0
  WHEN sold_date >= NOW()-INTERVAL '24 months' THEN 0.6
  WHEN sold_date >= NOW()-INTERVAL '36 months' THEN 0.3
  ELSE 0.1 END`;

// raw string -> seed entry
const SEED_BY_RAW = new Map<string, typeof NEIGHBOURHOOD_SEED[number]>();
for (const s of NEIGHBOURHOOD_SEED) for (const raw of s.rawStrings) SEED_BY_RAW.set(raw, s);

interface NbAgg { nb: string; cnt: number; weighted: number; count12: number; sale12?: number; lease12?: number; name?: string; }
function pickDominant(rows: NbAgg[]) {
  let dom = rows[0]; for (const r of rows) if (r.cnt > dom.cnt) dom = r;
  return dom;
}

async function main() {
  const st = new pg.Client({ connectionString: WRITE_URL });
  const sold = new pg.Client({ connectionString: SOLD_URL });
  await Promise.all([st.connect(), sold.connect()]);
  console.log(`WRITE target (PROD): ${wHost}`);
  console.log(`READ source  (DB2 sold): ${(SOLD_URL.match(/@([^/?]+)/) || [])[1]}`);

  try {
    // ── 1. Seed Neighbourhood (upsert by slug) ─────────────────────────────
    const idBySlug = new Map<string, string>();
    for (const s of NEIGHBOURHOOD_SEED) {
      const res = await st.query(
        `INSERT INTO "Neighbourhood" (id, slug, name, "rawStrings", profile, "isHub", "hasVipTier", kind, "updatedAt")
         VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, "rawStrings"=EXCLUDED."rawStrings",
           profile=EXCLUDED.profile, "isHub"=EXCLUDED."isHub", "hasVipTier"=EXCLUDED."hasVipTier",
           kind=EXCLUDED.kind, "updatedAt"=now()
         RETURNING id`,
        [s.slug, s.name, s.rawStrings, s.profile, s.isHub, s.hasVipTier, s.kind]
      );
      idBySlug.set(s.slug, res.rows[0].id);
    }
    console.log(`Seeded ${idBySlug.size} neighbourhoods.`);

    const nbIdForRaw = (raw: string): { id: string | null; slug: string | null; hasVip: boolean } => {
      const seed = SEED_BY_RAW.get(raw);
      if (!seed) return { id: null, slug: null, hasVip: false };
      return { id: idBySlug.get(seed.slug) ?? null, slug: seed.slug, hasVip: seed.hasVipTier };
    };

    // ── 2. RESIDENTIAL entities from DB2 ───────────────────────────────────
    const resiRows = (await sold.query(`
      SELECT street_slug entity, neighbourhood,
             MAX(street_name) name,
             COUNT(*)::int cnt,
             COALESCE(SUM(${WEIGHT}) FILTER (WHERE transaction_type='For Sale'),0)::float weighted,
             COUNT(*) FILTER (WHERE transaction_type='For Sale' AND sold_date>=NOW()-INTERVAL '12 months')::int count12
      FROM sold.sold_records
      WHERE property_type IN ('detached','semi','townhouse') AND street_slug IS NOT NULL
      GROUP BY street_slug, neighbourhood`)).rows as Array<NbAgg & { entity: string }>;

    const resiByEntity = new Map<string, NbAgg[]>();
    for (const r of resiRows) {
      if (!resiByEntity.has(r.entity)) resiByEntity.set(r.entity, []);
      resiByEntity.get(r.entity)!.push(r);
    }

    // Published-slug coverage from DB1 staging StreetContent.
    const published = (await st.query(`SELECT "streetSlug" slug, "streetName" name, neighbourhood FROM "StreetContent" WHERE status='published'`)).rows as Array<{slug:string;name:string|null;neighbourhood:string|null}>;
    const publishedMap = new Map(published.map((p) => [p.slug, p]));

    interface ResiOut { slug: string; name: string; nbId: string|null; nbSlug: string|null; ambiguous: boolean; weighted: number; count12: number; hasVip: boolean; }
    const resiEntities = new Map<string, ResiOut>();
    for (const [entity, rows] of resiByEntity) {
      const dom = pickDominant(rows);
      const mappedSlugs = new Set(rows.map((r) => SEED_BY_RAW.get(r.nb || r.neighbourhood!)?.slug).filter(Boolean));
      const map = nbIdForRaw(dom.neighbourhood!);
      resiEntities.set(entity, {
        slug: entity,
        name: dom.name || publishedMap.get(entity)?.name || entity,
        nbId: map.id, nbSlug: map.slug, ambiguous: mappedSlugs.size > 1,
        weighted: Number(rows.reduce((s, r) => s + Number(r.weighted), 0).toFixed(4)),
        count12: rows.reduce((s, r) => s + Number(r.count12), 0),
        hasVip: map.hasVip,
      });
    }
    // Union in published slugs with no residential DB2 trades (coverage guarantee).
    let publishedOnly = 0;
    for (const p of published) {
      if (resiEntities.has(p.slug)) continue;
      const map = p.neighbourhood ? nbIdForRaw(p.neighbourhood) : { id: null, slug: null, hasVip: false };
      resiEntities.set(p.slug, { slug: p.slug, name: p.name || p.slug, nbId: map.id, nbSlug: map.slug, ambiguous: false, weighted: 0, count12: 0, hasVip: map.hasVip });
      publishedOnly++;
    }
    console.log(`Residential entities: ${resiEntities.size} (For-Sale-bearing + ${publishedOnly} published-only coverage rows).`);

    // ── 3. CONDO building entities from DB2 (grouped by street_number + street_slug) ──
    const condoRows = (await sold.query(`
      SELECT street_number, street_slug,
             neighbourhood,
             MAX(street_name) name,
             COUNT(*)::int cnt,
             COALESCE(SUM(${WEIGHT}) FILTER (WHERE transaction_type='For Sale'),0)::float weighted,
             COUNT(*) FILTER (WHERE transaction_type='For Sale' AND sold_date>=NOW()-INTERVAL '12 months')::int sale12,
             COUNT(*) FILTER (WHERE transaction_type='For Lease' AND sold_date>=NOW()-INTERVAL '12 months')::int lease12,
             ARRAY_AGG(DISTINCT condo_corp_number) FILTER (WHERE condo_corp_number IS NOT NULL) corps,
             MAX(legal_stories) legal_stories,
             MODE() WITHIN GROUP (ORDER BY property_management_company) mgmt
      FROM sold.sold_records
      WHERE property_type='condo' AND street_number IS NOT NULL AND street_slug IS NOT NULL
      GROUP BY street_number, street_slug, neighbourhood`)).rows as Array<{street_number:string;street_slug:string;neighbourhood:string;name:string;cnt:number;weighted:number;sale12:number;lease12:number;corps:string[]|null;legal_stories:string|null;mgmt:string|null}>;

    interface CondoOut { slug:string; buildingAddress:string; streetNumber:string; streetName:string; streetSlug:string; nbId:string|null; nbSlug:string|null; ambiguous:boolean; corps:string[]; legalStories:number|null; mgmt:string|null; weighted:number; sale12:number; lease12:number; hasVip:boolean; }
    // 2026-06 dedup — group through deriveCondoIdentity instead of raw
    // (street_number, street_slug): unit descriptors, doubled/conflicting
    // suffixes, misspellings, direction noise and unit-prefixed street
    // numbers all collapse onto one canonical building (A1 gap, condo path).
    // Junk variants therefore stop being re-created here; deleting the
    // existing junk rows is a separate one-shot migration.
    const { clusters: condoClusters, rejected: condoRejected } = groupCondoClusters(condoRows);
    for (const r of condoRejected) console.warn(`  condo row rejected by deriveCondoIdentity: ${r.street_number} | ${r.street_slug}`);
    const condoEntities = new Map<string, CondoOut>();
    for (const [key, cluster] of condoClusters) {
      const rows = cluster.rows;
      const domNb = pickDominant(rows.map((r) => ({ nb: r.neighbourhood, cnt: r.cnt, weighted: 0, count12: 0 })));
      const mappedSlugs = new Set(rows.map((r) => SEED_BY_RAW.get(r.neighbourhood)?.slug).filter(Boolean));
      const map = nbIdForRaw(domNb.nb);
      const name = [...rows].sort((a,b)=>b.cnt-a.cnt)[0].name;
      const corps = Array.from(new Set(rows.flatMap((r) => r.corps || [])));
      let legal: number | null = null;
      for (const r of rows) { const n = r.legal_stories ? parseInt(String(r.legal_stories).replace(/\D/g, ""), 10) : NaN; if (Number.isFinite(n)) legal = Math.max(legal ?? 0, n); }
      condoEntities.set(key, {
        slug: cluster.canonicalSlug, buildingAddress: `${cluster.streetNumber} ${name}`,
        streetNumber: cluster.streetNumber, streetName: name, streetSlug: cluster.canonicalStreetSlug,
        nbId: map.id, nbSlug: map.slug, ambiguous: mappedSlugs.size > 1, corps,
        legalStories: legal, mgmt: rows.find((r)=>r.mgmt)?.mgmt ?? null,
        weighted: Number(rows.reduce((s, r) => s + Number(r.weighted), 0).toFixed(4)),
        sale12: rows.reduce((s, r) => s + Number(r.sale12), 0),
        lease12: rows.reduce((s, r) => s + Number(r.lease12), 0),
        hasVip: map.hasVip,
      });
    }
    console.log(`Condo building entities: ${condoEntities.size} canonical (from ${condoRows.length} raw DB2 rows).`);

    // ── 4. Write ResidentialStreet + CondoBuilding (upsert by slug) ────────
    for (const e of resiEntities.values()) {
      await st.query(
        `INSERT INTO "ResidentialStreet" (id, slug, name, "neighbourhoodId", "neighbourhoodAmbiguous", "soldCount12mo", "recencyWeightedSold", "crossStreets", "lastClassifiedAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,$6, ARRAY[]::text[], now(), now())
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, "neighbourhoodId"=EXCLUDED."neighbourhoodId",
           "neighbourhoodAmbiguous"=EXCLUDED."neighbourhoodAmbiguous", "soldCount12mo"=EXCLUDED."soldCount12mo",
           "recencyWeightedSold"=EXCLUDED."recencyWeightedSold", "lastClassifiedAt"=now(), "updatedAt"=now()`,
        [e.slug, e.name, e.nbId, e.ambiguous, e.count12, e.weighted]
      );
    }
    for (const e of condoEntities.values()) {
      await st.query(
        `INSERT INTO "CondoBuilding" (id, slug, name, "displayName", "buildingAddress", "streetNumber", "streetName", "streetSlug",
            "condoCorpNumbers", "legalStories", "managementCo", "neighbourhoodId", "neighbourhoodAmbiguous",
            "saleCount12mo", "leaseCount12mo", "recencyWeightedSold", "lastClassifiedAt", "lastUpdated")
         VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now(), now())
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, "displayName"=EXCLUDED."displayName",
           "buildingAddress"=EXCLUDED."buildingAddress", "streetNumber"=EXCLUDED."streetNumber",
           "streetName"=EXCLUDED."streetName", "streetSlug"=EXCLUDED."streetSlug",
           "condoCorpNumbers"=EXCLUDED."condoCorpNumbers", "legalStories"=EXCLUDED."legalStories",
           "managementCo"=EXCLUDED."managementCo", "neighbourhoodId"=EXCLUDED."neighbourhoodId",
           "neighbourhoodAmbiguous"=EXCLUDED."neighbourhoodAmbiguous", "saleCount12mo"=EXCLUDED."saleCount12mo",
           "leaseCount12mo"=EXCLUDED."leaseCount12mo", "recencyWeightedSold"=EXCLUDED."recencyWeightedSold",
           "lastClassifiedAt"=now()`,
        [e.slug, e.buildingAddress, e.buildingAddress, e.buildingAddress, e.streetNumber, e.streetName, e.streetSlug, e.corps, e.legalStories, e.mgmt, e.nbId, e.ambiguous, e.sale12, e.lease12, e.weighted]
      );
    }
    console.log("Entities written.");

    // ── 5. VIP classification — top-20%-or-tied per neighbourhood per pool ──
    // currentRank computed for ALL entities (powers WS5 prominence); isVip set
    // only where the neighbourhood hasVipTier=true. Sticky: initial backfill,
    // nothing to demote.
    async function classify(table: string, items: Array<{slug:string; nbId:string|null; weighted:number; hasVip:boolean}>) {
      const byNb = new Map<string, typeof items>();
      for (const it of items) { const k = it.nbId ?? "__none__"; if (!byNb.has(k)) byNb.set(k, []); byNb.get(k)!.push(it); }
      let vipTotal = 0;
      for (const [nbId, all] of byNb) {
        // Pool = For-Sale-bearing entities only (weighted>0). Zero-sale entities
        // (lease-only / published-only) exist as standard-tier rows but are NOT in
        // the VIP denominator and get no currentRank. Matches the preview method.
        const pool = all.filter((x) => x.weighted > 0).sort((a, b) => b.weighted - a.weighted);
        const zeros = all.filter((x) => x.weighted <= 0);
        const eligible = nbId !== "__none__" && pool[0]?.hasVip;
        const cutoffIdx = Math.ceil(pool.length * 0.2) - 1; // 0-based
        const cutoffVal = cutoffIdx >= 0 ? pool[cutoffIdx].weighted : Infinity;
        for (let i = 0; i < pool.length; i++) {
          // promote-both: VIP if weighted >= cutoff value (all ties at the cutoff promoted).
          const isVip = !!eligible && pool[i].weighted >= cutoffVal;
          if (isVip) vipTotal++;
          await st.query(
            `UPDATE "${table}" SET "currentRank"=$1, "isVip"=$2, "vipEarnedAt"=CASE WHEN $2 THEN now() ELSE NULL END WHERE slug=$3`,
            [i + 1, isVip, pool[i].slug]
          );
        }
        // Zero-sale entities: no rank, never VIP.
        for (const z of zeros) {
          await st.query(`UPDATE "${table}" SET "currentRank"=NULL, "isVip"=false, "vipEarnedAt"=NULL WHERE slug=$1`, [z.slug]);
        }
      }
      return vipTotal;
    }

    const resiVip = await classify("ResidentialStreet", Array.from(resiEntities.values()).map((e) => ({ slug: e.slug, nbId: e.nbId, weighted: e.weighted, hasVip: e.hasVip })));
    const condoVip = await classify("CondoBuilding", Array.from(condoEntities.values()).map((e) => ({ slug: e.slug, nbId: e.nbId, weighted: e.weighted, hasVip: e.hasVip })));
    console.log(`VIP set — residential: ${resiVip}, condo: ${condoVip}, total: ${resiVip + condoVip}`);

    // ── 6. Unmapped-string check (all 25 known strings are seeded) ─────────
    const distinctNb = (await sold.query(`SELECT DISTINCT neighbourhood FROM sold.sold_records WHERE neighbourhood IS NOT NULL`)).rows as Array<{neighbourhood:string}>;
    let unmapped = 0;
    for (const { neighbourhood } of distinctNb) {
      if (!SEED_BY_RAW.has(neighbourhood)) {
        unmapped++;
        await st.query(
          `INSERT INTO "UnmappedNeighbourhoodString" (id, "rawString", source) VALUES (gen_random_uuid()::text, $1, 'backfill')
           ON CONFLICT ("rawString") DO UPDATE SET "seenCount"="UnmappedNeighbourhoodString"."seenCount"+1, "lastSeen"=now()`,
          [neighbourhood]
        );
        console.warn(`  UNMAPPED: ${JSON.stringify(neighbourhood)}`);
      }
    }
    console.log(`Unmapped neighbourhood strings: ${unmapped} (expected 0).`);
    console.log("\n✅ Backfill complete.");
  } finally {
    await Promise.all([st.end(), sold.end()]);
  }
}
main().catch((e) => { console.error("fatal:", e instanceof Error ? e.stack : e); process.exit(1); });
