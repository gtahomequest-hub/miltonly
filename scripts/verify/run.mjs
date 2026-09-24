#!/usr/bin/env node
// THE STREET-CORPUS VERIFICATION BATTERY. One entry point, one target, one crawl.
//
//   BASE=https://miltonly.com node scripts/verify/run.mjs
//   BASE=<preview-url> node scripts/verify/run.mjs --only=denials,schema-parity
//
// Exits 0 when every assertion holds, 1 otherwise, so it can gate a deploy.
// See ./README.md for the rules these checks encode.
import { publishedStreetSlugs, crawl } from './lib/http.mjs';
import { streetMode, sampleStreets, readState, writeState } from './lib/sample.mjs';
import { loadRecord, loadHubRecord, loadHomeRecord } from './lib/db.mjs';

import denials from './checks/denials.mjs';
import schemaParity from './checks/schema-parity.mjs';
import claims from './checks/claims.mjs';
import tiles from './checks/tiles.mjs';
import consistency from './checks/consistency.mjs';
import composition from './checks/composition.mjs';
import coordinates from './checks/coordinates.mjs';
import hubMeta from './checks/hub-meta.mjs';
import geometryControl from './checks/geometry-control.mjs';
import homepage from './checks/homepage.mjs';
import hubIntents from './checks/hub-intents.mjs';
import guideLinks from './checks/guide-links.mjs';
import nav from './checks/nav.mjs';
import geometryFacts from './checks/geometry-facts.mjs';
import hubPage from './checks/hub-page.mjs';
import sourcesFresh from './checks/sources-fresh.mjs';
import footer from './checks/footer.mjs';
import catchment from './checks/catchment.mjs';
import video from './checks/video.mjs';
import phone390 from './checks/phone-390.mjs';
import vowFields from './checks/vow-fields.mjs';
import prerenderCoverage from './checks/prerender-coverage.mjs';
import vowDisplay from './checks/vow-display.mjs';
import agentOnly from './checks/agent-only.mjs';
import { servedCommit } from './lib/build.mjs';
import { execSync } from 'node:child_process';

const ALL = [denials, schemaParity, claims, tiles, consistency, composition, coordinates, hubMeta, geometryControl, homepage, hubIntents, guideLinks, geometryFacts, nav, hubPage, sourcesFresh, footer, catchment, video, phone390, vowFields, prerenderCoverage, vowDisplay, agentOnly];

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
// MC-035: --streets=full (every published street, the default) or --streets=sample (about fifty:
// the fixed edge-case set, the streets whose data changed since the last run here, a rotating
// fill). Whole-corpus checks are unaffected; only the per-page crawl shrinks.
const STREET_MODE = streetMode();

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

// ── the crawl set: every street, or the sample (MC-035) ─────────────────────────────────────
const state = readState(BASE);
let crawlSlugs = slugs;
if (STREET_MODE === 'sample') {
  const s = await sampleStreets(BASE, slugs, { since: state.lastRunAt, runs: state.runs });
  crawlSlugs = s.crawl;
  console.log(`sample      ${s.crawl.length} streets: ${Object.keys(s.fixed).length} class picks (${s.classes} classes, run ${s.runs}), ${s.touched.length} data-touched since ${state.lastRunAt || 'never'}${s.touchedDropped ? ` (${s.touchedDropped} more touched, beyond the cap)` : ''}, ${s.rotating.length} rotating`);
  console.log(`            picks: ${Object.entries(s.fixed).filter(([k]) => !k.startsWith('hub:')).map(([k, v]) => `${k}=${v}`).join(' ')}`);
} else {
  console.log(`streets     full crawl (--streets=sample for the fixed set plus a rotating fifty)`);
}

// ── the record, derived — only if a selected check needs it ──────────────────────────────────
const record = checks.some((c) => c.needsRecord) ? await loadRecord() : null;
if (record) console.log(`record      DB2 + analytics aggregates loaded`);
// The hub side of the record — neighbourhood raw-string pools + their live 12mo aggregate.
const hubRecord = checks.some((c) => c.needsHubRecord) ? await loadHubRecord() : null;
if (hubRecord) console.log(`hub record  ${hubRecord.publishedSlugs.length} published hubs + DB2 pools loaded`);

// The homepage side of the record: the Milton-wide figures the homepage states, recomputed.
const homeRecord = checks.some((c) => c.needsHomeRecord) ? await loadHomeRecord() : null;
if (homeRecord) console.log(`home record ${homeRecord.publishedStreetPages} published street pages + Milton-wide figures loaded`);

// ── ONE crawl, every check ───────────────────────────────────────────────────────────────────
const ctx = { base: BASE, slugs, crawled: crawlSlugs, mode: STREET_MODE, record, hubRecord, homeRecord };

// A check that must read the corpus BEFORE the crawl (prerender-coverage: a crawl turns a MISS
// into a HIT) runs its sweep here and finds the result on ctx.sweep.
for (const c of checks) if (typeof c.beforeCrawl === 'function') ctx.sweep = await c.beforeCrawl(ctx);
if (ctx.sweep) console.log(`sweep       ${ctx.sweep.states.length} streets read for the cache split before the crawl`);
const rowsByCheck = new Map(checks.map((c) => [c.id, []]));
const failures = [];

// The street crawl only happens when a selected check actually reads street pages. A
// --only=hub-meta run would otherwise fetch 426 pages nothing would look at. The full run is
// unchanged: any per-page check present puts the crawl back.
const needsCrawl = checks.some((c) => !c.wholeCorpusOnly);
const statuses = needsCrawl
  ? await crawl(BASE, crawlSlugs, (slug, html) => {
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
  const iteratedOk = statuses.length === crawlSlugs.length && fetched === crawlSlugs.length;
  const crawlLabel = STREET_MODE === 'sample' ? 'sample size' : 'live sitemap count';
  console.log(`\nASSERT iterated == ${crawlLabel} (${crawlSlugs.length}) : ${iteratedOk ? 'PASS' : 'FAIL'}`);
  if (!iteratedOk) {
    failures.push(['crawl', `iterated == ${crawlLabel}`, statuses.length, crawlSlugs.length]);
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
console.log(`\n═══ ${failures.length === 0 ? 'PASS' : 'FAIL'} · ${checks.length} checks · ${STREET_MODE === 'sample' ? `${crawlSlugs.length} of ${slugs.length} pages (sample)` : `${slugs.length} pages`} · ${secs}s ═══`);
writeState(BASE, { runs: (state.runs || 0) + 1, lastRunAt: new Date(t0).toISOString(), mode: STREET_MODE });
if (failures.length) {
  console.log(`${failures.length} assertion(s) failed:`);
  for (const [id, label, actual, expected] of failures) console.log(`   [${id}] ${label}: ${actual}, expected ${expected}`);
}
process.exit(failures.length === 0 ? 0 : 1);
