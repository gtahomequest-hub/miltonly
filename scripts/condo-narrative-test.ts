// Verify the grounded condo narrative generator over the 4 pilots (real DeepSeek via the choke).
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const PILOTS = ["610-farmstead-drive-milton", "830-megson-terrace-milton", "480-gordon-krantz-avenue-milton", "139-main-street-milton"];
async function main() {
  const { buildBuildingAttributes } = await import("@/lib/ai/buildBuildingAttributes");
  const { generateCondoNarrative } = await import("@/lib/ai/condoNarrative");
  const { extractNumerics } = await import("@/lib/ai/validateStreetGeneration");
  for (const slug of PILOTS) {
    const a = await buildBuildingAttributes(slug);
    const { _debug, ...safe } = a;
    const { prose } = await generateCondoNarrative(safe);
    console.log(`\n═══ ${slug} ═══`);
    console.log(`  prose: ${prose ? `"${prose}"` : "null (fail-closed → page uses deterministic copy)"}`);
    if (prose) {
      const nums = extractNumerics(prose).map((n) => `${n.type}:${n.raw}`);
      console.log(`  numerics in prose: ${nums.length ? nums.join(", ") : "(none)"}`);
      console.log(`  states a raw count: ${/\b\d+\s+(units?|sales?|leases?|sold|listed|condos?)\b/i.test(prose)}  (must be false)`);
      console.log(`  says 'median': ${/median/i.test(prose)}  em-dash: ${/[—–]/.test(prose)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
