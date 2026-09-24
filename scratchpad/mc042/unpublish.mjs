// MC-042: take the three pages back to draft after the fabrication review, then purge.
//
//   MSYS_NO_PATHCONV=1 node scratchpad/mc042/unpublish.mjs --dry
//   MSYS_NO_PATHCONV=1 node scratchpad/mc042/unpublish.mjs
//
// The 058 convention verbatim (scripts/audit-058-unpublish.ts): status "draft", publishedAt null,
// needsReview true, a reviewNotes line saying why, then purge each street page, /streets and the
// hub. needsReview true is what makes the page render its placeholder (loadStreetGeneration
// returns null) and keeps it off the sitemap; the StreetGeneration rows are left as they are, so
// the generated prose stays on record for review.
//
// TO REPUBLISH (reverses this exactly, then purge the same seven paths):
//   UPDATE "StreetContent" SET status='published', "needsReview"=false, "publishedAt"=NOW(),
//     "reviewNotes"=NULL WHERE "streetSlug" IN (<the three>);
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from '../../scripts/verify/lib/env.mjs';

const SLUGS = ['gowland-crescent-milton', 'ennisclare-drive-milton', 'jempson-path-milton'];
const HUBS = ['/neighbourhoods/timberlea', '/neighbourhoods/nassagaweya', '/neighbourhoods/harrison'];
const NOTE = 'MC-042 fabrication review 2026-09-23: invented detail served (scratchpad/mc042/fabrication-review.md)';
const BASE = process.env.BASE || 'https://miltonly.com';
const DRY = process.argv.includes('--dry');

loadEnv();
requireEnv('DATABASE_URL', 'REVALIDATION_SECRET');
const app = neon(process.env.DATABASE_URL);
const show = async (label) => {
  for (const r of await app`SELECT "streetSlug" s, status, "needsReview" nr, to_char("publishedAt",'YYYY-MM-DD HH24:MI') p, "reviewNotes" n FROM public."StreetContent" WHERE "streetSlug" = ANY(${SLUGS}::text[]) ORDER BY 1`)
    console.log(`${label}  ${r.s.padEnd(26)} ${r.status} needsReview=${r.nr} publishedAt=${r.p ?? 'null'}${r.n ? ` note="${r.n}"` : ''}`);
};

await show('before');
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }

const upd = await app`UPDATE public."StreetContent"
  SET status = 'draft', "publishedAt" = NULL, "needsReview" = true, "reviewNotes" = ${NOTE}, "updatedAt" = NOW()
  WHERE "streetSlug" = ANY(${SLUGS}::text[]) AND status = 'published'
  RETURNING "streetSlug"`;
console.log(`\nrows updated: ${upd.length}`);

for (const path of [...SLUGS.map((s) => `/streets/${s}`), '/streets', ...HUBS]) {
  const res = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(process.env.REVALIDATION_SECRET)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }),
  });
  console.log(`revalidate ${res.status} ${path}`);
}
console.log('');
await show('after ');
