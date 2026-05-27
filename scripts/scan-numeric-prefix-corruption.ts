import { getSoldDb } from '@/lib/db';
import { prisma } from '@/lib/prisma';

// Patterns where a leading numeric IS legitimate.
// Side roads: 3-side-road, 10-side-rd, sideroad-10
// Highways:   hwy-7, hwy-25, etc. (numeric AFTER hwy, not before)
const LEGIT_NUMERIC_PREFIX_PATTERNS = [
  /^\d+(st|nd|rd|th)?-side-(rd|road|sideroad)-milton$/,  // 3-side-rd, 14th-side-road
  /^\d+(st|nd|rd|th)?-sideroad-milton$/,                  // 3-sideroad
  /^\d+-line-milton$/,                                    // numeric line streets (1-line, 4-line)
  /^\d+(st|nd|rd|th)-line-milton$/,                       // 3rd-line, 4th-line
];

function hasLegitNumericPrefix(slug: string): boolean {
  return LEGIT_NUMERIC_PREFIX_PATTERNS.some(p => p.test(slug));
}

(async () => {
  const sd = getSoldDb();
  if (!sd) { console.log('SOLD_DATABASE_URL not set'); process.exit(1); }

  console.log('=== DB2 NUMERIC-PREFIX CORRUPTION SCAN ===');
  console.log('Detecting slugs starting with a number where that number is NOT');
  console.log('a legitimate side-road or numbered-line identifier.');
  console.log('');

  // DB2 side: pull all slugs starting with a digit
  const db2Rows = await (sd`
    SELECT street_slug, COUNT(*)::int AS cnt
      FROM sold.sold_records
     WHERE street_slug ~ '^[0-9]'
     GROUP BY street_slug
     ORDER BY cnt DESC, street_slug
  ` as unknown as Promise<Array<{ street_slug: string; cnt: number }>>);

  console.log(`DB2: ${db2Rows.length} distinct slugs start with a digit`);
  console.log('');

  const db2Legit: typeof db2Rows = [];
  const db2Corrupt: typeof db2Rows = [];
  for (const r of db2Rows) {
    if (hasLegitNumericPrefix(r.street_slug)) db2Legit.push(r);
    else db2Corrupt.push(r);
  }

  console.log(`  Legitimate (side roads / numbered lines):  ${db2Legit.length} distinct slugs (${db2Legit.reduce((s, r) => s + r.cnt, 0)} rows)`);
  console.log(`  Corrupt (unit/house number in slug):       ${db2Corrupt.length} distinct slugs (${db2Corrupt.reduce((s, r) => s + r.cnt, 0)} rows)`);
  console.log('');

  if (db2Legit.length > 0) {
    console.log('=== DB2 LEGITIMATE (sample) ===');
    db2Legit.slice(0, 10).forEach(r => {
      console.log(`  ${r.street_slug.padEnd(45)} | ${r.cnt} rows`);
    });
    console.log('');
  }

  if (db2Corrupt.length > 0) {
    console.log('=== DB2 CORRUPT ===');
    db2Corrupt.forEach(r => {
      console.log(`  ${r.street_slug.padEnd(45)} | ${r.cnt} rows`);
    });
    console.log('');
  }

  // DB1 side: check StreetContent table for the same pattern
  const sc = await prisma.streetContent.findMany({
    where: { streetSlug: { startsWith: '' } },
    select: { streetSlug: true, streetName: true, status: true }
  });

  const db1NumericSlugs = sc.filter(s => /^\d/.test(s.streetSlug));
  const db1Legit = db1NumericSlugs.filter(s => hasLegitNumericPrefix(s.streetSlug));
  const db1Corrupt = db1NumericSlugs.filter(s => !hasLegitNumericPrefix(s.streetSlug));

  console.log(`DB1 StreetContent: ${db1NumericSlugs.length} rows start with a digit`);
  console.log(`  Legitimate:  ${db1Legit.length}`);
  console.log(`  Corrupt:     ${db1Corrupt.length}`);
  console.log('');

  if (db1Corrupt.length > 0) {
    console.log('=== DB1 StreetContent CORRUPT ===');
    db1Corrupt.forEach(s => {
      console.log(`  slug=${s.streetSlug.padEnd(45)} name="${s.streetName}" status=${s.status}`);
    });
    console.log('');
  }

  // DB1 Listing table — house numbers in slugs would mean ingest bug at PropTx layer
  const listings = await prisma.listing.findMany({
    where: { streetSlug: { startsWith: '' } },
    select: { streetSlug: true, address: true, mlsNumber: true },
    take: 1000
  });
  const db1ListingNumeric = listings.filter(l => /^\d/.test(l.streetSlug));
  const db1ListingCorrupt = db1ListingNumeric.filter(l => !hasLegitNumericPrefix(l.streetSlug));

  console.log(`DB1 Listing (sample of 1000): ${db1ListingNumeric.length} rows start with a digit, ${db1ListingCorrupt.length} corrupt`);
  if (db1ListingCorrupt.length > 0) {
    console.log('  Sample corrupt listings:');
    db1ListingCorrupt.slice(0, 10).forEach(l => {
      console.log(`    slug=${l.streetSlug} address="${l.address}" mls=${l.mlsNumber}`);
    });
  }

  console.log('');
  console.log('=== DECISION GATE ===');
  console.log(`If DB2 corruption is small (<10 slugs), Path A is fine — fix manually after.`);
  console.log(`If DB2 corruption is large (>50), the migration should be expanded to strip`);
  console.log(`numeric prefixes for non-side-road/non-line slugs (Path B).`);

  await prisma.$disconnect();
})();
