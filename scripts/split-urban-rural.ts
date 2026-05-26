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
  
  // Filter to neighbourhoods with the "NNNN - XX Name" code prefix
  // (urban Milton neighbourhoods). Rural ones lack the code prefix.
  const codePattern = /^\d{4}\s*-\s*[A-Z]{2}/;
  
  const urban = flagged.filter(s => {
    const hood = s.neighbourhood || '';
    return codePattern.test(hood);
  });
  
  const rural = flagged.filter(s => {
    const hood = s.neighbourhood || '';
    return !codePattern.test(hood);
  });
  
  console.log('Urban (code-prefixed neighbourhoods): ' + urban.length);
  console.log('Rural (no code prefix): ' + rural.length);
  
  writeFileSync('scripts/regen-urban.txt', urban.map(s => s.streetSlug).join('\n') + '\n');
  writeFileSync('scripts/regen-rural.txt', rural.map(s => s.streetSlug).join('\n') + '\n');
  
  console.log('Wrote ' + urban.length + ' urban slugs to scripts/regen-urban.txt');
  console.log('Wrote ' + rural.length + ' rural slugs to scripts/regen-rural.txt (skip for tonight)');
  
  await prisma.$disconnect();
})();
