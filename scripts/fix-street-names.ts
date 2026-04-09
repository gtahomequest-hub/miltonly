import { prisma } from "../src/lib/prisma";
import { extractStreetName } from "../src/lib/streetUtils";

async function fixStreetNames() {
  // Always re-extract from the raw address field — never from streetName
  const listings = await prisma.listing.findMany({
    select: { id: true, address: true, streetName: true },
  });

  console.log(`Processing ${listings.length} listings from raw address field`);

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
      if (updated <= 30) {
        console.log(`  "${listing.address}" → "${cleanName}" (was: "${listing.streetName}")`);
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n${updated} updated, ${unchanged} unchanged`);

  // Show final unique street names
  const distinct = await prisma.listing.findMany({
    distinct: ["streetName"],
    select: { streetName: true },
    where: { streetName: { not: null } },
    orderBy: { streetName: "asc" },
  });
  console.log(`${distinct.length} unique street names`);

  // Clear StreetQueue so backfill starts fresh
  const qDeleted = await prisma.streetQueue.deleteMany({});
  console.log(`Cleared ${qDeleted.count} StreetQueue entries`);

  // Clear draft StreetContent (keep published)
  const cDeleted = await prisma.streetContent.deleteMany({
    where: { status: "draft" },
  });
  console.log(`Cleared ${cDeleted.count} draft StreetContent entries`);
}

fixStreetNames()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
