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

/**
 * THE HOMEPAGE SIDE OF THE RECORD.
 *
 * Written 2026-09-10 because the homepage gate passed with two wrong figures on the page.
 * It asserted that figures were PRESENT and that neighbourhood prices matched their hubs.
 * It never looked at the Milton-wide figures at all, so "0.980868783307145%" and a street
 * count of 738 against 444 published pages both sailed through a check whose own title
 * claimed the page "states its figures".
 *
 * A presence assertion is not a value assertion. Every figure below is recomputed here from
 * the database the page reads, and the check compares the RENDERED TEXT to it — not the
 * `data-value` attribute, which is the component's own opinion of itself and was correct in
 * both defects. The bug was in the formatting, so the formatting is what gets asserted.
 *
 * Each query is deliberately the same shape as the app's, including where that shape is
 * questionable: `activeListings` has no city filter and no transaction-type filter because
 * buildMiltonWideContext has none either. This is a drift gate, not a redesign. Where a
 * definition looks wrong it is reported in the run, never silently corrected here, or the
 * assertion would fail on correct code.
 */
export async function loadHomeRecord() {
  loadEnv();
  requireEnv('SOLD_DATABASE_URL', 'DATABASE_URL');
  const sold = neon(process.env.SOLD_DATABASE_URL);
  const app = neon(process.env.DATABASE_URL);

  const round5k = (n) => (n === null ? null : Math.round(n / 5000) * 5000);

  const [activeRows, newWeekRows, mtdRows, twelveRows, staRows, pubRows, entRows, rentRows] = await Promise.all([
    // buildMiltonWideContext: no city, no transaction-type filter.
    app`SELECT COUNT(*)::int n FROM public."Listing" WHERE "permAdvertise" = TRUE AND status = 'active'`,
    // getNewThisWeekCount: sale side, Milton, last 7 days.
    app`SELECT COUNT(*)::int n FROM public."Listing"
        WHERE "permAdvertise" = TRUE AND status = 'active' AND city = 'Milton'
          AND ("transactionType" IS NULL OR "transactionType" <> 'For Lease')
          AND "listedAt" >= NOW() - INTERVAL '7 days'`,
    // getSoldThisMonth: calendar month to date.
    sold`SELECT COUNT(*)::int n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) typical
         FROM sold.sold_records
         WHERE city = 'Milton' AND perm_advertise = TRUE AND transaction_type = 'For Sale'
           AND sold_date >= date_trunc('month', NOW()) AND sold_date <= NOW()`,
    // getHomepageData: the all-Milton typical (no city filter) + saleAggQuery(null)'s count.
    sold`SELECT COUNT(*)::int n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) typical
         FROM sold.sold_records
         WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
           AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`,
    // getMiltonSoldOverall: the /sold sold-to-ask, all-Milton, 12 months.
    sold`SELECT COUNT(*)::int n, AVG(sold_to_ask_ratio) sta
         FROM sold.sold_records
         WHERE city = 'Milton' AND perm_advertise = TRUE AND transaction_type = 'For Sale'
           AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`,
    // publishedStreetPageSlugs: published content INTERSECT existing entity — the sitemap's set.
    app`SELECT "streetSlug" s FROM public."StreetContent" WHERE status = 'published'`,
    app`SELECT slug FROM public."ResidentialStreet"`,
    // getRentalsAvailableCount: the lease side does NOT use status='active' — a lease row is
    // status='rented' for life and leaseStatus carries the lifecycle. Filtering on transaction
    // type alone counted 1,340 where 1,116 were available, and /rentals printed the difference
    // as "active rentals".
    app`SELECT COUNT(*)::int n FROM public."Listing"
        WHERE "transactionType" = 'For Lease' AND city = 'Milton'
          AND "permAdvertise" = TRUE AND "leaseStatus" = 'active'`,
  ]);

  const entities = new Set(entRows.map((r) => r.slug));
  const staN = Number(staRows[0]?.n ?? 0);
  const staRaw = num(staRows[0]?.sta ?? null);
  const mtdN = Number(mtdRows[0]?.n ?? 0);
  const mtdTypical = num(mtdRows[0]?.typical ?? null);
  const twelveTypical = num(twelveRows[0]?.typical ?? null);

  return {
    onMarket: Number(activeRows[0]?.n ?? 0),
    newThisWeek: Number(newWeekRows[0]?.n ?? 0),
    soldMonthToDate: mtdN,
    soldMonthTypical: mtdN >= K_ANON_PRICE ? round5k(mtdTypical) : null,
    sold12mo: Number(twelveRows[0]?.n ?? 0),
    typicalMilton: round5k(twelveTypical),
    // getMiltonSoldOverall rounds to one decimal; the proof point then rounds to a whole
    // number for display. Both are kept so the check can say which step drifted.
    soldToAskPct: staN >= K_ANON_PRICE && staRaw !== null ? Math.round(staRaw * 1000) / 10 : null,
    publishedStreetPages: pubRows.map((r) => r.s).filter((slug) => entities.has(slug)).length,
    publishedContentRows: pubRows.length,
    rentalsAvailable: Number(rentRows[0]?.n ?? 0),
  };
}
