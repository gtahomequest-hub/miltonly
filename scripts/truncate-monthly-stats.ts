import { Client } from 'pg';
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

const APPLY = process.argv.includes('--apply');

async function main() {
  const connStr = process.env.ANALYTICS_DATABASE_URL;
  if (!connStr) { console.log('ANALYTICS_DATABASE_URL not set'); process.exit(1); }

  console.log(APPLY ? '=== APPLY MODE — will truncate monthly stats tables ===' : '=== DRY RUN ===');

  const client = new Client({ connectionString: connStr });
  await client.connect();

  try {
    const before1 = await client.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM analytics.street_monthly_stats');
    const before2 = await client.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM analytics.neighbourhood_monthly_stats');
    console.log(`street_monthly_stats:        ${before1.rows[0].cnt} rows`);
    console.log(`neighbourhood_monthly_stats: ${before2.rows[0].cnt} rows`);

    if (!APPLY) {
      console.log('');
      console.log('Re-run with --apply to TRUNCATE both tables.');
      console.log('Data will be repopulated by next compute-sold-stats run.');
      return;
    }

    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE analytics.street_monthly_stats');
    await client.query('TRUNCATE TABLE analytics.neighbourhood_monthly_stats');
    await client.query('COMMIT');

    const after1 = await client.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM analytics.street_monthly_stats');
    const after2 = await client.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM analytics.neighbourhood_monthly_stats');
    console.log('');
    console.log(`After truncate:`);
    console.log(`street_monthly_stats:        ${after1.rows[0].cnt} rows`);
    console.log(`neighbourhood_monthly_stats: ${after2.rows[0].cnt} rows`);
    console.log('');
    console.log('Done. Now trigger compute-sold-stats to repopulate.');
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });