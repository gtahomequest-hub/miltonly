import { prisma } from '@/lib/prisma';

(async () => {
  const total = await prisma.streetContent.count();
  const byStatus = await prisma.streetContent.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  
  // Phase 4.1 coverage within published
  const cleanPublished = await prisma.streetContent.count({
    where: { status: 'published', needsReview: false }
  });
  
  // Streets queued but not yet built
  const queueTotal = await prisma.streetQueue.count();
  const queueByStatus = await prisma.streetQueue.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  
  console.log('=== STREETCONTENT (Milton universe in DB) ===');
  console.log('Total rows: ' + total);
  for (const s of byStatus) {
    console.log('  ' + s.status + ': ' + s._count._all);
  }
  console.log('');
  console.log('=== PHASE 4.1 COVERAGE ===');
  console.log('Published with clean Phase 4.1: ' + cleanPublished);
  
  console.log('');
  console.log('=== STREETQUEUE (build pipeline) ===');
  console.log('Total queued: ' + queueTotal);
  for (const s of queueByStatus) {
    console.log('  ' + s.status + ': ' + s._count._all);
  }
  
  await prisma.$disconnect();
})();
