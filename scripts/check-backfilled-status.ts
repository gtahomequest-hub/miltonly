import { prisma } from '@/lib/prisma';

const backfilledSlugs = [
  'rose-way-milton', 'leger-way-milton', 'izumi-gate-milton'
  // add the other 10 — need the full list from last night
];

(async () => {
  const rows = await prisma.streetContent.findMany({
    where: { streetSlug: { in: backfilledSlugs } },
    select: { streetSlug: true, status: true, neighbourhood: true, updatedAt: true, attempts: true }
  });
  console.table(rows);
  await prisma.$disconnect();
})();
