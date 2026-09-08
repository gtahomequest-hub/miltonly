// scripts/recon-directional-siblings.ts
// Which published street pages collapse onto one Town street identity, and therefore onto one
// address ladder? Read-only. No changes.
//
// identityFromSlug drops the directional by design (`{base}||{type}`, direction removed), because
// a street page already unions its directional siblings for listings and sold records. The
// address ladder inherits that, so both pages of a directional pair render every civic address on
// the whole street. This lists every pair so the consequence is a decision rather than a
// discovery.
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].replace(/\r$/, "");
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}
loadEnvLocal();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { identityFromSlug } = await import("../src/lib/town/identity");
  const { resolveStreetName } = await import("../src/lib/streetName");
  const { townAddressesForSlug } = await import("../src/lib/town/addresses");
  const { MILTON_STREET_REGISTRY } = await import("../src/data/miltonStreetRegistry");

  const rows = await prisma.streetContent.findMany({
    select: { streetSlug: true, streetName: true, status: true, template: true },
    orderBy: { streetSlug: "asc" },
  });

  // Registry rows that share an identity key, whether or not we publish them.
  const regByKey = new Map<string, string[]>();
  for (const r of MILTON_STREET_REGISTRY) {
    const k = identityFromSlug(r.slug).key;
    regByKey.set(k, [...(regByKey.get(k) ?? []), r.name]);
  }

  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = identityFromSlug(r.streetSlug).key;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }

  const groups = [...byKey.entries()].filter(([, v]) => v.length > 1).sort();
  console.log(`StreetContent rows: ${rows.length}  (published ${rows.filter((r) => r.status === "published").length})`);
  console.log(`identity keys carrying more than one row: ${groups.length}\n`);

  let publishedPairs = 0;
  for (const [key, v] of groups) {
    const pubs = v.filter((r) => r.status === "published");
    if (pubs.length > 1) publishedPairs += 1;
    const town = townAddressesForSlug(v[0].streetSlug);
    console.log(`${key}   ladder=${town ? `${town.addresses.length} addresses` : "none"}   registry=[${(regByKey.get(key) ?? ["(absent)"]).join(" | ")}]`);
    for (const r of v) {
      const resolved = resolveStreetName(r.streetSlug);
      console.log(
        `   ${r.streetSlug.padEnd(34)} ${r.status.padEnd(10)} ${r.template.padEnd(9)} stored="${r.streetName}"  resolves="${resolved.name}"  via=${resolved.source}`
      );
    }
    console.log("");
  }
  console.log(`groups where MORE THAN ONE row is published: ${publishedPairs}
`);

  // The registry side of the same question: which official street names carry a compass word,
  // and do any two registry streets collapse onto one identity key?
  const COMPASS = new Set(["NORTH", "SOUTH", "EAST", "WEST"]);
  const compass = MILTON_STREET_REGISTRY.filter((r) => r.name.split(" ").some((t) => COMPASS.has(t)));
  console.log(`registry streets carrying a compass word: ${compass.length}`);
  const status = new Map(rows.map((r) => [r.streetSlug, r.status]));
  for (const r of compass) {
    console.log(`   ${r.slug.padEnd(34)} key=${identityFromSlug(r.slug).key.padEnd(20)} page=${status.get(r.slug) ?? "NONE"}`);
  }
  const collide = [...regByKey.entries()].filter(([, v]) => v.length > 1);
  console.log(`
registry identity keys shared by more than one registry street: ${collide.length}`);
  for (const [k, names] of collide.sort()) console.log(`   ${k}  ${names.join(" | ")}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
