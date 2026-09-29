// ML-013: my own test address's rate-limit keys in Upstash. `node ratelimit-keys.mjs` lists them; `--apply` deletes
// ONLY keys that name the test inbox (gtahomequest@gmail.com, the collapsed key) so a run of more than six email
// forms in a day is not refused by the test itself. Nothing else is touched.
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ''); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { Redis } = await import('@upstash/redis');
const redis = new Redis({ url: process.env.UPSTASH_REDIS_KV_REST_API_URL, token: process.env.UPSTASH_REDIS_KV_REST_API_TOKEN });
const APPLY = process.argv.includes('--apply');
let cursor = 0; const keys = [];
do { const [next, batch] = await redis.scan(cursor, { match: 'lead:*', count: 500 }); cursor = Number(next); keys.push(...batch); } while (cursor !== 0);
const mine = keys.filter((k) => /gtahomequest@gmail\.com/.test(k));
const ips = keys.filter((k) => /^lead:ip/.test(k));
console.log(`lead:* keys: ${keys.length}; ip keys: ${ips.length}; keys naming the test inbox: ${mine.length}`);
for (const k of mine) console.log('  ', k, await redis.get(k).catch(() => '?'));
if (APPLY && mine.length) { const n = await redis.del(...mine); console.log(`deleted ${n} test-inbox keys`); }
