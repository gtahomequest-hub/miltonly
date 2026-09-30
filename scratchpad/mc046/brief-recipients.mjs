// MC-046 R17: how many addresses the paused brief was mailing. COUNTS ONLY.
import { loadEnv } from '../../scripts/verify/lib/env.mjs';
loadEnv();
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const [a] = await db.$queryRawUnsafe(`select count(*) all_brief,
  count(*) filter (where "alertEnabled") enabled,
  count(distinct lower(trim(email))) filter (where "alertEnabled" and env = 'production') prod_addresses,
  count(*) filter (where "alertEnabled" and "lastAlertAt" is not null) ever_sent
  from "SavedSearch" where kind = 'brief'`);
console.log(Object.entries(a).map(([k, v]) => `${k}=${Number(v)}`).join(' '));
await db.$disconnect();
