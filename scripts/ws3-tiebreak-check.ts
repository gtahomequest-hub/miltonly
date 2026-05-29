// WS3 — promote-both evidence + null-neighbourhood audit. READ-ONLY staging.
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const env: Record<string,string> = {};
for (const l of readFileSync(resolve(__dirname,"..",".env"),"utf8").split(/\r?\n/)) {
  const t=l.trim(); if(!t||t.startsWith("#"))continue; const i=t.indexOf("="); if(i===-1)continue;
  let v=t.slice(i+1).trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  env[t.slice(0,i).trim()]=v;
}
async function main(){
  const c=new pg.Client({connectionString:env.DIRECT_DATABASE_URL}); await c.connect();
  const q=(s:string,v:unknown[]=[])=>c.query(s,v).then(r=>r.rows);
  // promote-both: residential pools where actual VIP > ceil(20%) (ties added)
  const rows=await q(`
    WITH pool AS (
      SELECT rs."neighbourhoodId" nb, n.name, rs."recencyWeightedSold" w, rs."isVip"
      FROM "ResidentialStreet" rs JOIN "Neighbourhood" n ON n.id=rs."neighbourhoodId"
      WHERE n."hasVipTier" AND rs."recencyWeightedSold">0)
    SELECT name, COUNT(*)::int pool, CEIL(COUNT(*)*0.2)::int nominal_vip,
           COUNT(*) FILTER (WHERE "isVip")::int actual_vip
    FROM pool GROUP BY name
    HAVING COUNT(*) FILTER (WHERE "isVip") > CEIL(COUNT(*)*0.2) ORDER BY name`);
  console.log("Residential pools where promote-both ADDED VIPs beyond ceil(20%):");
  console.table(rows.length?rows:[{note:"none this cycle — each cutoff value was unique"}]);

  // concrete boundary ties (multiple entities sharing the min VIP weighted in a pool)
  const tie=await q(`
    WITH r AS (
      SELECT n.name, rs.name sname, rs."recencyWeightedSold" w, rs."isVip",
        MIN(rs."recencyWeightedSold") FILTER (WHERE rs."isVip") OVER (PARTITION BY rs."neighbourhoodId") minvip
      FROM "ResidentialStreet" rs JOIN "Neighbourhood" n ON n.id=rs."neighbourhoodId"
      WHERE n."hasVipTier" AND rs."recencyWeightedSold">0)
    SELECT name, sname, w, "isVip" FROM r
    WHERE w = minvip
      AND (name, minvip) IN (SELECT name, minvip FROM r GROUP BY name, minvip HAVING COUNT(*)>1)
    ORDER BY name, sname`);
  console.log("\nBoundary-value ties at a pool's lowest VIP weighted (promote-both keeps all):");
  console.table(tie.length?tie:[{note:"no boundary ties at any cutoff this cycle"}]);

  console.log("\nResidentialStreet rows with NULL neighbourhood (published-only coverage):");
  console.table(await q(`SELECT rs.slug, rs.name, sc.neighbourhood sc_nbhd
    FROM "ResidentialStreet" rs LEFT JOIN "StreetContent" sc ON sc."streetSlug"=rs.slug
    WHERE rs."neighbourhoodId" IS NULL`));
  await c.end();
}
main().catch(e=>{console.error("fatal:",e instanceof Error?e.message:e);process.exit(1);});
