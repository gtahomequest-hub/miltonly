// Every street the build knew is served from the cache after a deploy (MC-035).
//
// MA-007 swept the 646 street pages 22 minutes after a deploy and found 546 MISS, 16 HIT,
// 3 PRERENDER, 14 STALE: the build prerendered fifty and the deploy had wiped the rest, so a
// reader's first request rendered the page at 2.3 s. MC-035 prerenders every published street
// on production (src/lib/streetPrerender.ts, keyed on VERCEL_ENV). This check is the sweep,
// held: one GET per street in the live sitemap, read BEFORE the crawl (a crawl turns a MISS
// into a HIT and would hide the very thing this measures), and the assertion that no street
// published before the deployment answers MISS.
//
//   x-vercel-cache on Vercel: PRERENDER (built at deploy, first request), HIT (cached), STALE
//   (served past its revalidate, refreshed behind), REVALIDATED (a tag or path drop since the
//   build; rendered in the foreground on this request), MISS (no entry at all: the build did not
//   prerender it, or a deploy dropped it).
//
// Streets published after the build (the creation cron, up to twenty a day, first batch at
// 00:01Z) render on their first visit by design and are excluded by StreetContent.createdAt
// against the deployment's build time (/api/build builtAt, inlined by next.config.mjs).
// A tag drop between the deploy and this run shows as REVALIDATED, reported, not failed: the
// prerender held; a job dropped the entry. On a preview the build prerenders fifty, so the
// assertion applies to production only and the split is reported everywhere.
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from '../lib/env.mjs';

const UA = 'miltonly-verify';

async function head(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'manual' });
      await r.arrayBuffer();
      return { status: r.status, cache: r.headers.get('x-vercel-cache') || 'none', age: Number(r.headers.get('age') || 0) };
    } catch {
      if (i === 2) return { status: 0, cache: 'error', age: 0 };
    }
  }
  return { status: 0, cache: 'error', age: 0 };
}

export default {
  id: 'prerender-coverage',
  title: 'Every street the build knew is served from the cache after a deploy',
  wholeCorpusOnly: true,

  /** The sweep, before the crawl. Stored on ctx for finish(). */
  async beforeCrawl({ base, slugs }) {
    const t0 = Date.now();
    const states = [];
    let i = 0;
    await Promise.all(Array.from({ length: 16 }, async () => {
      while (i < slugs.length) {
        const slug = slugs[i++];
        states.push({ slug, ...(await head(`${base}/streets/${slug}`)) });
      }
    }));
    const build = await fetch(`${base}/api/build`, { headers: { 'user-agent': UA } }).then((r) => r.json()).catch(() => ({}));
    return { states, build, ms: Date.now() - t0 };
  },

  async finish(_rows, { slugs, sweep }) {
    if (!sweep) throw new Error('prerender-coverage: the sweep did not run before the crawl');
    const { states, build } = sweep;
    const builtAt = build.builtAt ? new Date(build.builtAt) : null;
    const env = build.env || 'unknown';

    loadEnv();
    requireEnv('DATABASE_URL');
    const app = neon(process.env.DATABASE_URL);
    const created = new Map((await app`SELECT "streetSlug" s, "createdAt" c FROM public."StreetContent" WHERE status = 'published'`).map((r) => [r.s, new Date(r.c)]));

    const tally = {};
    for (const s of states) tally[s.cache] = (tally[s.cache] ?? 0) + 1;
    const preDeploy = states.filter((s) => builtAt && created.has(s.slug) && created.get(s.slug) < builtAt);
    const postDeploy = states.filter((s) => builtAt && created.has(s.slug) && created.get(s.slug) >= builtAt);
    const missPre = preDeploy.filter((s) => s.cache === 'MISS');
    const revalidatedPre = preDeploy.filter((s) => s.cache === 'REVALIDATED');
    const cached = states.filter((s) => ['PRERENDER', 'HIT', 'STALE'].includes(s.cache));
    const non200 = states.filter((s) => s.status !== 200);

    const coverage = [
      ['deployment', `${(build.commit || 'unknown').slice(0, 7)} · ${env} · built ${build.builtAt || 'unknown'}`],
      ['streets swept (one GET each, before the crawl)', `${states.length} of ${slugs.length} in ${(sweep.ms / 1000).toFixed(0)}s`],
      ['split', Object.entries(tally).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k} ${v}`).join(' · ')],
      ['served from the cache (PRERENDER + HIT + STALE)', `${cached.length} of ${states.length} (${states.length ? Math.round((cached.length / states.length) * 100) : 0}%)`],
      ['streets published before the build', preDeploy.length],
      ['streets published after the build (render on first visit by design)', postDeploy.length],
      ['pre-build streets answering REVALIDATED (a tag or path drop since the deploy)', revalidatedPre.length],
    ];
    const assertions = [
      ['streets swept == live sitemap count', states.length, slugs.length],
      ['streets not answering 200', non200.length, 0],
    ];
    const notes = [];
    if (!builtAt) notes.push('the deployment reports no builtAt; the pre-build set cannot be drawn, so the MISS assertion did not run');
    else if (env !== 'production') notes.push(`${env} builds prerender fifty streets by design; the MISS assertion applies to production only`);
    else assertions.push(['pre-build streets answering MISS (not prerendered, or dropped by a deploy)', missPre.length, 0]);
    return {
      coverage,
      assertions,
      notes,
      examples: [
        ...missPre.slice(0, 4).map((s) => `${s.slug} · MISS · created ${created.get(s.slug)?.toISOString()}`),
        ...non200.slice(0, 2).map((s) => `${s.slug} · ${s.status}`),
      ],
    };
  },
};
