// WS3 STEP A — pre-flight connection target confirmation. READ-ONLY (SELECT 1).
// Prints which endpoint each URL actually connects to, so we never confuse
// staging with prod. Usage: npx tsx scripts/ws3-preflight.ts
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function readEnvFile(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const content = readFileSync(resolve(__dirname, "..", name), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("="); if (eq === -1) continue;
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[k] = v;
    }
  } catch { /* ignore */ }
  return out;
}

function hostOf(url: string): string {
  const m = url.match(/@([^/?]+)/);
  return m ? m[1] : "(unparseable)";
}

async function check(label: string, url: string) {
  if (!url) { console.log(`${label}: (not set)`); return; }
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const r = await c.query(`SELECT 1 AS ok, current_database() AS db, inet_server_addr() AS server_ip`);
  await c.end();
  console.log(`${label}:`);
  console.log(`   URL host      : ${hostOf(url)}`);
  console.log(`   SELECT 1      : ok=${r.rows[0].ok} db=${r.rows[0].db} server_ip=${r.rows[0].server_ip ?? "(pooled/hidden)"}`);
}

async function main() {
  const local = readEnvFile(".env.local");
  const staging = readEnvFile(".env.staging");
  console.log("=== WS3 PRE-FLIGHT — connection targets ===");
  await check("PROD   DATABASE_URL (.env.local)", local.DATABASE_URL || "");
  await check("STAGING DATABASE_URL (.env.staging, pooler)", staging.DATABASE_URL || "");
  await check("STAGING DIRECT_DATABASE_URL (.env.staging, direct)", staging.DIRECT_DATABASE_URL || "");

  const prodHost = hostOf(local.DATABASE_URL || "");
  const stageHost = hostOf(staging.DATABASE_URL || "");
  console.log("\n=== GUARD CHECK ===");
  console.log(prodHost.startsWith("ep-old-unit-aeyqkwyt")
    ? "❌ DANGER: .env.local DATABASE_URL points at the STAGING endpoint!"
    : `✅ prod (.env.local) = ${prodHost} — distinct from staging.`);
  console.log(stageHost.startsWith("ep-old-unit-aeyqkwyt")
    ? `✅ staging = ${stageHost} — correct branch endpoint.`
    : `❌ staging URL is NOT the expected ws3-staging endpoint: ${stageHost}`);
}
main().catch((e) => { console.error("fatal:", e); process.exit(1); });
