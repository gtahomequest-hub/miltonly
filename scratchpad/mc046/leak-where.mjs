// Debug for the leak test: WHERE a matched token sits, with every digit masked (no value printed).
import { get } from '../../scripts/verify/lib/http.mjs';
import { loadEnv } from '../../scripts/verify/lib/env.mjs';
import { neon } from '@neondatabase/serverless';
import { shortCAD, roundForDisplay } from '../../scripts/verify/lib/money.mjs';
loadEnv();
const BASE = process.env.BASE || 'http://localhost:3100';
const path = process.argv[2] || '/about';
const sold = neon(process.env.SOLD_DATABASE_URL);
const full = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const roundTo = (n, s) => Math.round(n / s) * s;
const toks = new Set();
const W12 = `sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`;
for (const r of await sold.query(`SELECT neighbourhood n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, AVG(sold_price) mean FROM sold.sold_records WHERE perm_advertise AND transaction_type='For Sale' AND ${W12} GROUP BY 1`))
  for (const v of [Number(r.med), Number(r.mean)]) for (const s of [1, 1000, 5000, 10000, 25000]) { toks.add(shortCAD(roundTo(v, s))); toks.add(full(roundTo(v, s))); toks.add(shortCAD(roundForDisplay(v))); }
const r = await get(`${BASE}${path}`);
const html = r.body.replace(/<script[\s\S]*?<\/script>/g, ' ');
const seen = new Map();
for (const t of toks) {
  let i = html.indexOf(t);
  while (i !== -1) {
    const ctx = html.slice(Math.max(0, i - 160), i + t.length + 40).replace(/\d/g, '#').replace(/\s+/g, ' ');
    seen.set(ctx, (seen.get(ctx) || 0) + 1);
    i = html.indexOf(t, i + 1);
  }
}
console.log(`${path}: ${[...seen.values()].reduce((a, b) => a + b, 0)} hits`);
for (const [c, n] of [...seen].slice(0, 8)) console.log(`  x${n} …${c}…`);
