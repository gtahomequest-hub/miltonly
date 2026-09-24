// MC-045: read-only. Each published street's generation dates, and the validity check that no
// published row changed after the crawled build (5f8cdb0, built 2026-09-24T16:15Z).
//   node scratchpad/mc045/method/db-dates.mjs <workDir>
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from '../../../scripts/verify/lib/env.mjs';

const [workDir] = process.argv.slice(2);
loadEnv();
requireEnv('DATABASE_URL');
const app = neon(process.env.DATABASE_URL);
const rows = await app`SELECT c."streetSlug" s, c.status, c."needsReview" nr, c.template,
  to_char(c."generatedAt",'YYYY-MM-DD"T"HH24:MI:SS"Z"') cgen, to_char(c."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS"Z"') cupd,
  to_char(c."publishedAt",'YYYY-MM-DD"T"HH24:MI:SS"Z"') cpub,
  g.status gstatus, to_char(g."generatedAt",'YYYY-MM-DD"T"HH24:MI:SS"Z"') ggen
  FROM public."StreetContent" c LEFT JOIN public."StreetGeneration" g ON g."streetSlug" = c."streetSlug"
  WHERE c.status = 'published'`;
const out = Object.fromEntries(rows.map((r) => [r.s, r]));
const changedAfterBuild = rows.filter((r) => r.cupd > '2026-09-24T16:15:00Z').map((r) => r.s);
fs.writeFileSync(path.join(workDir, 'db-dates.json'), JSON.stringify(out));
console.log(JSON.stringify({ published: rows.length, changedAfterBuild, latestGeneratedAt: rows.map((r) => r.cgen).sort().pop() }));
