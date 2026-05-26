import { prisma } from '@/lib/prisma';
import { writeFileSync } from 'node:fs';

(async () => {
  const flagged = await prisma.streetContent.findMany({
    where: { 
      status: 'published',
      needsReview: true,
    },
    select: { streetSlug: true, neighbourhood: true },
    orderBy: { streetSlug: 'asc' },
  });
  
  // Group by neighbourhood
  const byHood: Record<string, string[]> = {};
  for (const s of flagged) {
    const hood = s.neighbourhood || '(null)';
    if (!byHood[hood]) byHood[hood] = [];
    byHood[hood].push(s.streetSlug);
  }
  
  console.log('=== 124 flagged streets by neighbourhood ===');
  const hoods = Object.keys(byHood).sort();
  for (const hood of hoods) {
    console.log(`  ${byHood[hood].length.toString().padStart(3)} | ${hood}`);
  }
  
  await prisma.$disconnect();
})();
