// MC-046 Stage 0: street generations carrying the market half (fed VOW aggregates). Counts only.
import { loadEnv } from '../../scripts/verify/lib/env.mjs';
loadEnv();
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const [r] = await db.$queryRawUnsafe(`
  select count(*) n,
    count(*) filter (where exists (select 1 from jsonb_array_elements(g."sectionsJson"::jsonb) s where s->>'id' = 'market')) has_market,
    count(*) filter (where exists (select 1 from jsonb_array_elements(g."sectionsJson"::jsonb) s where s->>'id' = 'neighbourhoodComparable')) has_nbhd_comparable
  from "StreetGeneration" g join "StreetContent" c on c."streetSlug" = g."streetSlug" and c.status = 'published'`);
console.log(Object.entries(r).map(([k, v]) => `${k}=${Number(v)}`).join(' '));
await db.$disconnect();
