// scripts/create-street-page.ts
// CREATE a street page that does not exist yet, one slug at a time, on DeepSeek.
//
// WHY THIS AND NOT regen-058-local.ts: that runner is a REgeneration runner and skips any slug
// with no StreetContent row ("SKIP — no StreetContent row"), which is precisely the case here.
// The provider discipline is copied from it verbatim: the three primary halves are forced to
// DeepSeek and the script refuses to start if any of them is aimed at Claude, because a Claude
// primary pass is the expensive mistake that guard exists to prevent.
//
// THE ENTITY FLOOR STILL APPLIES. A slug absent from both the Town registry and the off-registry
// allowlist is refused here, not merely warned about: publish floor = entity floor.
//
//   SLUGS=bell-school-line-milton npx tsx --tsconfig tsconfig.test.json scripts/create-street-page.ts
import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].replace(/\r$/, "");
      const dq = v.startsWith('"') && v.endsWith('"');
      const sq = v.startsWith("'") && v.endsWith("'");
      if (dq || sq) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}
loadEnvLocal();

const wantFallback = (process.env.REGEN_FALLBACK || "").trim();
if (wantFallback) process.env.AI_PROVIDER_FALLBACK = wantFallback;
else delete process.env.AI_PROVIDER_FALLBACK;
process.env.AI_PROVIDER = "phase41_v2";

const CLAUDE_WORDS = new Set(["claude", "opus", "sonnet", "haiku"]);
for (const k of ["AI_PROVIDER_MARKET", "AI_PROVIDER_AHA", "AI_PROVIDER_EVAL"]) {
  const v = (process.env[k] || "").trim();
  if (CLAUDE_WORDS.has(v)) throw new Error(`${k}="${v}" routes a PRIMARY pass to Claude. Refusing to start.`);
}
if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY unset; the primary path is DeepSeek");
if (wantFallback && !CLAUDE_WORDS.has(wantFallback)) throw new Error(`REGEN_FALLBACK="${wantFallback}" is not a Claude model key`);
if (wantFallback && !process.env.ANTHROPIC_API_KEY) throw new Error("REGEN_FALLBACK set but ANTHROPIC_API_KEY unset");

const SLUGS = (process.env.SLUGS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (SLUGS.length === 0) throw new Error("SLUGS unset. Nothing to do.");

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { generateStreetContent } = await import("../src/lib/generateStreet");
  const { resolveStreetName } = await import("../src/lib/streetName");
  const { MILTON_STREET_REGISTRY } = await import("../src/data/miltonStreetRegistry");
  const { OFF_REGISTRY_SET } = await import("../src/data/offRegistryStreets");
  const { makeStreetDecision } = await import("../src/lib/streetDecision");

  const registry = new Set(MILTON_STREET_REGISTRY.map((r) => r.slug));

  console.log(`[create] primaries -> deepseek; fallback ${wantFallback ? `ENABLED (${wantFallback})` : "disabled"}`);

  for (const slug of SLUGS) {
    if (!registry.has(slug) && !OFF_REGISTRY_SET.has(slug)) {
      console.log(`[create] REFUSED ${slug} — absent from the registry and the off-registry allowlist`);
      continue;
    }
    const existing = await prisma.streetContent.findUnique({ where: { streetSlug: slug }, select: { status: true } });
    if (existing) {
      console.log(`[create] SKIP ${slug} — a StreetContent row already exists (${existing.status}); use the regen runner`);
      continue;
    }
    const name = resolveStreetName(slug).name;
    const decision = await makeStreetDecision(slug, name);
    console.log(`[create] ${slug} (${name}) decision=${decision}`);
    if (decision === "skip_low_data") continue;

    const started = Date.now();
    const r = await generateStreetContent(slug, name, { skipSms: true });
    const row = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: { status: true, streetName: true, template: true },
    });
    console.log(
      `[create] ${slug} -> ${JSON.stringify({ success: (r as { success?: boolean }).success ?? null, seconds: Math.round((Date.now() - started) / 1000), row })}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
