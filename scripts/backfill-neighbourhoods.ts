import { PrismaClient as Db1Client } from "@prisma/client";
import { PrismaClient as Db2Client } from "@prisma/client";

const db1 = new Db1Client({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const db2 = new Db2Client({ datasources: { db: { url: process.env.SOLD_DATABASE_URL! } } });

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "=== APPLY MODE - will mutate DB1 ===" : "=== DRY RUN - no writes ===");
  console.log("");

  const drafts = await db1.streetContent.findMany({
    where: { status: "draft", neighbourhood: null },
    select: { streetSlug: true, streetName: true, id: true },
  });
  console.log("Found " + drafts.length + " null-neighbourhood draft streets");
  console.log("");

  let recoverable = 0;
  let unrecoverable = 0;
  let updated = 0;
  const recovered: Array<{slug: string; nb: string; soldCount: number}> = [];
  const unrecoveredSlugs: string[] = [];

  for (const d of drafts) {
    const rows = await db2.$queryRawUnsafe<Array<{ neighbourhood: string; cnt: bigint }>>(
      `SELECT neighbourhood, COUNT(*)::bigint as cnt
       FROM sold.sold_records
       WHERE street_slug = $1 AND neighbourhood IS NOT NULL
       GROUP BY neighbourhood
       ORDER BY cnt DESC
       LIMIT 1`,
      d.streetSlug
    ).catch(() => []);

    if (rows.length > 0 && rows[0].neighbourhood) {
      recoverable++;
      const nb = rows[0].neighbourhood;
      const soldCount = Number(rows[0].cnt);
      recovered.push({ slug: d.streetSlug, nb, soldCount });

      if (APPLY) {
        await db1.streetContent.update({
          where: { id: d.id },
          data: { neighbourhood: nb },
        });
        updated++;
      }
    } else {
      unrecoverable++;
      unrecoveredSlugs.push(d.streetSlug);
    }
  }

  console.log("=== SUMMARY ===");
  console.log("Recoverable from DB2: " + recoverable);
  console.log("Not in DB2 either:    " + unrecoverable);
  if (APPLY) console.log("UPDATED in DB1:       " + updated);
  console.log("");

  if (recovered.length > 0) {
    console.log("=== Recovered (first 20) ===");
    for (const r of recovered.slice(0, 20)) {
      console.log("  " + r.slug + " -> " + r.nb + " (" + r.soldCount + " sold records)");
    }
    if (recovered.length > 20) console.log("  ... and " + (recovered.length - 20) + " more");
  }

  if (unrecoveredSlugs.length > 0) {
    console.log("");
    console.log("=== Unrecoverable (first 20) ===");
    for (const s of unrecoveredSlugs.slice(0, 20)) console.log("  " + s);
    if (unrecoveredSlugs.length > 20) console.log("  ... and " + (unrecoveredSlugs.length - 20) + " more");
  }

  console.log("");
  if (!APPLY) {
    console.log("To apply: npx tsx scripts/backfill-neighbourhoods.ts --apply");
  } else {
    console.log("Done. " + updated + " rows updated.");
  }

  await db1.$disconnect();
  await db2.$disconnect();
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });