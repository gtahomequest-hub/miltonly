import { prisma } from '@/lib/prisma';

(async () => {
  const total = await prisma.streetContent.count({ where: { status: 'published' }});
  const clean = await prisma.streetContent.count({ where: { status: 'published', needsReview: false }});
  const flagged = await prisma.streetContent.count({ where: { status: 'published', needsReview: true }});
  
  console.log('Published streets: ' + total);
  console.log('Clean (Phase 4.1 renders): ' + clean);
  console.log('Flagged (legacy fallback): ' + flagged);
  console.log('Coverage: ' + Math.round(clean / total * 100) + '%');
  
  await prisma.$disconnect();
})();
