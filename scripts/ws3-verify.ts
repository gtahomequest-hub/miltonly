// WS3 STEP D — verification (READ-ONLY against staging). Produces the 6 evidence
// items Brain Claude requires. Usage: npx tsx scripts/ws3-verify.ts

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv(name: string, into: Record<string,string>) {
  try { for (const line of readFileSync(resolve(__dirname,"..",name),"utf8").split(/\r?\n/)) {
    const t=line.trim(); if(!t||t.startsWith("#"))continue; const eq=t.indexOf("="); if(eq===-1)continue;
    const k=t.slice(0,eq).trim(); let v=t.slice(eq+1).trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); into[k]=v; } } catch {}
}
const staging: Record<string,string>={}; loadEnv(".env.staging",staging);
const URL=(staging.DIRECT_DATABASE_URL||staging.DATABASE_URL||"").trim();
const host=(URL.match(/@([^/?]+)/)||[])[1]||"";
if(!host.startsWith("ep-old-unit-aeyqkwyt")){console.error("GUARD: not staging");process.exit(1);}

async function main(){
  const c=new pg.Client({connectionString:URL}); await c.connect();
  const q=(s:string,v:unknown[]=[])=>c.query(s,v).then(r=>r.rows);
  try{
    console.log("VERIFY target (staging):",host,"\n");

    // ── 4. Entity reconciliation (lead with the counts) ──
    console.log("===== (4) ENTITY COUNT RECONCILIATION =====");
    console.table(await q(`SELECT profile, kind, COUNT(*)::int n FROM "Neighbourhood" GROUP BY profile, kind ORDER BY profile, kind`));
    const rs=(await q(`SELECT COUNT(*)::int total,
        COUNT(*) FILTER (WHERE "recencyWeightedSold">0)::int forsale_bearing,
        COUNT(*) FILTER (WHERE "isVip")::int vip,
        COUNT(*) FILTER (WHERE "neighbourhoodId" IS NULL)::int no_nbhd,
        COUNT(*) FILTER (WHERE "neighbourhoodAmbiguous")::int ambiguous
      FROM "ResidentialStreet"`))[0];
    console.log("ResidentialStreet:", rs);
    const cb=(await q(`SELECT COUNT(*)::int total,
        COUNT(*) FILTER (WHERE "recencyWeightedSold">0)::int sale_active,
        COUNT(*) FILTER (WHERE "recencyWeightedSold"=0)::int lease_only_or_nosale,
        COUNT(*) FILTER (WHERE "isVip")::int vip,
        COUNT(*) FILTER (WHERE "neighbourhoodAmbiguous")::int ambiguous
      FROM "CondoBuilding"`))[0];
    console.log("CondoBuilding   :", cb);
    console.log("Neighbourhood   :", (await q(`SELECT COUNT(*)::int n FROM "Neighbourhood"`))[0].n,
                "| with VIP tier:", (await q(`SELECT COUNT(*)::int n FROM "Neighbourhood" WHERE "hasVipTier"`))[0].n);
    console.log("Locked-math check: condo total — see note (142 raw addr strings → 108 canonical buildings after street_name dedup).");

    // ── 2. All published street slugs resolve to a ResidentialStreet ──
    console.log("\n===== (2) PUBLISHED STREET SLUG RESOLUTION =====");
    const pub=(await q(`SELECT COUNT(*)::int n FROM "StreetContent" WHERE status='published'`))[0].n;
    const orphans=await q(`SELECT sc."streetSlug" FROM "StreetContent" sc
        LEFT JOIN "ResidentialStreet" rs ON rs.slug=sc."streetSlug"
        WHERE sc.status='published' AND rs.id IS NULL`);
    console.log(`Published StreetContent rows: ${pub} | resolved to ResidentialStreet: ${pub-orphans.length} | ORPHANS: ${orphans.length}`);
    if(orphans.length) console.log("  orphan slugs:", orphans.map(o=>o.streetSlug).join(", "));

    // ── 5. Tie-break verification (Beaty: barr-crescent + bennett-boulevard) ──
    console.log("\n===== (5) TIE-BREAK (promote-both) — Beaty residential cutoff =====");
    console.table(await q(`SELECT slug, "recencyWeightedSold" w, "currentRank" rank, "isVip"
      FROM "ResidentialStreet" WHERE slug IN ('barr-crescent-milton','bennett-boulevard-milton') ORDER BY "currentRank"`));

    // ── 1. Three sample entities ──
    console.log("\n===== (1a) SAMPLE VIP RESIDENTIAL STREET =====");
    const vipResi=(await q(`SELECT rs.slug, rs.name, n.name nbhd, rs."recencyWeightedSold" w, rs."soldCount12mo" c12, rs."currentRank" rank, rs."isVip", rs."vipEarnedAt"
      FROM "ResidentialStreet" rs JOIN "Neighbourhood" n ON n.id=rs."neighbourhoodId"
      WHERE rs."isVip" ORDER BY rs."recencyWeightedSold" DESC LIMIT 1`))[0];
    console.log(vipResi);
    if(vipResi){
      const runnerUp=(await q(`SELECT rs.slug, rs."recencyWeightedSold" w, rs."currentRank" rank, rs."isVip"
        FROM "ResidentialStreet" rs WHERE rs."neighbourhoodId"=(SELECT "neighbourhoodId" FROM "ResidentialStreet" WHERE slug=$1)
          AND NOT rs."isVip" AND rs."recencyWeightedSold">0 ORDER BY rs."recencyWeightedSold" DESC LIMIT 1`,[vipResi.slug]))[0];
      console.log("  highest non-VIP runner-up it beat (same neighbourhood pool):", runnerUp);
    }

    console.log("\n===== (1b) SAMPLE VIP CONDO BUILDING =====");
    const vipCondo=(await q(`SELECT cb.slug, cb."displayName", cb."buildingAddress", n.name nbhd, cb."recencyWeightedSold" w, cb."saleCount12mo" sale12, cb."leaseCount12mo" lease12, cb."currentRank" rank, cb."isVip", cb."condoCorpNumbers" corps, cb."legalStories"
      FROM "CondoBuilding" cb JOIN "Neighbourhood" n ON n.id=cb."neighbourhoodId"
      WHERE cb."isVip" ORDER BY cb."recencyWeightedSold" DESC LIMIT 1`))[0];
    console.log(vipCondo);
    if(vipCondo){
      const ru=(await q(`SELECT cb.slug, cb."recencyWeightedSold" w, cb."currentRank" rank, cb."isVip"
        FROM "CondoBuilding" cb WHERE cb."neighbourhoodId"=(SELECT "neighbourhoodId" FROM "CondoBuilding" WHERE slug=$1)
          AND NOT cb."isVip" AND cb."recencyWeightedSold">0 ORDER BY cb."recencyWeightedSold" DESC LIMIT 1`,[vipCondo.slug]))[0];
      console.log("  highest non-VIP condo runner-up (same pool):", ru ?? "(none — pool fully promoted)");
    }

    console.log("\n===== (1c) SAMPLE LEASE-ONLY CONDO BUILDING (high lease, no sale, isVip=false) =====");
    console.table(await q(`SELECT cb.slug, cb."buildingAddress", n.name nbhd, cb."saleCount12mo" sale12, cb."leaseCount12mo" lease12, cb."recencyWeightedSold" w, cb."isVip"
      FROM "CondoBuilding" cb LEFT JOIN "Neighbourhood" n ON n.id=cb."neighbourhoodId"
      WHERE cb."recencyWeightedSold"=0 AND cb."leaseCount12mo">0 ORDER BY cb."leaseCount12mo" DESC LIMIT 3`));

    // ── 3. Per-neighbourhood VIP list ──
    console.log("\n===== (3) PER-NEIGHBOURHOOD VIP LIST =====");
    const nbs=await q(`SELECT id, name, profile, "hasVipTier" FROM "Neighbourhood" ORDER BY name`);
    for(const nb of nbs){
      const vr=await q(`SELECT name, "recencyWeightedSold" w FROM "ResidentialStreet" WHERE "neighbourhoodId"=$1 AND "isVip" ORDER BY w DESC`,[nb.id]);
      const vc=await q(`SELECT "buildingAddress" a, "recencyWeightedSold" w FROM "CondoBuilding" WHERE "neighbourhoodId"=$1 AND "isVip" ORDER BY w DESC`,[nb.id]);
      if(!nb.hasVipTier){ console.log(`\n${nb.name} [${nb.profile}] — no VIP tier`); continue; }
      console.log(`\n${nb.name} [${nb.profile}] — ${vr.length} resi VIP, ${vc.length} condo VIP`);
      console.log("  RESI :", vr.map(x=>`${x.name}(${Number(x.w).toFixed(1)})`).join(", ")||"(none)");
      console.log("  CONDO:", vc.map(x=>`${x.a}(${Number(x.w).toFixed(1)})`).join(", ")||"(none)");
    }

    // ── 6. Unmapped queue ──
    console.log("\n===== (6) UNMAPPED NEIGHBOURHOOD STRING QUEUE =====");
    const um=await q(`SELECT COUNT(*)::int n FROM "UnmappedNeighbourhoodString"`);
    console.log(`UnmappedNeighbourhoodString rows: ${um[0].n} (expected 0 — all 25 strings seeded).`);

    // VIP totals
    console.log("\n===== VIP TOTALS =====");
    console.log("Residential VIP:", rs.vip, "| Condo VIP:", cb.vip, "| TOTAL:", rs.vip+cb.vip);
  } finally { await c.end(); }
}
main().catch(e=>{console.error("fatal:",e instanceof Error?e.message:e);process.exit(1);});
