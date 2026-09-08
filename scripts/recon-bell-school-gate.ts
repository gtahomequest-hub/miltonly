// scripts/recon-bell-school-gate.ts
// Does bell-school-line-milton pass the generation gate? QUEUE item 3 step 6 says generate it
// only if it does. Read-only.
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

const SLUG = "bell-school-line-milton";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { getStreetStats } = await import("../src/lib/streetDecision");
  const { MILTON_STREET_REGISTRY } = await import("../src/data/miltonStreetRegistry");

  const inRegistry = MILTON_STREET_REGISTRY.some((r) => r.slug === SLUG);
  const listings = await prisma.listing.groupBy({
    by: ["status"],
    where: { streetSlug: SLUG },
    _count: true,
  });
  const total = listings.reduce((a, r) => a + r._count, 0);
  const active = listings.find((r) => r.status === "active")?._count ?? 0;
  const sold = listings.find((r) => r.status === "sold")?._count ?? 0;
  const content = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG }, select: { status: true } });
  const queue = await prisma.streetQueue.findUnique({ where: { streetSlug: SLUG }, select: { status: true, attempts: true, lastError: true } });

  console.log(`registry            : ${inRegistry}`);
  console.log(`StreetContent       : ${content ? content.status : "NONE"}`);
  console.log(`StreetQueue         : ${queue ? `${queue.status} attempts=${queue.attempts} lastError=${queue.lastError ?? "-"}` : "NONE"}`);
  console.log(`DB1 by status       : ${JSON.stringify(listings.map((l) => [l.status, l._count]))}`);
  console.log(`minimum-data gate   : ${total === 0 || (sold < 1 && active < 1) ? "SKIP_LOW_DATA" : "PASS"} (total=${total} sold=${sold} active=${active})`);

  const stats = await getStreetStats(SLUG);
  console.log(`getStreetStats      : ${stats ? "OK" : "NULL — cannot generate"}`);
  if (stats) console.log(JSON.stringify(stats, null, 2).slice(0, 1200));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
