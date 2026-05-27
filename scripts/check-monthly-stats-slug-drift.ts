import { getAnalyticsDb } from '@/lib/db';
import { readFileSync } from 'node:fs';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync('.env.local', 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\\n$/, '');
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

(async () => {
  const ad = getAnalyticsDb();
  if (!ad) { console.log('ANALYTICS_DATABASE_URL not set'); return; }

  // Both forms of logan
  const logan = await (ad`
    SELECT street_slug, COUNT(*)::int AS cnt
      FROM analytics.street_monthly_stats
     WHERE street_slug LIKE '%logan%'
     GROUP BY street_slug
     ORDER BY cnt DESC
  ` as unknown as Promise<Array<{ street_slug: string; cnt: number }>>);
  console.log('logan rows in street_monthly_stats:');
  console.log(logan);

  // Sample of all street_monthly_stats slugs to see if abbreviated forms persist
  const abbreviated = await (ad`
    SELECT street_slug, COUNT(*)::int AS cnt
      FROM analytics.street_monthly_stats
     WHERE street_slug ~ '-(crt|blvd|cres|dr|rd|st|ave|ln|terr|trl|pl|cir|hts)-milton$'
     GROUP BY street_slug
     ORDER BY cnt DESC
     LIMIT 20
  ` as unknown as Promise<Array<{ street_slug: string; cnt: number }>>);
  console.log('');
  console.log(`Abbreviated slugs still in street_monthly_stats: ${abbreviated.length}`);
  abbreviated.forEach(r => console.log(`  ${r.street_slug.padEnd(40)} | ${r.cnt} rows`));

  // Total row count + distinct slug count
  const stats = await (ad`
    SELECT COUNT(*)::int AS total_rows, COUNT(DISTINCT street_slug)::int AS distinct_slugs
      FROM analytics.street_monthly_stats
  ` as unknown as Promise<Array<{ total_rows: number; distinct_slugs: number }>>);
  console.log('');
  console.log('Table totals:');
  console.log(stats);
})();