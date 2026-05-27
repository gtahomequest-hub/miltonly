import { prisma } from '@/lib/prisma';
import { getSoldDb } from '@/lib/db';

const SLUG = 'aird-court-milton';

(async () => {
  // 1. DB1 — listings (any status)
  const listings = await prisma.listing.findMany({
    where: { streetSlug: SLUG },
    select: { mlsNumber: true, status: true, address: true, price: true, soldPrice: true, soldDate: true, neighbourhood: true }
  });
  console.log(`DB1 listings for ${SLUG}: ${listings.length}`);
  listings.slice(0, 5).forEach(l => {
    console.log(`  ${l.address} | MLS ${l.mlsNumber} | ${l.status} | nb=${l.neighbourhood} | price=$${l.price} | sold=${l.soldPrice ? '$' + l.soldPrice + ' on ' + l.soldDate?.toISOString().slice(0,10) : 'no'}`);
  });

  // 2. DB1 — StreetContent row state
  const sc = await prisma.streetContent.findUnique({
    where: { streetSlug: SLUG },
    select: { status: true, neighbourhood: true, streetName: true, attempts: true, createdAt: true }
  });
  console.log('');
  console.log('DB1 StreetContent row:');
  console.log(sc);

  // 3. DB2 — exact slug match
  const sd = getSoldDb();
  if (!sd) { console.log('SOLD_DATABASE_URL not set'); await prisma.$disconnect(); return; }

  const exactMatch = await (sd`
    SELECT street_slug, neighbourhood, COUNT(*)::int AS cnt
      FROM sold.sold_records
     WHERE street_slug = ${SLUG}
     GROUP BY street_slug, neighbourhood
  ` as unknown as Promise<Array<{ street_slug: string; neighbourhood: string; cnt: number }>>);
  console.log('');
  console.log(`DB2 exact slug match for ${SLUG}:`);
  console.log(exactMatch);

  // 4. DB2 — fuzzy match
  const fuzzy = await (sd`
    SELECT street_slug, neighbourhood, COUNT(*)::int AS cnt
      FROM sold.sold_records
     WHERE street_slug LIKE '%aird%'
     GROUP BY street_slug, neighbourhood
     ORDER BY cnt DESC
     LIMIT 10
  ` as unknown as Promise<Array<{ street_slug: string; neighbourhood: string; cnt: number }>>);
  console.log('');
  console.log('DB2 fuzzy match LIKE %aird%:');
  console.log(fuzzy);

  await prisma.$disconnect();
})();
