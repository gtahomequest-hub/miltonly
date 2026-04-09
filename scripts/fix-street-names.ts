import { prisma } from "../src/lib/prisma";
import { extractStreetName } from "../src/lib/streetUtils";

async function fixStreetNames() {
  const listings = await prisma.listing.findMany({
    select: { id: true, address: true, streetName: true },
  });

  console.log(`Found ${listings.length} listings to process`);

  let updated = 0;
  let unchanged = 0;

  for (const listing of listings) {
    const cleanName = extractStreetName(listing.address);

    if (cleanName !== listing.streetName) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { streetName: cleanName },
      });
      updated++;
      if (updated <= 20) {
        console.log(`  "${listing.address}" → "${cleanName}" (was: "${listing.streetName}")`);
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${unchanged} unchanged`);

  // Show unique street names
  const distinct = await prisma.listing.findMany({
    distinct: ["streetName"],
    select: { streetName: true },
    where: { streetName: { not: null } },
    orderBy: { streetName: "asc" },
  });
  console.log(`\n${distinct.length} unique street names after cleanup`);

  // Clear dirty StreetQueue entries so backfill can re-queue cleanly
  const deleted = await prisma.streetQueue.deleteMany({});
  console.log(`Cleared ${deleted.count} StreetQueue entries`);

  // Also clear any draft StreetContent that was generated with dirty names
  const draftDeleted = await prisma.streetContent.deleteMany({
    where: { status: "draft", aiGenerated: true },
  });
  console.log(`Cleared ${draftDeleted.count} dirty draft StreetContent entries`);
}

fixStreetNames()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
