import { prisma } from '@/lib/prisma';
import { writeFileSync } from 'node:fs';

(async () => {
  const flagged = await prisma.streetContent.findMany({
    where: { 
      status: 'published',
      needsReview: true,
      neighbourhood: { in: ['Moffat', 'Brookville/Haltonville'] },
    },
    select: { streetSlug: true, neighbourhood: true },
    orderBy: { streetSlug: 'asc' },
  });
  
  console.log('Streets in newly-supported neighbourhoods:');
  for (const s of flagged) {
    console.log('  ' + s.streetSlug + ' (' + s.neighbourhood + ')');
  }
  
  writeFileSync('scripts/regen-newhamlets.txt', flagged.map(s => s.streetSlug).join('\n') + '\n');
  console.log('');
  console.log('Wrote ' + flagged.length + ' slugs to scripts/regen-newhamlets.txt');
  
  await prisma.$disconnect();
})();
