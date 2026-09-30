// MC-046 addition 3: MC-049's paused-rewrite check. Timestamps and counts only.
import { loadEnv } from '../../scripts/verify/lib/env.mjs';
loadEnv();
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const [r] = await db.$queryRawUnsafe(`select max("generatedAt") mx, count(*) filter (where "generatedAt" > '2026-09-29T12:00:00Z') after_0929_12z, count(*) n from "StreetGeneration"`);
console.log(`read_at=${new Date().toISOString()} max_generatedAt=${r.mx.toISOString()} rows_after_2026-09-29T12:00Z=${Number(r.after_0929_12z)} rows=${Number(r.n)} mc049_recorded=2026-09-27T14:01:10.436Z`);
await db.$disconnect();
