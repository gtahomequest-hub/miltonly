import { prisma } from '@/lib/prisma';
import { writeFileSync } from 'node:fs';

(async () => {
  const flagged = await prisma.streetContent.findMany({
    where: { 
      status: 'published',
      needsReview: true,
    },
    select: { streetSlug: true },
    orderBy: { streetSlug: 'asc' },
  });
  
  const slugs = flagged.map(s => s.streetSlug);
  writeFileSync('scripts/regen-slugs.txt', slugs.join('\n') + '\n');
  console.log('Wrote ' + slugs.length + ' slugs to scripts/regen-slugs.txt');
  console.log('First 5: ' + slugs.slice(0, 5).join(', '));
  console.log('Last 5: ' + slugs.slice(-5).join(', '));
  
  await prisma.$disconnect();
})();
