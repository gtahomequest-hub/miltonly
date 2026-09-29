// ML-013 / ML-014: the test address's rate-limit keys in Upstash. `node ratelimit-keys.mjs` lists them;
// `--apply` deletes ONLY keys that name the test inbox (gtahomequest@gmail.com, the collapsed key) so a run
// of more than six email forms in a day is not refused by the test itself. `--ip=<addr>` also lists, and
// with `--apply` deletes, the keys naming that IP: the desk's own connection, whose tokens are its own test
// submissions. Never a key naming anyone else. Reads the production env pulled to .env.vercel-prod.
import fs from 'node:fs';
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/); if (m && !process.env[m[1]]) { let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } }
const { Redis } = await import('@upstash/redis');
const redis = new Redis({ url: process.env.UPSTASH_REDIS_KV_REST_API_URL, token: process.env.UPSTASH_REDIS_KV_REST_API_TOKEN });
const APPLY = process.argv.includes('--apply');
const IPARG = process.argv.find((a) => a.startsWith('--ip='));
const IP = IPARG ? IPARG.slice(5) : null;
let cursor = 0; const keys = [];
do { const [next, batch] = await redis.scan(cursor, { match: 'lead:*', count: 500 }); cursor = Number(next); keys.push(...batch); } while (cursor !== 0);
const mine = keys.filter((k) => /gtahomequest@gmail\.com/.test(k) || (IP && k.includes(IP)));
const ips = keys.filter((k) => /^lead:ip/.test(k));
console.log(`lead:* keys: ${keys.length}; ip keys: ${ips.length}; keys naming the test inbox${IP ? ' or ' + IP : ''}: ${mine.length}`);
for (const k of mine) console.log('  ', k, await redis.get(k).catch(() => '?'));
if (APPLY && mine.length) { const n = await redis.del(...mine); console.log(`deleted ${n} keys`); }
