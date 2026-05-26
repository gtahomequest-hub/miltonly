import { prisma } from '@/lib/prisma';

(async () => {
  const flagged = await prisma.streetContent.findMany({
    where: { status: 'published', needsReview: true },
    select: { streetSlug: true, neighbourhood: true },
    orderBy: { neighbourhood: 'asc' },
  });
  
  // Group by neighbourhood for clarity
  const byHood: Record<string, string[]> = {};
  for (const s of flagged) {
    const hood = s.neighbourhood || '(null)';
    if (!byHood[hood]) byHood[hood] = [];
    byHood[hood].push(s.streetSlug);
  }
  
  console.log('=== 32 remaining flagged streets ===');
  console.log('');
  for (const hood of Object.keys(byHood).sort()) {
    console.log('[' + byHood[hood].length + '] ' + hood);
    for (const slug of byHood[hood]) {
      console.log('    ' + slug);
    }
    console.log('');
  }
  
  await prisma.$disconnect();
})();
