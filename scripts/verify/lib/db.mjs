// The OTHER side of every assertion.
//
// A gate is only worth running when both sides are derived independently: the published side from
// the live pages, this side from the record they are meant to describe. Nothing here is a snapshot.
// The zero-sale set used to be zero-sale-correct.json, frozen on 2026-07-30 and read by five
// scripts — after a merge removed five slugs from the sitemap it reported 29 == 33 FAIL with
// nothing wrong at all, and it would have reported PASS just as readily with something wrong.
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from './env.mjs';
import { num } from './money.mjs';

export const K_ANON_PRICE = 5;
export const K_ANON_RANGE = 10;

/** base||type — the identity a street page unions over, direction ignored. */
export const identityKey = (slug) => {
  const parts = slug.replace(/-milton$/, '').split('-');
  return `${parts.slice(0, -1).join('-')}||${parts[parts.length - 1]}`;
};

/** The hub side of the record: the neighbourhood -> raw-TREB-string mapping and the published
 *  hub set from DB1, and the 12-month sale aggregate per raw string from DB2.
 *
 *  The AGGREGATION is re-derived here rather than imported — same discipline as the street
 *  checks, so a rounding or a k-floor that drifts in the app cannot drift in the assertion with
 *  it. The rawStrings MAPPING is read from DB1 because it is the record, not an implementation:
 *  there is no way to recover "1041 - NA Rural Nassagaweya" and "Nassagaweya" both belong to
 *  `nassagaweya` by slugifying, and a clever guess would silently mis-join a pool. */
export async function loadHubRecord() {
  loadEnv();
  requireEnv('SOLD_DATABASE_URL', 'DATABASE_URL');
  const sold = neon(process.env.SOLD_DATABASE_URL);
  const app = neon(process.env.DATABASE_URL);

  const nbhds = await app`SELECT slug, name, profile, "rawStrings" FROM public."Neighbourhood"`;
  const stored = await app`SELECT "neighbourhoodSlug" s, "metaDescription" d, "neighbourhoodName" n
                           FROM public."HubContent" WHERE status = 'published'`;
  if (!nbhds.length) throw new Error('DB1 returned no Neighbourhood rows — check the credential, not the data');
  if (!stored.length) throw new Error('DB1 returned no published HubContent rows');

  const agg = new Map();
  for (const r of await sold`SELECT neighbourhood, COUNT(*)::int n, AVG(sold_price) avg
                             FROM sold.sold_records
                             WHERE perm_advertise=TRUE AND transaction_type='For Sale'
                               AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
                             GROUP BY 1`) agg.set(r.neighbourhood, r);

  const bySlug = new Map(nbhds.map((n) => [n.slug, n]));
  const storedBySlug = new Map(stored.map((r) => [r.s, r]));

  return {
    publishedSlugs: stored.map((r) => r.s),
    /** What THIS hub's meta and hero are entitled to publish, recomputed from the record. */
    hub(slug) {
      const n = bySlug.get(slug);
      if (!n) return null;
      let count = 0, total = 0;
      for (const raw of n.rawStrings) {
        const r = agg.get(raw);
        if (r) { count += Number(r.n); total += Number(r.avg) * Number(r.n); }
      }
      // k-gate first, THEN round — the same order the page must use. A price that
      // exists only below the floor is null, never a rounded small-sample average.
      const typical = count >= K_ANON_PRICE && total > 0 ? Math.round(total / count / 5000) * 5000 : null;
      const s = storedBySlug.get(slug);
      return {
        profile: n.profile === 'urban_hub' ? 'urban' : 'rural',
        name: s?.n ?? n.name,
        salesCount: count,
        typicalRounded: typical,
        storedMetaDescription: s?.d ?? null,
      };
    },
  };
}

export async function loadRecord() {
  loadEnv();
  requireEnv('SOLD_DATABASE_URL', 'ANALYTICS_DATABASE_URL');
  const sold = neon(process.env.SOLD_DATABASE_URL);
  const analytics = neon(process.env.ANALYTICS_DATABASE_URL);

  const sale12 = new Map(), saleFull = new Map(), lease12 = new Map(), stat = new Map();
  for (const r of await sold`SELECT street_slug s, COUNT(*)::int n, AVG(sold_price) avg,
                                    MIN(sold_price) lo, MAX(sold_price) hi,
                                    AVG(days_on_market) dom, AVG(sold_to_ask_ratio) sta
                             FROM sold.sold_records
                             WHERE perm_advertise=TRUE AND transaction_type='For Sale'
                               AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
                             GROUP BY 1`) sale12.set(r.s, r);
  for (const r of await sold`SELECT street_slug s, COUNT(*)::int n, AVG(sold_price) avg
                             FROM sold.sold_records
                             WHERE perm_advertise=TRUE AND transaction_type='For Sale'
                               AND sold_date <= NOW() AND sold_price IS NOT NULL
                             GROUP BY 1`) saleFull.set(r.s, r);
  for (const r of await sold`SELECT street_slug s, COUNT(*)::int n, AVG(sold_price) avg
                             FROM sold.sold_records
                             WHERE perm_advertise=TRUE AND transaction_type='For Lease'
                               AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
                             GROUP BY 1`) lease12.set(r.s, r);
  for (const r of await analytics`SELECT street_slug s, sold_count_90days c90, sold_count_12months c12,
                                         avg_sold_price a90, avg_dom d90
                                  FROM analytics.street_sold_stats`) stat.set(r.s, r);

  const everSoldIdentities = new Set(
    (await sold`SELECT DISTINCT street_slug FROM sold.sold_records
                WHERE transaction_type = 'For Sale' AND perm_advertise = TRUE`)
      .map((r) => identityKey(r.street_slug)),
  );

  return {
    /** Streets among `slugs` with NO For Sale record, ever. SCOPED to the pages actually
     *  iterated — an unpublished zero-sale street cannot be a silent published page, and
     *  counting it as one is what made the old gate read a failure that was not there. */
    zeroSaleSet: (slugs) => new Set(slugs.filter((s) => !everSoldIdentities.has(identityKey(s)))),

    /** What each tile on `slug` is ENTITLED to publish, recomputed from the record.
     *  Per-slug, not the sibling union the page performs — a union can only ever RAISE n, so
     *  this is a conservative floor test and never produces a false failure. */
    entitled(slug) {
      const s = sale12.get(slug), f = saleFull.get(slug), l = lease12.get(slug);
      const n12 = s ? Number(s.n) : 0, nf = f ? Number(f.n) : 0, nl = l ? Number(l.n) : 0;
      let basis = null;
      if (n12 >= K_ANON_PRICE && num(s.avg) !== null) basis = { typical: Math.round(num(s.avg)), count: n12, window: '12mo' };
      else if (nf >= K_ANON_PRICE && num(f.avg) !== null) basis = { typical: Math.round(num(f.avg)), count: nf, window: 'full' };
      return {
        n12, nf, nl, basis,
        leaseBasis: nl >= K_ANON_PRICE && num(l.avg) !== null ? { typical: Math.round(num(l.avg)), count: nl } : null,
        dom: n12 >= K_ANON_PRICE ? num(s.dom) : null,
        soldToAsk: n12 >= K_ANON_PRICE ? num(s.sta) : null,
        band: n12 >= K_ANON_RANGE ? [num(s.lo), num(s.hi)] : null,
      };
    },

    /** The 90-day analytics columns — the source a published figure must NOT be coming from
     *  below threshold. */
    ninetyDay(slug) {
      const st = stat.get(slug) || {};
      return {
        c90: Number(st.c90 ?? 0),
        c12: Number(st.c12 ?? 0),
        a90: num(st.a90) !== null ? Math.round(num(st.a90)) : null,
        d90: num(st.d90) !== null ? Math.round(num(st.d90)) : null,
      };
    },
  };
}
