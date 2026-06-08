// Orphan CondoGeneration cleanup — DESTRUCTIVE, single txn, count-asserted, rollback-on-mismatch.
// The dedup deleted CondoContent+CondoBuilding for 23 dupe slugs but left their CondoGeneration
// rows (orphans: no building, no content). Deletes CondoGeneration where buildingSlug is not a
// canonical cluster slug. Asserts deleted==23 AND 0 non-canonical rows remain. Rollback otherwise.
// Usage: rehearsal `--prod` ; execute `--prod --apply`.
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { groupCondoClusters } from "../src/lib/condoIdentity";
const __dirname = dirname(fileURLToPath(import.meta.url));
function envv(name:string){ for(const l of readFileSync(resolve(__dirname,"..",".env.local"),"utf8").split(/\r?\n/)){const t=l.trim();if(!t||t.startsWith("#"))continue;const e=t.indexOf("=");if(e<0)continue;const k=t.slice(0,e).trim();let v=t.slice(e+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(k===name)return v;}return"";}
const DB1=envv("DATABASE_URL"), SOLD=envv("SOLD_DATABASE_URL");
const host=(DB1.match(/@([^/?]+)/)||[])[1]||"";
const EXPECT_DEL=23;
const APPLY=process.argv.includes("--apply");
(async()=>{
  if(!process.argv.includes("--prod")){console.error("❌ GUARD: requires --prod.");process.exit(1);}
  if(!host.startsWith("ep-patient-paper-aebh7f93")){console.error(`❌ GUARD: host ${host} not prod.`);process.exit(1);}
  const sold=new pg.Client({connectionString:SOLD}); await sold.connect();
  const rows=(await sold.query(`SELECT street_number, street_slug, COUNT(*)::int cnt FROM sold.sold_records WHERE property_type='condo' AND street_number IS NOT NULL AND street_slug IS NOT NULL GROUP BY street_number, street_slug`)).rows;
  const { clusters } = groupCondoClusters(rows);
  const canon=[...new Set([...clusters.values()].map((c:any)=>c.canonicalSlug))];
  await sold.end();
  const db1=new pg.Client({connectionString:DB1}); await db1.connect();
  console.log(`DB1: ${host} | canonical slugs: ${canon.length} | mode: ${APPLY?"APPLY":"REHEARSAL"}`);
  let committed=false;
  try{
    await db1.query("BEGIN");
    const pre=Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoGeneration"`)).rows[0].n);
    const orphanPre=Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoGeneration" WHERE "buildingSlug" <> ALL($1::text[])`,[canon])).rows[0].n);
    const del=await db1.query(`DELETE FROM "CondoGeneration" WHERE "buildingSlug" <> ALL($1::text[])`,[canon]);
    const post=Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoGeneration"`)).rows[0].n);
    const postNonCanon=Number((await db1.query(`SELECT COUNT(*)::int n FROM "CondoGeneration" WHERE "buildingSlug" <> ALL($1::text[])`,[canon])).rows[0].n);
    const checks:[string,number,number][]=[["orphans deleted",del.rowCount!,EXPECT_DEL],["non-canonical remaining",postNonCanon,0]];
    console.log(`\npre=${pre} orphanPre=${orphanPre} -> post=${post}`);
    console.log("=== ASSERTIONS ===");
    let ok=true; for(const[l,g,e] of checks){const p=g===e;if(!p)ok=false;console.log(`  ${p?"✓":"✗"} ${l}: got ${g}, expected ${e}`);}
    if(ok&&APPLY){await db1.query("COMMIT");committed=true;console.log("\n✅ COMMITTED — orphans removed.");}
    else{await db1.query("ROLLBACK");console.log(ok?"\n↩️ ROLLBACK — rehearsal only (pass --apply). DB unchanged.":"\n❌ ROLLBACK — assertion mismatch. DB unchanged.");if(!ok)process.exitCode=1;}
  }catch(e){try{await db1.query("ROLLBACK");}catch{}console.error("❌ ERROR — ROLLBACK.\n",e instanceof Error?e.stack:e);process.exitCode=2;}
  finally{await db1.end();}
  if(APPLY&&!committed&&process.exitCode==null)process.exitCode=1;
})();
