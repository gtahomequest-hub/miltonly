// MA-011. The nightly's pure decisions about links and www twins, apart from run.mjs so the standing
// test (test-nightly-checks.mjs) can hold them.

/**
 * D1. A link finding carried from the previous night is resolved, not carried, when its target has
 * joined the sitemap (the page is swept as a page now), or when every page recorded as linking it was
 * swept tonight with a 200 and none links it any more. `links` is tonight's state.links, filled in
 * place; returns the resolved targets by reason.
 */
export function resolveCarriedLinks({ prevLinks = {}, links, sitemap, pages, linkedTonight, date }) {
  const linkedBase = new Set([...linkedTonight].map((k) => k.split('?')[0]));
  const resolved = { sitemap: [], unlinked: [] };
  for (const [t, l] of Object.entries(prevLinks)) {
    if (links[t] || !l.finding) continue;
    if (sitemap.has(t) || sitemap.has(t.split('?')[0])) { links[t] = { resolved: 'joined the sitemap', checkedAt: date }; resolved.sitemap.push(t); continue; }
    const from = l.from || [];
    const allSwept = from.length > 0 && from.length >= (l.refs || 0) && from.every((r) => pages[r]?.status === 200 && !pages[r].error);
    if (allSwept && !linkedBase.has(t.split('?')[0])) { links[t] = { resolved: 'no longer linked', checkedAt: date }; resolved.unlinked.push(t); continue; }
    links[t] = { ...l, carried: true };
  }
  return resolved;
}

/** Off-sitemap targets in checking order: the oldest check first (never checked first of all), then the most linked. */
export function linkQueue(discovered, prevLinks = {}) {
  const rank = new Map(discovered.map(([t], i) => [t, i + 1]));
  const last = (t) => prevLinks[t]?.checkedAt || '';
  return [...discovered].sort((a, b) => last(a[0]).localeCompare(last(b[0])) || rank.get(a[0]) - rank.get(b[0]));
}

/** The date-seeded www sample: the homepage, then n - 1 distinct sitemap paths. The same day draws the same paths. */
export function wwwSample(sitemap, date, n) {
  const pool = [...sitemap].filter((p) => p !== '/').sort();
  let h = [...`www${date}`].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  const out = ['/'];
  while (out.length < Math.min(n, pool.length + 1)) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const p = pool[h % pool.length]; if (!out.includes(p)) out.push(p); }
  return out;
}

/** A www twin passes only as a 308 to exactly the same path on the apex. */
export const wwwPasses = (base, path, status, location) => status === 308 && location === `${base}${path}`;
