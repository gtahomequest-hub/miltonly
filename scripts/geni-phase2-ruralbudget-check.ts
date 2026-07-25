// One-off: DEC-GENI-7 profile-gate proof. rural_hub-profile neighbourhoods with inventory
// must rank WITHOUT a budget_comfortable tag (neither credited nor penalized on their tiny-n mean).
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

async function main() {
  const { matchNeighbourhoods } = await import("@/lib/geni/matchNeighbourhoods");
  const { NEIGHBOURHOOD_SEED } = await import("@/lib/neighbourhood");
  const { prisma } = await import("@/lib/prisma");
  const proceed = (criteria: any) => ({ outcome: "proceed", criteria, declined: [], neutralized: [] } as any);
  const profileOf = (slug: string) => NEIGHBOURHOOD_SEED.find((s) => s.slug === slug);

  const show = (m: any) => {
    const s = profileOf(m.slug)!;
    const hasBudget = m.tags.some((t: any) => t.key === "budget_comfortable");
    console.log(`  ${m.slug.padEnd(16)} profile=${s.profile.padEnd(12)} kind=${s.kind.padEnd(10)} live=${m.liveCount} tags=[${m.tags.map((t:any)=>`${t.key}:${t.met?"Y":"n"}`).join(",")}] budgetTagPresent=${hasBudget} lowConf=${m.typicalLowConfidence} aboveBudget=${m.aboveTypicalBudget}`);
  };

  // Case A query — bronte-meadows is profile=rural_hub (kind=urban) and HAS inventory here.
  console.log("═══ Case-D-style A: detached under $1.1M near the GO ═══");
  const A = await matchNeighbourhoods(proceed({ maxPrice: 1100000, propertyType: "detached", nearGO: true }));
  A.matches.forEach(show);
  const ruralProfileWithInv = A.matches.filter((m: any) => profileOf(m.slug)!.profile === "rural_hub");
  console.log(`\n  rural_hub-profile matches with inventory: ${ruralProfileWithInv.map((m:any)=>m.slug).join(", ") || "(none in this query)"}`);
  const anyBudgetLeak = ruralProfileWithInv.some((m: any) => m.tags.some((t: any) => t.key === "budget_comfortable"));
  console.log(`  ANY rural_hub carries a budget_comfortable tag: ${anyBudgetLeak}  (must be false)`);
  console.log(`  bronte-meadows still ranks (present in results): ${A.matches.some((m:any)=>m.slug==="bronte-meadows")}`);

  // A broad query to try to surface a kind=rural with inventory too.
  console.log("\n═══ Case-D-style B: detached under $3M (broad — surface any rural with inventory) ═══");
  const B = await matchNeighbourhoods(proceed({ maxPrice: 3000000, propertyType: "detached" }));
  const rurals = B.matches.filter((m: any) => profileOf(m.slug)!.kind === "rural");
  if (!rurals.length) console.log("  (no kind=rural neighbourhood has detached inventory under $3M right now)");
  rurals.forEach(show);
  const ruralBudgetLeak = rurals.some((m: any) => m.tags.some((t: any) => t.key === "budget_comfortable"));
  console.log(`  ANY kind=rural carries a budget_comfortable tag: ${ruralBudgetLeak}  (must be false)`);

  // Sanity: an urban_hub still DOES get a budget tag (fix didn't nuke the signal).
  const urbanSample = A.matches.find((m: any) => profileOf(m.slug)!.profile === "urban_hub" && m.tags.some((t:any)=>t.key==="budget_comfortable"));
  console.log(`\n  urban_hub still receives budget_comfortable (signal intact): ${!!urbanSample}${urbanSample?` (e.g. ${urbanSample.slug})`:""}`);

  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
