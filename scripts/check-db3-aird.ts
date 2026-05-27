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

  // First, get the actual column list
  const cols = await (ad`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_schema = 'analytics' AND table_name = 'street_sold_stats'
     ORDER BY ordinal_position
  ` as unknown as Promise<Array<{ column_name: string; data_type: string }>>);
  console.log('Columns in analytics.street_sold_stats:');
  console.table(cols);

  // Then SELECT * for our test row
  const rows = await (ad`
    SELECT * FROM analytics.street_sold_stats
     WHERE street_slug = 'aird-court-milton'
  ` as unknown as Promise<Array<Record<string, unknown>>>);
  console.log('');
  console.log('Row for aird-court-milton:');
  console.log(rows);

  const count = await (ad`
    SELECT COUNT(*)::int AS cnt FROM analytics.street_sold_stats
  ` as unknown as Promise<Array<{ cnt: number }>>);
  console.log('');
  console.log(`Total rows: ${count[0].cnt}`);
})();