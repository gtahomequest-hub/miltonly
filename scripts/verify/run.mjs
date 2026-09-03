#!/usr/bin/env node
// THE STREET-CORPUS VERIFICATION BATTERY. One entry point, one target, one crawl.
//
//   BASE=https://miltonly.com node scripts/verify/run.mjs
//   BASE=<preview-url> node scripts/verify/run.mjs --only=denials,schema-parity
//
// Exits 0 when every assertion holds, 1 otherwise, so it can gate a deploy.
// See ./README.md for the rules these checks encode.
import { publishedStreetSlugs, crawl } from './lib/http.mjs';
import { loadRecord, loadHubRecord } from './lib/db.mjs';

import denials from './checks/denials.mjs';
import schemaParity from './checks/schema-parity.mjs';
import claims from './checks/claims.mjs';
import tiles from './checks/tiles.mjs';
import consistency from './checks/consistency.mjs';
import composition from './checks/composition.mjs';
import coordinates from './checks/coordinates.mjs';
import hubMeta from './checks/hub-meta.mjs';
import geometryControl from './checks/geometry-control.mjs';
import { servedCommit } from './lib/build.mjs';
import { execSync } from 'node:child_process';

const ALL = [denials, schemaParity, claims, tiles, consistency, composition, coordinates, hubMeta, geometryControl];

const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('BASE is required, e.g. BASE=https://miltonly.com node scripts/verify/run.mjs');
  process.exit(2);
}
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const checks = only.length ? ALL.filter((c) => only.includes(c.id)) : ALL;
if (only.length && checks.length !== only.length) {
  console.error(`unknown check(s): ${only.filter((id) => !ALL.some((c) => c.id === id)).join(', ')}`);
  process.exit(2);
}
const CONCURRENCY = Number(process.env.CONC || 8);

const t0 = Date.now();
console.log(`\n═══ MILTONLY STREET VERIFICATION ═══`);
console.log(`target      ${BASE}`);

// ── THE DEPLOYMENT GATE ──────────────────────────────────────────────────────────────────────
// Assert the host is serving the build we mean to verify, BEFORE a single content assertion runs.
//
// On 2026-09-03 hub-meta failed four consecutive runs on `old-milton` and `cobban` with stable,
// identical numbers. Two mechanisms were proposed and both were wrong: the queries never
// disagreed at all. The battery was reading pages the CDN had cached from a build older than the
// one under test. A content FAIL against the wrong deployment is not a finding — it is a
// several-hour hunt for a data bug that does not exist. So it aborts instead of reporting.
//
// Expected SHA: EXPECT_SHA when set, otherwise the local HEAD. Running the battery from a branch
// is an implicit claim that the branch is what is deployed, so HEAD is the honest default rather
// than a silent skip.
const expectedSha = (process.env.EXPECT_SHA || execSync('git rev-parse HEAD').toString()).trim();
let servedSha;
try {
  servedSha = await servedCommit(BASE);
} catch (e) {
  console.error(`
cannot read the served build identifier: ${e.message}`);
  console.error('aborting — an unverifiable deployment identity is not a passing one.');
  process.exit(2);
}
if (servedSha !== expectedSha) {
  console.error(`
wrong deployment served: got ${servedSha} expected ${expectedSha}`);
  console.error('aborting before any content check — those assertions would describe a build you did not ask about.');
  process.exit(2);
}
console.log(`build       ${servedSha.slice(0, 7)} served == expected`);

// ── the page set, derived ────────────────────────────────────────────────────────────────────
const slugs = await publishedStreetSlugs(BASE);
console.log(`sitemap     ${slugs.length} published street pages (derived, not a literal)`);

// ── the record, derived — only if a selected check needs it ──────────────────────────────────
const record = checks.some((c) => c.needsRecord) ? await loadRecord() : null;
if (record) console.log(`record      DB2 + analytics aggregates loaded`);
// The hub side of the record — neighbourhood raw-string pools + their live 12mo aggregate.
const hubRecord = checks.some((c) => c.needsHubRecord) ? await loadHubRecord() : null;
if (hubRecord) console.log(`hub record  ${hubRecord.publishedSlugs.length} published hubs + DB2 pools loaded`);

// ── ONE crawl, every check ───────────────────────────────────────────────────────────────────
const ctx = { base: BASE, slugs, record, hubRecord };
const rowsByCheck = new Map(checks.map((c) => [c.id, []]));
const failures = [];

// The street crawl only happens when a selected check actually reads street pages. A
// --only=hub-meta run would otherwise fetch 426 pages nothing would look at. The full run is
// unchanged: any per-page check present puts the crawl back.
const needsCrawl = checks.some((c) => !c.wholeCorpusOnly);
const statuses = needsCrawl
  ? await crawl(BASE, slugs, (slug, html) => {
      if (html === null) return;                   // non-200s are counted below, not parsed
      for (const c of checks) {
        if (c.wholeCorpusOnly) continue;
        rowsByCheck.get(c.id).push(c.perPage(slug, html, ctx));
      }
    }, { concurrency: CONCURRENCY })
  : null;

if (statuses) {
  const fetched = statuses.filter((s) => s.status === 200).length;
  console.log(`crawled     ${statuses.length} pages · ${fetched} × 200 · ${statuses.length - fetched} other`);

  // The count is asserted against the set it was derived from, never against a remembered number.
  const iteratedOk = statuses.length === slugs.length && fetched === slugs.length;
  console.log(`\nASSERT iterated == live sitemap count (${slugs.length}) : ${iteratedOk ? 'PASS' : 'FAIL'}`);
  if (!iteratedOk) {
    failures.push(['crawl', 'iterated == live sitemap count', statuses.length, slugs.length]);
    statuses.filter((s) => s.status !== 200).slice(0, 8).forEach((s) => console.log(`   ${s.slug} -> ${s.status}`));
  }
} else {
  console.log(`crawled     0 street pages (no per-page check selected)`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
for (const c of checks) {
  // awaited: a whole-corpus check may derive its OWN page set and fetch it (the hub checks read
  // /neighbourhoods/, not the street crawl). await on a synchronous return is a no-op, so every
  // existing check is unaffected.
  const result = await c.finish(rowsByCheck.get(c.id), ctx);
  console.log(`\n── ${c.title}`);
  // COVERAGE ALONGSIDE EVERY FINDING. "Found nothing" and "read nothing" print identically
  // otherwise, and only one of them is good news.
  for (const [label, value] of result.coverage ?? []) console.log(`   · ${label}: ${value}`);
  for (const [label, actual, expected] of result.assertions ?? []) {
    const pass = actual === expected;
    if (!pass) failures.push([c.id, label, actual, expected]);
    console.log(`   ${pass ? 'PASS' : 'FAIL'}  ${label}: ${actual}${pass ? '' : ` (expected ${expected})`}`);
  }
  for (const note of result.notes ?? []) console.log(`   NOTE  ${note}`);
  if (failures.some((f) => f[0] === c.id)) for (const ex of (result.examples ?? []).slice(0, 6)) console.log(`         ${ex}`);
}

// ── summary ──────────────────────────────────────────────────────────────────────────────────
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`\n═══ ${failures.length === 0 ? 'PASS' : 'FAIL'} · ${checks.length} checks · ${slugs.length} pages · ${secs}s ═══`);
if (failures.length) {
  console.log(`${failures.length} assertion(s) failed:`);
  for (const [id, label, actual, expected] of failures) console.log(`   [${id}] ${label}: ${actual}, expected ${expected}`);
}
process.exit(failures.length === 0 ? 0 : 1);
