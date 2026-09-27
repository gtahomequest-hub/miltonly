// MC-042 evidence: the stored rows for the three streets, read-only.
// MSYS_NO_PATHCONV=1 node scratchpad/mc042/dump-rows.mjs
import { writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from '../../scripts/verify/lib/env.mjs';
loadEnv(); requireEnv('DATABASE_URL');
const app = neon(process.env.DATABASE_URL);
const SLUGS = ['gowland-crescent-milton', 'ennisclare-drive-milton', 'jempson-path-milton'];
for (const s of SLUGS) {
  const [c] = await app`SELECT "streetSlug","streetName",status,template,"needsReview","publishedAt","createdAt","generatedAt","metaTitle","metaDescription",description,"faqJson" FROM public."StreetContent" WHERE "streetSlug"=${s}`;
  const [g] = await app`SELECT "streetSlug",status,"attemptCount","tokensIn","tokensOut","costUsd","totalWords","wordCounts","generatedAt","inputHash","sectionsJson","faqJson","inputJson" FROM public."StreetGeneration" WHERE "streetSlug"=${s}`;
  writeFileSync(`scratchpad/mc042/rows-${s}.json`, JSON.stringify({ streetContent: c, streetGeneration: g }, null, 2));
  console.log(s, '| content', c?.status, 'needsReview', c?.needsReview, 'publishedAt', c?.publishedAt, 'created', c?.createdAt, '| gen', g?.status, 'att', g?.attemptCount, 'cost', g?.costUsd, 'words', g?.totalWords, '| meta', JSON.stringify(c?.metaTitle));
}
