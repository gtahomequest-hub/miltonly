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

  const tables = await (ad`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'analytics'
     ORDER BY table_name
  ` as unknown as Promise<Array<{ table_name: string }>>);
  console.log('Tables in analytics schema:');
  console.table(tables);
})();