// scripts/registry-cleanup.ts
// STEP-4-PROPER execution. Resolves every non-official ResidentialStreet row to an
// action against the official registry, then (with --commit) reassigns sold_records,
// transfers VIP/neighbourhoodId, deletes merged/junk entities. ORDER: reassign BEFORE
// delete. Published source rows (indexed) are DEFERRED to the merge step (their 301 is
// code, not live until merge) — this script deletes only NON-published sources; it
// emits the deferred set for the merge run.
//
// Dry-run by default. --commit executes. --emit writes JSON maps (301 + offRegistry).
import { readFileSync, writeFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const COMMIT = process.argv.includes("--commit");
const EMIT = process.argv.includes("--emit");

const ABBR: Record<string,string> = { rd:"road",st:"street",ave:"avenue",av:"avenue",blvd:"boulevard",crt:"court",ct:"court",dr:"drive",cres:"crescent",pl:"place",trl:"trail",cir:"circle",ln:"lane",terr:"terrace",ter:"terrace",grv:"grove",hts:"heights",hllw:"hollow",pkwy:"parkway",sdrd:"sideroad",gdns:"garden",gardens:"garden",hwy:"highway",pt:"point",ldg:"landing",cr:"crescent",wy:"way",xing:"crossing",cirle:"circle",cross:"crossing" };
const ORD: Record<string,string> = {"1":"first","1st":"first","2":"second","2nd":"second","3":"third","3rd":"third","4":"fourth","4th":"fourth","5":"fifth","5th":"fifth","6":"sixth","6th":"sixth","7":"seventh","7th":"seventh","8":"eighth","8th":"eighth","9":"ninth","9th":"ninth","10":"tenth","10th":"tenth"};
const DIR = new Set(["e","w","n","s","ne","nw","se","sw","east","west","north","south"]);
const TYPE = new Set(["street","court","crescent","terrace","place","way","road","avenue","gate","lane","heights","landing","boulevard","trail","point","circle","line","crossing","garden","common","path","close","drive","parkway","centre","townline","sideroad","grove","hollow","ridge","hill","view","square","park","walk","mews","row","vale","villas","green"]);
const TRAILJUNK = /^(?:[a-z]|\d+|th\d+|unit\d*|ll|upl|upr|upper|lower|main|bsmt|milton|only|flr)$/;
const JUNK = /\b(unit|apt|apartment|suite|ste|floor|flr|level|lvl|basement|bsmt|bsment|basmt|basemnt|basmnt|basment|ground|rear|loft|penthouse|coach|entire|property|bonus|parking|upr|upl|mn|th\d|unt|con|lot|only)\b|[&#/\[\],]/i;
const SIDEROAD = /side\s*r(oa)?d|sideroad/i;
const LEGAL = /\bcon\b.*\blot\b|concession/i;
function toks(name:string):string[]{const s=String(name||"").toLowerCase().replace(/-milton$/,"").replace(/[-_]/g," ").replace(/[^a-z0-9\s]/g," ");const t=s.split(/\s+/).filter(Boolean).map(x=>ORD[x]||ABBR[x]||x);while(t.length>1&&DIR.has(t[t.length-1]))t.pop();while(t.length>1&&DIR.has(t[0]))t.shift();return t;}
const norm=(n:string)=>toks(n).join(" ");
function baseKey(t:string[]):string{const a=[...t];while(a.length>1&&TYPE.has(a[a.length-1]))a.pop();return a.join(" ");}
function lev(a:string,b:string){const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>{const r=new Array(n+1).fill(0);r[0]=i;return r;});for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
// truncate name after the first street-type token (+ trailing dir), for E1 base resolution
function truncAfterType(rawName:string):string|null{ const raw=String(rawName||"").toLowerCase().replace(/-milton$/,"").replace(/[-_]/g," ").replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(Boolean).map(x=>ABBR[x]||x); let ti=-1; for(let i=0;i<raw.length;i++){ if(TYPE.has(raw[i])){ti=i;break;} } if(ti<0)return null; let end=ti+1; while(end<raw.length&&DIR.has(raw[end]))end++; return raw.slice(0,end).join(" "); }

// Explicit edge tables (per approved E2/E3/Nipissing calls)
const E2_MERGE: Record<string,string> = { "first-nassagaweya-line-milton":"first-line-nassagaweya-milton","sixth-nassagaweya-line-milton":"sixth-line-nassagaweya-milton","6th-nassagaweya-line-milton":"sixth-line-nassagaweya-milton","2nd-line-milton":"second-line-milton" };
const CONSOLIDATE: Record<string,string> = { "nippising-road-milton":"nipissing-road-milton" };
// Explicit bases for rows the heuristics can't resolve but whose base is unambiguous
// (reported for review; con-5-pt-lot-17 is intentionally NOT here — legal desc, flagged).
const MANUAL_MAP: Record<string,string> = {
  "gervais-lower-level-terrace-milton":"gervais-terrace-milton",   // E1 base
  "melville-milton":"melville-bonus-crescent-milton",             // per your E3 call
  "farmstead-dr-ne-88-milton":"farmstead-drive-milton",           // E1 base
  "symons-crossing-mill-milton":"symons-crossing-milton",         // E1 base
  "landsborough-basment-avenue-milton":"landsborough-avenue-milton", // E1 base
  "derry-rd-th-107-milton":"derry-road-milton",                   // E1 base
  "toletza-milton":"toletzka-landing-milton",                     // typo twin of Toletzka Landing
  "106-rottenburg-court-milton":"rottenburg-court-milton",        // leading-number junk
  "upper-384-cedric-terrace-milton":"cedric-terrace-milton",      // E1 base
};
const KEEP_OFFREGISTRY_TEST = (slug:string,name:string) => SIDEROAD.test(name) || SIDEROAD.test(slug) || slug==="second-line-milton" || slug==="nipissing-road-milton";

async function main(){
  const { PrismaClient } = await import("@prisma/client"); const { neon } = await import("@neondatabase/serverless");
  const { MILTON_STREET_REGISTRY: REG } = await import("../src/data/miltonStreetRegistry");
  const p = new PrismaClient(); const soldDb = neon(process.env.SOLD_DATABASE_URL!);
  const regBySlug = new Map(REG.map(r=>[r.slug,r])); const byNorm=new Map<string,any>(); const byBase=new Map<string,any[]>(); const regNorms:string[]=[];
  for(const r of REG){byNorm.set(norm(r.name),r);regNorms.push(norm(r.name));const bk=baseKey(toks(r.name));if(!byBase.has(bk))byBase.set(bk,[]);byBase.get(bk)!.push(r);}
  function matchReg(name:string,slug?:string):any|null{if(slug&&regBySlug.has(slug))return regBySlug.get(slug);const t=toks(name);let hit=byNorm.get(t.join(" "));if(hit)return hit;let bk=baseKey(t);let bm=byBase.get(bk);if(bm&&bm.length===1)return bm[0];const t2=[...t];let s=false;while(t2.length>1&&TRAILJUNK.test(t2[t2.length-1])){t2.pop();s=true;}if(s){hit=byNorm.get(t2.join(" "));if(hit)return hit;bk=baseKey(t2);bm=byBase.get(bk);if(bm&&bm.length===1)return bm[0];}return null;}
  function levNearest(name:string){const un=norm(name);let best="",bd=99;for(const rn of regNorms){const dd=lev(un,rn);if(dd<bd){bd=dd;best=rn;}}return bd<=2?{reg:byNorm.get(best),dist:bd}:null;}

  const rows = await p.residentialStreet.findMany({ select:{slug:true,name:true,isVip:true,neighbourhoodId:true,soldCount12mo:true,recencyWeightedSold:true} });
  const bySlug = new Map(rows.map(r=>[r.slug,r]));
  const pub = await p.streetContent.findMany({ where:{status:"published"}, select:{streetSlug:true} }); const pubSet=new Set(pub.map(r=>r.streetSlug));
  const soldAgg = await soldDb`SELECT street_slug, COUNT(*)::int AS c FROM sold.sold_records GROUP BY street_slug` as any[];
  const soldBySlug=new Map<string,number>(); for(const s of soldAgg) soldBySlug.set(s.street_slug,s.c);

  type Plan = { slug:string; name:string; target:string|null; action:string; note:string; db2:number; published:boolean; vip:boolean; nbId:string|null };
  const plans: Plan[] = [];
  for(const row of rows){
    if(regBySlug.has(row.slug)) continue;
    const db2=soldBySlug.get(row.slug)??0; const published=pubSet.has(row.slug);
    const base = { slug:row.slug, name:row.name, db2, published, vip:row.isVip, nbId:row.neighbourhoodId } as any;
    if(MANUAL_MAP[row.slug]){ plans.push({...base,target:MANUAL_MAP[row.slug],action:"merge-delete",note:"manual base"}); continue; }
    if(CONSOLIDATE[row.slug]){ plans.push({...base,target:CONSOLIDATE[row.slug],action:"consolidate-delete",note:"Nipissing spelling merge"}); continue; }
    if(E2_MERGE[row.slug]){ plans.push({...base,target:E2_MERGE[row.slug],action:"merge-delete",note:"E2 word-order"}); continue; }
    if(KEEP_OFFREGISTRY_TEST(row.slug,row.name)){ plans.push({...base,target:null,action:"keep-offregistry",note:"rural/regional road"}); continue; }
    const m=matchReg(row.name,row.slug);
    if(m){ plans.push({...base,target:m.slug,action:JUNK.test(row.name)?"junk-delete":"merge-delete",note:JUNK.test(row.name)?"unit/legal":"dupe/typo"}); continue; }
    // no direct match
    if(LEGAL.test(row.name)){ plans.push({...base,target:null,action:db2>0?"FLAG-legal":"legal-delete",note:db2>0?"legal desc — carries sold record(s), cannot rehome (street unknown)":"legal description, not a street"}); continue; }
    if(JUNK.test(row.name)){ const tb=truncAfterType(row.name); const m2=tb?matchReg(tb):null; if(m2) plans.push({...base,target:m2.slug,action:"junk-delete",note:`E1 base=${tb}`}); else plans.push({...base,target:null,action:"FLAG-ambiguous",note:`E1 unresolved (trunc=${tb})`}); continue; }
    const ln=levNearest(row.name);
    if(ln){ plans.push({...base,target:ln.reg.slug,action:"merge-delete",note:`E3 typo d${ln.dist}`}); continue; }
    plans.push({...base,target:null,action:"FLAG-review",note:"no match"});
  }

  // ── target validation: every target must resolve to a kept entity/registry slug,
  //    and must NOT itself be a deletable source (no orphan chains) ──
  const deletableActions = new Set(["merge-delete","junk-delete","consolidate-delete","legal-delete"]);
  const deleteSrc = new Set(plans.filter(p=>deletableActions.has(p.action)).map(p=>p.slug));
  const badTargets: Plan[] = [];
  for(const pl of plans){ if(!pl.target) continue; const exists = regBySlug.has(pl.target) || bySlug.has(pl.target); if(!exists){ pl.action="FLAG-target-missing"; pl.note=`target ${pl.target} has no entity/registry slug`; badTargets.push(pl); } else if(deleteSrc.has(pl.target)){ pl.action="FLAG-target-chain"; pl.note=`target ${pl.target} is itself being deleted`; badTargets.push(pl); } }
  if(badTargets.length) console.log(`!! ${badTargets.length} target-validation flags (see below)`);

  // group + report
  const grp: Record<string,Plan[]> = {}; for(const pl of plans){ (grp[pl.action]??=[]).push(pl); }
  const soldToMove = plans.filter(p=>p.target&&p.action!=="keep-offregistry").reduce((a,b)=>a+b.db2,0);
  const vipXfer = plans.filter(p=>p.target&&p.vip&&!(bySlug.get(p.target!)?.isVip)).length;
  const nbXfer = plans.filter(p=>p.target&&p.nbId&&!bySlug.get(p.target!)?.neighbourhoodId).length;
  console.log(`=== registry-cleanup ${COMMIT?"(COMMIT)":"(DRY RUN)"} ===`);
  for(const a of Object.keys(grp).sort()) console.log(`  ${a.padEnd(20)} ${grp[a].length}`);
  console.log(`  sold_records to move: ${soldToMove} | VIP xfer: ${vipXfer} | nbId xfer: ${nbXfer}`);
  const flags = plans.filter(p=>p.action.startsWith("FLAG"));
  console.log(`\n--- FLAGGED (need your target; NOT executed) [${flags.length}] ---`); flags.forEach(f=>console.log(`  "${f.name}" [${f.slug}] db2=${f.db2} ${f.note}`));
  console.log(`\n--- E1 base-resolved (junk-delete via truncation) ---`); grp["junk-delete"]?.filter(p=>p.note.startsWith("E1")).forEach(p=>console.log(`  ${p.slug.padEnd(38)} -> ${p.target}   (${p.note})`));
  console.log(`\n--- legal-delete ---`); grp["legal-delete"]?.forEach(p=>console.log(`  ${p.slug} db2=${p.db2} (sold records ${p.db2>0?"NEED REHOMING — FLAG":"none"})`));
  console.log(`\n--- keep-offregistry [${grp["keep-offregistry"]?.length??0}] ---`); grp["keep-offregistry"]?.forEach(p=>console.log(`  ${p.slug}${p.published?" (published)":""}`));

  // published sources -> deferred to merge (301 live then); build 301 map for ALL published sources with a target
  const pubDeferred = plans.filter(p=>p.published && p.target && p.action!=="keep-offregistry");
  const redirectMap = pubDeferred.map(p=>({from:`/streets/${p.slug}`,to:`/streets/${p.target}`}));
  const offRegistry = plans.filter(p=>p.action==="keep-offregistry").map(p=>p.slug);
  console.log(`\n--- 301 REDIRECTS (published sources, activate at merge) [${redirectMap.length}] ---`); redirectMap.forEach(r=>console.log(`  ${r.from} -> ${r.to}`));

  if(EMIT){ writeFileSync(resolve(__d,"../_redirects.json"),JSON.stringify(redirectMap,null,2)); writeFileSync(resolve(__d,"../_offregistry.json"),JSON.stringify(offRegistry,null,2)); console.log("\n(emitted _redirects.json + _offregistry.json)"); }

  if(!COMMIT){ console.log("\n(dry run — no writes)"); await p.$disconnect(); process.exit(0); }

  // ── EXECUTE ── Abort only on UNINTENDED flags. FLAG-legal (e.g. "Con 5 Pt Lot 17")
  // is deliberately left in place — its entity + lone sold record stay untouched.
  const blocking = flags.filter(f => f.action !== "FLAG-legal");
  if(blocking.length){ console.log(`\n!! ${blocking.length} unresolved flag(s) — fix before --commit. Aborting writes.`); await p.$disconnect(); process.exit(1); }
  if(flags.length) console.log(`\n(note: ${flags.length} FLAG-legal row left untouched by design: ${flags.map(f=>f.slug).join(", ")})`);
  const deletable = plans.filter(p=>["merge-delete","junk-delete","consolidate-delete","legal-delete"].includes(p.action));
  // Process NON-PUBLISHED sources fully now. PUBLISHED sources (indexed) are left
  // untouched until the merge step, when their 301 goes live — reassign+unpublish+
  // delete all coincide then, so no window where an indexed URL 404s.
  const nonPubDel = deletable.filter(p=>!p.published);
  const pubDeferredDel = deletable.filter(p=>p.published);
  // 1) reassign sold_records (DB2) for non-published sources — BEFORE deletes
  let moved=0; for(const pl of nonPubDel){ if(!pl.target||pl.db2===0) continue; await soldDb`UPDATE sold.sold_records SET street_slug=${pl.target} WHERE street_slug=${pl.slug}`; moved+=pl.db2; }
  console.log(`\n[commit] sold_records reassigned (non-published sources): ~${moved}`);
  // 2) transfer VIP + nbId to survivors  (NOTE: `p` is the PrismaClient — loop var is `pl`)
  let vc=0,nc=0; for(const pl of nonPubDel){ if(!pl.target) continue; const off=bySlug.get(pl.target); if(!off) continue; const data:any={}; if(pl.vip&&!off.isVip){data.isVip=true;data.vipEarnedAt=new Date();vc++;} if(pl.nbId&&!off.neighbourhoodId){data.neighbourhoodId=pl.nbId;nc++;} if(Object.keys(data).length){ await p.residentialStreet.update({where:{slug:pl.target},data}); off.isVip=off.isVip||data.isVip; off.neighbourhoodId=off.neighbourhoodId||data.neighbourhoodId; } }
  console.log(`[commit] VIP transfers: ${vc}, nbId transfers: ${nc}`);
  // 3) delete NON-published source entities
  const dr = await p.residentialStreet.deleteMany({ where:{ slug:{ in: nonPubDel.map(pl=>pl.slug) } } });
  console.log(`[commit] non-published source entities deleted: ${dr.count}`);
  console.log(`[commit] PUBLISHED sources deferred to merge (reassign+unpublish+delete+301): ${pubDeferredDel.length}`);
  const total = await p.residentialStreet.count();
  console.log(`[commit] entities now: ${total}`);
  await p.$disconnect(); process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
