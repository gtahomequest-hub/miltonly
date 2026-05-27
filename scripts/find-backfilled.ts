import { prisma } from '@/lib/prisma';

(async () => {
  // Rows updated last night during backfill window: between 06:00 and 08:00 UTC May 26
  const start = new Date('2026-05-26T05:00:00Z');
  const end = new Date('2026-05-26T09:00:00Z');

  const rows = await prisma.streetContent.findMany({
    where: {
      updatedAt: { gte: start, lte: end },
      neighbourhood: { not: null }
    },
    select: { streetSlug: true, status: true, neighbourhood: true, attempts: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' }
  });

  console.log(`Found ${rows.length} rows updated in backfill window`);
  console.table(rows);

  const stillDraft = rows.filter(r => r.status === 'draft');
  console.log(`\nStill draft: ${stillDraft.length}`);
  console.log(`Already published: ${rows.length - stillDraft.length}`);

  await prisma.$disconnect();
})();
