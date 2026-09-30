// MC-046 R18: on deploy, no cache an anonymous render could read may hold a VOW-derived value.
//
//   node scripts/vow-cache-purge.mjs --check                 count the keys under every VOW prefix
//   BASE=https://miltonly.com node scripts/vow-cache-purge.mjs --apply
//        delete them, drop the db2 and db3 Data Cache tags, and revalidate every street's card
//        and og.png path on BASE (the CDN copies of the figure the card used to carry)
//
// Prints counts only. Upstash is shared by production and every preview, so --apply belongs to
// the production deploy of Stage 1 (run it right after the deploy is Ready): run earlier, the old
// production code would simply write the keys again.
import { loadEnv, requireEnv } from './verify/lib/env.mjs';
import { publishedStreetSlugs } from './verify/lib/http.mjs';

loadEnv();
const APPLY = process.argv.includes('--apply');

// Every Upstash key family that held a VOW-derived value read by an anonymous render (Stage 0 §1),
// plus the gated record lists, which Stage 1 no longer caches at all.
export const VOW_KEY_PATTERNS = [
  'street-sale-stats:*', 'street-lease-stats:*', 'street-monthly-sales:*',
  'nbhd-sale-stats:*', 'nbhd-lease-stats:*',
  'sold-list:*', 'milton-sold-totals', 'milton-sold-nbhds',
  'sold-agg:*', 'home:sold-mtd:*', 'home:lease-market:*',
  'street-aggregate:*', 'neighbourhood-aggregate:*',
  'rentals:*:v4',
];

async function redis(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_KV_REST_API_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UPSTASH_REDIS_KV_REST_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(`upstash: ${j.error}`);
  return j.result;
}

async function keys(pattern) {
  const out = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '1000']);
    out.push(...batch);
    cursor = String(next);
  } while (cursor !== '0');
  return out;
}

requireEnv('UPSTASH_REDIS_KV_REST_API_URL', 'UPSTASH_REDIS_KV_REST_API_TOKEN');
let total = 0;
for (const p of VOW_KEY_PATTERNS) {
  const ks = await keys(p);
  total += ks.length;
  if (APPLY) for (let i = 0; i < ks.length; i += 100) await redis(['DEL', ...ks.slice(i, i + 100)]);
  console.log(`${APPLY ? 'deleted' : 'found  '} ${String(ks.length).padStart(5)}  ${p}`);
}
console.log(`upstash: ${total} VOW-derived keys ${APPLY ? 'deleted' : 'present'}`);

if (APPLY) {
  const BASE = process.env.BASE;
  requireEnv('REVALIDATION_SECRET');
  if (!BASE) throw new Error('BASE is required with --apply');
  const post = (body) => fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(process.env.REVALIDATION_SECRET)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.status);
  for (const tag of ['db2', 'db3']) console.log(`revalidateTag ${tag}: ${await post({ tag })}`);
  const slugs = await publishedStreetSlugs(BASE);
  const st = {};
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < slugs.length) {
      const s = slugs[i++];
      for (const path of [`/api/streets/${s}/card`, `/streets/${s}/og.png`]) {
        const code = await post({ path });
        st[code] = (st[code] || 0) + 1;
      }
    }
  }));
  console.log(`revalidatePath card + og.png for ${slugs.length} streets: ${JSON.stringify(st)}`);
}
