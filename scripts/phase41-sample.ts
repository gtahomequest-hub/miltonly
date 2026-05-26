import { prisma } from '@/lib/prisma';
import { generateStreetContent } from '@/lib/generateStreet';
import { writeFileSync } from 'fs';

// Force Phase 4.1 v2 path for this run
process.env.AI_PROVIDER = 'phase41_v2';

(async () => {
  // Pick 10 random published streets with full data (totalSold >= 5)
  // to get a representative sample of what production cron faces.
  const candidates = await prisma.streetContent.findMany({
    where: { status: 'published' },
    select: { streetSlug: true, streetName: true },
  });

  // Shuffle and take 10
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, 10);

  console.log(`Phase 1 sampling: ${sample.length} streets`);
  console.log('='.repeat(70));

  const results: any[] = [];

  for (let i = 0; i < sample.length; i++) {
    const s = sample[i];
    const startTime = Date.now();
    console.log(`\n[${i + 1}/${sample.length}] ${s.streetSlug}`);

    try {
      const result = await generateStreetContent(s.streetSlug, s.streetName, { skipSms: true });
      const elapsed = Date.now() - startTime;

      const v2 = result.v2;
      results.push({
        slug: s.streetSlug,
        passed: result.passed,
        attempts: result.attempts,
        elapsedMs: elapsed,
        totalWords: v2?.totalWords ?? null,
        tokensIn: v2?.tokensIn ?? null,
        tokensOut: v2?.tokensOut ?? null,
        costUsd: v2?.costUsd ?? null,
        violations: [],
        errorType: null,
        errorMessage: null,
      });
      console.log(`  Result: ${result.passed ? 'PASS' : 'FAIL'}, ${result.attempts} attempts, ${(elapsed/1000).toFixed(1)}s`);
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const isPhase41Err = err.constructor.name === 'Phase41GenerationError';
      const violations = isPhase41Err ? err.payload?.violations ?? [] : [];

      results.push({
        slug: s.streetSlug,
        passed: false,
        attempts: isPhase41Err ? err.payload?.attemptCount : null,
        elapsedMs: elapsed,
        totalWords: null,
        tokensIn: isPhase41Err ? err.payload?.totalInputTokens : null,
        tokensOut: isPhase41Err ? err.payload?.totalOutputTokens : null,
        costUsd: isPhase41Err ? err.payload?.totalCostUsd : null,
        violations: violations.map((v: any) => ({ rule: v.rule, sectionId: v.sectionId })),
        errorType: err.constructor.name,
        errorMessage: err.message.slice(0, 200),
      });
      console.log(`  Result: ERROR (${err.constructor.name}), ${(elapsed/1000).toFixed(1)}s`);
      if (violations.length > 0) {
        console.log(`  Violations: ${violations.map((v: any) => v.rule).join(', ')}`);
      }
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const totalCost = results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);

  // Failure rule distribution
  const ruleCounts: Record<string, number> = {};
  for (const r of results) {
    for (const v of r.violations) {
      const key = `${v.rule}@${v.sectionId ?? 'unknown'}`;
      ruleCounts[key] = (ruleCounts[key] || 0) + 1;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('PHASE 1 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Passed: ${passed}/${results.length} (${((passed/results.length)*100).toFixed(0)}%)`);
  console.log(`Failed: ${failed}/${results.length} (${((failed/results.length)*100).toFixed(0)}%)`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`\nFailure rule distribution:`);
  const sortedRules = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedRules) {
    console.log(`  ${rule}: ${count}`);
  }
  console.log(`\nPer-street results:`);
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const violationStr = r.violations.length > 0 ? ` [${r.violations.map((v: any) => v.rule).join(',')}]` : '';
    console.log(`  ${status} ${r.slug} (${r.attempts ?? '?'} att, $${(r.costUsd ?? 0).toFixed(4)})${violationStr}`);
  }

  // Write full results to file
  const outPath = `experiment-output/phase41-sample-${Date.now()}.json`;
  writeFileSync(outPath, JSON.stringify({ results, summary: { passed, failed, totalCost, ruleCounts } }, null, 2));
  console.log(`\nFull results: ${outPath}`);

  await prisma.$disconnect();
})();
