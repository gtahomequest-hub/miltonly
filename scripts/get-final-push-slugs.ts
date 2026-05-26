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
  
  // Exclude rural tracts with omitted centroids (won't generate)
  const ruralOmitted = new Set([
    '1041 - NA Rural Nassagaweya',
    '1044 - TR Rural Trafalgar', 
    'Rural Milton West',
  ]);
  
  const candidates = flagged.filter(s => !ruralOmitted.has(s.neighbourhood || ''));
  
  console.log('All flagged: ' + flagged.length);
  console.log('Excluding centroid-omitted rural: ' + candidates.length);
  console.log('');
  console.log('Candidates by neighbourhood:');
  const byHood: Record<string, number> = {};
  for (const c of candidates) {
    const h = c.neighbourhood || '(null)';
    byHood[h] = (byHood[h] || 0) + 1;
  }
  for (const h of Object.keys(byHood).sort()) {
    console.log('  [' + byHood[h] + '] ' + h);
  }
  
  writeFileSync('scripts/regen-final-push.txt', candidates.map(s => s.streetSlug).join('\n') + '\n');
  console.log('');
  console.log('Wrote ' + candidates.length + ' slugs to scripts/regen-final-push.txt');
  
  await prisma.$disconnect();
})();
