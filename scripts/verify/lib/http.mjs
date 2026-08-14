// ONE TARGET. Every request in the battery goes through here, so there is exactly one place a
// host can come from and no check can quietly read production while the others read a preview.
// (A scratchpad sweep did precisely that: its sitemap fetch was a literal miltonly.com while its
// page fetches honoured BASE, so a preview run verified production's page set and passed.)

/** Retrying GET. Returns { status, body } — body is '' unless the status is 200. */
export async function get(url, { tries = 3, agent = 'miltonly-verify' } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': agent }, redirect: 'manual' });
      if (r.status >= 500 && i < tries - 1) { await sleep(500 * (i + 1)); continue; }
      return { status: r.status, body: r.status === 200 ? await r.text() : '' };
    } catch {
      if (i === tries - 1) return { status: 0, body: '' };
      await sleep(500 * (i + 1));
    }
  }
  return { status: 0, body: '' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The published street set, DERIVED from the live sitemap at `base`. Never a literal, never a
 *  file, never a count carried from a previous run. */
export async function publishedStreetSlugs(base) {
  const sm = await get(`${base}/sitemap.xml`);
  if (sm.status !== 200) throw new Error(`sitemap at ${base} returned ${sm.status}`);
  const slugs = [...new Set(
    [...sm.body.matchAll(/<loc>[^<]*\/streets\/([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, '')),
  )];
  if (!slugs.length) throw new Error(`sitemap at ${base} lists no /streets/ pages`);
  return slugs;
}

/** Fetch every slug once, hand each page to every consumer, keep no HTML afterwards. */
export async function crawl(base, slugs, onPage, { concurrency = 8 } = {}) {
  let i = 0;
  const statuses = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < slugs.length) {
      const slug = slugs[i++];
      const r = await get(`${base}/streets/${slug}`);
      statuses.push({ slug, status: r.status });
      onPage(slug, r.status === 200 ? r.body : null);
    }
  }));
  return statuses;
}
