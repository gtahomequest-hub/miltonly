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
  const { getStreetStats } = await import('@/lib/streetDecision');

  const slugs = [
    'aird-court-milton',           // failed today — has DB2 history + active leases
    'main-street-milton',          // passed today — has active inventory
    'hincks-drive-milton',         // failed today — let's see what unlocks
    'storey-drive-milton',         // failed today
    'darkwood-road-milton',        // failed today
  ];

  for (const slug of slugs) {
    const result = await getStreetStats(slug);
    console.log('');
    console.log(`=== ${slug} ===`);
    if (result === null) {
      console.log('  GATE BLOCKED — returns null');
    } else {
      console.log(`  GATE PASSED`);
      console.log(`  activeCount:           ${result.activeCount}`);
      console.log(`  totalSold12mo:         ${result.totalSold12mo}`);
      console.log(`  activeLeaseCount:      ${result.activeLeaseCount}`);
      console.log(`  historicalSoldCount:   ${result.historicalSoldCount}`);
      console.log(`  historicalLeasedCount: ${result.historicalLeasedCount}`);
      console.log(`  neighbourhood:         ${result.neighbourhood}`);
    }
  }

  process.exit(0);
})();