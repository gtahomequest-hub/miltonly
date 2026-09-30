import { loadEnv } from '../../scripts/verify/lib/env.mjs';
loadEnv();
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const rows = await db.$queryRawUnsafe(`select (select max("generatedAt")::text from "StreetContent") sc, (select max("updatedAt")::text from "StreetContent") scu, (select "generatedAt"::text from "StreetGeneration" where "streetSlug" = $$baverstock-crescent-milton$$) t`);
console.log(JSON.stringify(rows[0]));
await db.$disconnect();
