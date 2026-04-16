import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);

  // 1) StreetQueue — what the nightly detect cron has picked up
  const queueTotal = await prisma.streetQueue.count();
  const queueByStatus = await prisma.streetQueue.groupBy({
    by: ["status"],
    _count: true,
  });
  const recent7 = await prisma.streetQueue.findMany({
    where: { createdAt: { gte: d7 } },
    orderBy: { createdAt: "desc" },
    select: { streetName: true, streetSlug: true, status: true, createdAt: true, attempts: true, lastError: true },
  });

  // 2) StreetContent — published vs draft
  const contentTotals = await prisma.streetContent.groupBy({
    by: ["status"],
    _count: true,
  });
  const publishedCount = await prisma.streetContent.count({ where: { status: "published" } });

  // 3) Listings with streetSlugs that aren't in StreetContent or StreetQueue yet (truly orphan)
  const orphans = await prisma.$queryRaw<{ streetName: string; streetSlug: string; listingCount: bigint }[]>`
    SELECT "streetName", "streetSlug", COUNT(*)::bigint AS "listingCount"
    FROM "Listing"
    WHERE "streetName" IS NOT NULL
      AND "streetSlug" IS NOT NULL
      AND "streetSlug" NOT IN (SELECT "streetSlug" FROM "StreetContent")
      AND "streetSlug" NOT IN (SELECT "streetSlug" FROM "StreetQueue")
    GROUP BY "streetName", "streetSlug"
    ORDER BY "listingCount" DESC, "streetName"
    LIMIT 30
  `;

  // 4) New listings (added in last 7 days) — used to see what's flowing in
  const newListings = await prisma.listing.count({ where: { createdAt: { gte: d7 } } });
  const newListings30 = await prisma.listing.count({ where: { createdAt: { gte: d30 } } });

  // 5) Published streets added in last 7 days
  const recentPublished = await prisma.streetContent.findMany({
    where: { status: "published", publishedAt: { gte: d7 } },
    orderBy: { publishedAt: "desc" },
    select: { streetName: true, streetSlug: true, publishedAt: true },
  });

  // 6) StreetQueue with errors
  const errored = await prisma.streetQueue.findMany({
    where: { status: "failed" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { streetName: true, attempts: true, lastError: true, updatedAt: true },
  });

  console.log("\n═══ MILTON STREET INTELLIGENCE REPORT ═══");
  console.log(`Generated: ${now.toISOString()}\n`);

  console.log("── LISTING FLOW ──");
  console.log(`New listings (last 7 days):  ${newListings}`);
  console.log(`New listings (last 30 days): ${newListings30}\n`);

  console.log("── STREET QUEUE ──");
  console.log(`Total queue entries: ${queueTotal}`);
  console.log("By status:");
  queueByStatus.forEach((g) => console.log(`  ${g.status.padEnd(12)} ${g._count}`));
  console.log(`\nAdded in last 7 days (${recent7.length}):`);
  if (recent7.length === 0) console.log("  (none — detect cron may be idle)");
  else recent7.forEach((s) => {
    const age = Math.floor((now.getTime() - s.createdAt.getTime()) / 86400000);
    console.log(`  [${s.status}] ${s.streetName} — ${age}d old${s.attempts > 0 ? ` · ${s.attempts} attempts` : ""}`);
  });

  console.log("\n── STREET CONTENT ──");
  contentTotals.forEach((g) => console.log(`  ${g.status.padEnd(12)} ${g._count}`));
  console.log(`Total published pages: ${publishedCount}`);
  console.log(`\nPublished in last 7 days (${recentPublished.length}):`);
  if (recentPublished.length === 0) console.log("  (none)");
  else recentPublished.forEach((s) => console.log(`  ${s.streetName} · https://miltonly.com/streets/${s.streetSlug}`));

  console.log("\n── ORPHAN STREETS (in Listing but not in Content or Queue) ──");
  if (orphans.length === 0) console.log("  ✓ none — every active street is tracked");
  else {
    console.log(`Top ${orphans.length} orphans by listing count:`);
    orphans.forEach((s) => console.log(`  ${s.streetName.padEnd(45)} ${Number(s.listingCount)} listings`));
  }

  if (errored.length > 0) {
    console.log("\n── STREETS WITH GENERATION ERRORS ──");
    errored.forEach((s) => console.log(`  ${s.streetName} (${s.attempts} tries) — ${s.lastError?.slice(0, 80) || "no error msg"}`));
  }

  console.log("\n═══ END OF REPORT ═══\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
