import { prisma } from '@/lib/prisma';

(async () => {
  const rows = await prisma.streetContent.findMany({
    where: {
      status: 'draft',
      neighbourhood: { not: null },
      attempts: 0
    },
    select: { streetSlug: true },
    orderBy: { streetSlug: 'asc' }
  });
  for (const r of rows) console.log(r.streetSlug);
  await prisma.$disconnect();
})();