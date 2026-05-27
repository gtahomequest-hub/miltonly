import { prisma } from '@/lib/prisma';
import { getSoldDb } from '@/lib/db';
import { deriveIdentity } from '@/lib/streetUtils';

(async () => {
  const sd = getSoldDb();
  if (!sd) { console.log('SOLD_DATABASE_URL not set'); process.exit(1); }

  console.log('=== DB2 SLUG CANONICALIZATION DRY-RUN ===');
  console.log('Read-only. Reports what WOULD change if migration were applied.');
  console.log('');

  // Pull every distinct slug + its row count from sold_records
  const rows = await (sd`
    SELECT street_slug, COUNT(*)::int AS cnt
      FROM sold.sold_records
     GROUP BY street_slug
     ORDER BY street_slug
  ` as unknown as Promise<Array<{ street_slug: string; cnt: number }>>);

  console.log(`Total distinct slugs in DB2: ${rows.length}`);
  const totalRows = rows.reduce((sum, r) => sum + r.cnt, 0);
  console.log(`Total rows in sold_records:   ${totalRows}`);
  console.log('');

  let unchanged = 0;
  let changed = 0;
  let unparseable = 0;
  const changedRows = { count: 0 };
  const unchangedRows = { count: 0 };
  const unparseableRows = { count: 0 };
  const changesByPattern: Record<string, number> = {};
  const changes: Array<{ from: string; to: string; cnt: number; pattern: string }> = [];
  const unparseableSlugs: Array<{ slug: string; cnt: number }> = [];

  for (const row of rows) {
    const identity = deriveIdentity(row.street_slug);
    if (!identity) {
      unparseable++;
      unparseableRows.count += row.cnt;
      unparseableSlugs.push({ slug: row.street_slug, cnt: row.cnt });
      continue;
    }
    if (identity.canonicalSlug === row.street_slug) {
      unchanged++;
      unchangedRows.count += row.cnt;
    } else {
      changed++;
      changedRows.count += row.cnt;
      // Categorize the change pattern
      const fromParts = row.street_slug.split('-');
      const toParts = identity.canonicalSlug.split('-');
      let pattern = 'other';
      if (fromParts.length === toParts.length) {
        // Find the changed token
        for (let i = 0; i < fromParts.length; i++) {
          if (fromParts[i] !== toParts[i]) {
            pattern = `${fromParts[i]} -> ${toParts[i]}`;
            break;
          }
        }
      } else if (fromParts.length > toParts.length) {
        pattern = 'directional_collapse';
      } else {
        pattern = 'token_added';
      }
      changesByPattern[pattern] = (changesByPattern[pattern] || 0) + 1;
      changes.push({ from: row.street_slug, to: identity.canonicalSlug, cnt: row.cnt, pattern });
    }
  }

  console.log('=== SUMMARY ===');
  console.log(`Unchanged slugs:      ${unchanged.toString().padStart(5)} (${unchangedRows.count} rows)`);
  console.log(`Changed slugs:        ${changed.toString().padStart(5)} (${changedRows.count} rows)`);
  console.log(`Unparseable slugs:    ${unparseable.toString().padStart(5)} (${unparseableRows.count} rows)`);
  console.log('');

  console.log('=== CHANGES BY PATTERN ===');
  const sortedPatterns = Object.entries(changesByPattern).sort((a, b) => b[1] - a[1]);
  for (const [pattern, count] of sortedPatterns) {
    console.log(`  ${pattern.padEnd(35)} ${count} distinct slugs`);
  }
  console.log('');

  console.log('=== FIRST 30 CHANGES ===');
  changes.slice(0, 30).forEach(c => {
    console.log(`  ${c.from.padEnd(40)} -> ${c.to.padEnd(40)} | ${c.cnt} rows`);
  });

  if (unparseableSlugs.length > 0) {
    console.log('');
    console.log('=== UNPARSEABLE SLUGS (first 20) ===');
    console.log('(deriveIdentity returned null — these will be SKIPPED by migration)');
    unparseableSlugs.slice(0, 20).forEach(u => {
      console.log(`  ${u.slug.padEnd(40)} | ${u.cnt} rows`);
    });
    if (unparseableSlugs.length > 20) {
      console.log(`  ... and ${unparseableSlugs.length - 20} more`);
    }
  }

  console.log('');
  console.log('=== DECISION GATE ===');
  console.log(`If you proceed with the migration, ${changedRows.count} rows in sold_records will be updated.`);
  console.log(`${unparseableRows.count} rows will be left untouched (deriveIdentity could not canonicalize them).`);
  console.log('');
  console.log('This is a dry run. No data was modified.');

  await prisma.$disconnect();
})();
