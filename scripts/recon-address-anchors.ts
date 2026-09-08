// scripts/recon-address-anchors.ts
// Recon for QUEUE item 3 rollout: publication state and ladder shape for the four Gate A streets,
// plus the corpus-wide coverage the section will have once it is on for every published street.
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

const FOUR = ["mae-court-milton", "mcphail-way-milton", "pine-street-milton", "bell-school-line-milton"];

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { townAddressesForSlug } = await import("../src/lib/town/addresses");
  const { buildAddressLadder } = await import("../src/lib/streetAddresses");
  const { resolveStreetName } = await import("../src/lib/streetName");

  console.log("── the four Gate A streets ──");
  for (const slug of FOUR) {
    const row = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: { status: true, template: true, streetName: true },
    });
    const listings = await prisma.listing.findMany({
      where: { streetSlug: slug, permAdvertise: true },
      select: { address: true, mlsNumber: true, status: true, permAdvertise: true, propertySubType: true, propertyType: true },
    });
    const name = resolveStreetName(slug).name;
    const ladder = buildAddressLadder({ slug, streetName: name, listings });
    const town = townAddressesForSlug(slug);
    console.log(
      [
        slug.padEnd(24),
        `page=${row ? `${row.status}/${row.template}` : "NONE"}`.padEnd(22),
        `addresses=${String(ladder?.count ?? 0).padStart(3)}`,
        `range=${ladder ? `${ladder.low}-${ladder.high}` : "-"}`.padEnd(16),
        `crosses=${town?.crossStreets.length ?? 0}`,
        `forms=${ladder?.marks.filter((m) => m.form).length ?? 0}`,
        `live=${ladder?.activeCount ?? 0}`,
        `db1=${listings.length}`,
      ].join("  ")
    );
    if (ladder) console.log(`    summary: ${ladder.summary}`);
  }

  console.log("\n── corpus coverage once the gate opens ──");
  const published = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true },
  });
  let withLadder = 0;
  let totalAddresses = 0;
  let biggest = { slug: "", n: 0 };
  for (const p of published) {
    const t = townAddressesForSlug(p.streetSlug);
    if (!t || t.addresses.length === 0) continue;
    withLadder += 1;
    totalAddresses += t.addresses.length;
    if (t.addresses.length > biggest.n) biggest = { slug: p.streetSlug, n: t.addresses.length };
  }
  console.log(`published street pages     : ${published.length}`);
  console.log(`pages that get a ladder    : ${withLadder}`);
  console.log(`pages with no Town points  : ${published.length - withLadder}`);
  console.log(`addresses across the corpus: ${totalAddresses}`);
  console.log(`largest ladder             : ${biggest.slug} (${biggest.n} addresses)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
