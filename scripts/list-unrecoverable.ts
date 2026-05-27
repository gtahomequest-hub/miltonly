import { prisma } from '@/lib/prisma';

(async () => {
  const drafts = await prisma.streetContent.findMany({
    where: {
      status: 'draft',
      neighbourhood: null
    },
    select: { streetSlug: true, streetName: true, createdAt: true },
    orderBy: { streetName: 'asc' }
  });

  console.log(`Found ${drafts.length} draft streets with null neighbourhood`);
  console.log('');
  console.log('First 15 (alphabetical):');
  drafts.slice(0, 15).forEach(d => {
    console.log(`  ${d.streetName.padEnd(40)} | ${d.streetSlug}`);
  });

  await prisma.$disconnect();
})();
