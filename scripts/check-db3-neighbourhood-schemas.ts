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

  // neighbourhood_sold_stats
  const c1 = await (ad`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='analytics' AND table_name='neighbourhood_sold_stats'
     ORDER BY ordinal_position
  ` as unknown as Promise<Array<{column_name: string; data_type: string}>>);
  console.log('=== neighbourhood_sold_stats ===');
  console.table(c1);
  const r1 = await (ad`SELECT * FROM analytics.neighbourhood_sold_stats LIMIT 1` as unknown as Promise<Array<Record<string, unknown>>>);
  console.log('Sample:', r1[0] ?? '(no rows)');

  // neighbourhood_monthly_stats
  const c2 = await (ad`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='analytics' AND table_name='neighbourhood_monthly_stats'
     ORDER BY ordinal_position
  ` as unknown as Promise<Array<{column_name: string; data_type: string}>>);
  console.log('');
  console.log('=== neighbourhood_monthly_stats ===');
  console.table(c2);
  const r2 = await (ad`SELECT * FROM analytics.neighbourhood_monthly_stats LIMIT 1` as unknown as Promise<Array<Record<string, unknown>>>);
  console.log('Sample:', r2[0] ?? '(no rows)');

  // street_monthly_stats
  const c3 = await (ad`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='analytics' AND table_name='street_monthly_stats'
     ORDER BY ordinal_position
  ` as unknown as Promise<Array<{column_name: string; data_type: string}>>);
  console.log('');
  console.log('=== street_monthly_stats ===');
  console.table(c3);
  const r3 = await (ad`SELECT * FROM analytics.street_monthly_stats LIMIT 1` as unknown as Promise<Array<Record<string, unknown>>>);
  console.log('Sample:', r3[0] ?? '(no rows)');
})();