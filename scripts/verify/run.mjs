#!/usr/bin/env node
// THE STREET-CORPUS VERIFICATION BATTERY. One entry point, one target, one crawl.
//
//   BASE=https://miltonly.com node scripts/verify/run.mjs
//   BASE=<preview-url> node scripts/verify/run.mjs --only=denials,schema-parity
//
// Exits 0 when every assertion holds, 1 otherwise, so it can gate a deploy.
// See ./README.md for the rules these checks encode.
import { publishedStreetSlugs, crawl } from './lib/http.mjs';
import { loadRecord } from './lib/db.mjs';

import denials from './checks/denials.mjs';
import schemaParity from './checks/schema-parity.mjs';
import claims from './checks/claims.mjs';
import tiles from './checks/tiles.mjs';
import consistency from './checks/consistency.mjs';
import composition from './checks/composition.mjs';
import coordinates from './checks/coordinates.mjs';

const ALL = [denials, schemaParity, claims, tiles, consistency, composition, coordinates];

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

// ── the page set, derived ────────────────────────────────────────────────────────────────────
const slugs = await publishedStreetSlugs(BASE);
console.log(`sitemap     ${slugs.length} published street pages (derived, not a literal)`);

// ── the record, derived — only if a selected check needs it ──────────────────────────────────
const record = checks.some((c) => c.needsRecord) ? await loadRecord() : null;
if (record) console.log(`record      DB2 + analytics aggregates loaded`);

// ── ONE crawl, every check ───────────────────────────────────────────────────────────────────
const ctx = { base: BASE, slugs, record };
const rowsByCheck = new Map(checks.map((c) => [c.id, []]));
const failures = [];

const statuses = await crawl(BASE, slugs, (slug, html) => {
  if (html === null) return;                       // non-200s are counted below, not parsed
  for (const c of checks) {
    if (c.wholeCorpusOnly) continue;
    rowsByCheck.get(c.id).push(c.perPage(slug, html, ctx));
  }
}, { concurrency: CONCURRENCY });

const fetched = statuses.filter((s) => s.status === 200).length;
console.log(`crawled     ${statuses.length} pages · ${fetched} × 200 · ${statuses.length - fetched} other`);

// The count is asserted against the set it was derived from, never against a remembered number.
const iteratedOk = statuses.length === slugs.length && fetched === slugs.length;
console.log(`\nASSERT iterated == live sitemap count (${slugs.length}) : ${iteratedOk ? 'PASS' : 'FAIL'}`);
if (!iteratedOk) {
  failures.push(['crawl', 'iterated == live sitemap count', statuses.length, slugs.length]);
  statuses.filter((s) => s.status !== 200).slice(0, 8).forEach((s) => console.log(`   ${s.slug} -> ${s.status}`));
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
for (const c of checks) {
  const result = c.finish(rowsByCheck.get(c.id), ctx);
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
