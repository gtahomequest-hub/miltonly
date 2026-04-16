// DATA FLOW RULES — never violate:
// DB1 (operationalDb) → listings, leads, users, auth, compliance
// DB2 (soldDb, schema: sold) → raw VOW sold records, price history
// DB3 (analyticsDb, schema: analytics) → pre-computed stats, scores, monthly aggregates
// DB2 → DB3: this file. One direction only.
// DB2 → Claude API: NEVER. Individual sold records must not enter any AI prompt.
// DB3 → Claude API: aggregated stats only.
//
// Stats compute reads raw sold_records from the `sold` schema, aggregates, and
// writes to the `analytics` schema. On each write, the corresponding Redis
// cache keys are invalidated so the next read recomputes from fresh analytics.
//
// Compute is driven by the 11:30 UTC cron (Point 5 — fully decoupled from sync).

import { requireSoldDb, requireAnalyticsDb } from "./db";
import { invalidateMany } from "./cache";
import type { MarketTemperature } from "./db-types";

function classifyTemperature(soldToAsk: number | null, dom: number | null): MarketTemperature | null {
  if (soldToAsk === null || dom === null) return null;
  // >=1.03 & DOM <=10 → hot ; >=1.00 & DOM <=20 → warm ; 0.97-1.00 → balanced ;
  // 0.93-0.97 or DOM>30 → cool ; <0.93 or DOM>45 → cold
  if (soldToAsk >= 1.03 && dom <= 10) return "hot";
  if (soldToAsk >= 1.00 && dom <= 20) return "warm";
  if (soldToAsk >= 0.97 && dom <= 30) return "balanced";
  if (soldToAsk >= 0.93 || dom <= 45) return "cool";
  return "cold";
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export async function computeStreetSoldStats(streetSlug: string): Promise<void> {
  const sold = requireSoldDb();
  const analytics = requireAnalyticsDb();

  // Aggregate last 90 days / 12 months in one round-trip.
  // Filter matches the read-side VOW compliance filter so stats never
  // include non-displayable records.
  const rows = (await sold`
    WITH d90 AS (
      SELECT * FROM sold.sold_records
      WHERE street_slug = ${streetSlug}
        AND perm_advertise = TRUE
        AND mls_status = 'Sold'
        AND sold_date >= NOW() - INTERVAL '90 days'
    ),
    d365 AS (
      SELECT * FROM sold.sold_records
      WHERE street_slug = ${streetSlug}
        AND perm_advertise = TRUE
        AND mls_status = 'Sold'
        AND sold_date >= NOW() - INTERVAL '365 days'
    ),
    prev AS (
      SELECT AVG(sold_price) AS avg_prev FROM sold.sold_records
      WHERE street_slug = ${streetSlug}
        AND perm_advertise = TRUE
        AND mls_status = 'Sold'
        AND sold_date >= NOW() - INTERVAL '730 days'
        AND sold_date <  NOW() - INTERVAL '365 days'
    ),
    peak AS (
      SELECT EXTRACT(MONTH FROM sold_date)::int AS m, COUNT(*) AS c
      FROM d365
      GROUP BY 1
      ORDER BY c DESC, m ASC
      LIMIT 1
    )
    SELECT
      (SELECT AVG(sold_price)                            FROM d90)  AS avg_sold_price,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY sold_price) FROM d90) AS median_sold_price,
      (SELECT AVG(list_price)                            FROM d90)  AS avg_list_price,
      (SELECT AVG(days_on_market)                        FROM d90)  AS avg_dom,
      (SELECT AVG(sold_to_ask_ratio)                     FROM d90)  AS avg_sold_to_ask,
      (SELECT COUNT(*)                                   FROM d90)::int AS sold_count_90days,
      (SELECT COUNT(*)                                   FROM d365)::int AS sold_count_12months,
      (SELECT AVG(sold_price)                            FROM d365) AS avg_365,
      (SELECT avg_prev                                   FROM prev) AS avg_prev,
      (SELECT m FROM peak)                               AS peak_month
  `) as Array<{
    avg_sold_price: string | null;
    median_sold_price: string | null;
    avg_list_price: string | null;
    avg_dom: string | null;
    avg_sold_to_ask: string | null;
    sold_count_90days: number;
    sold_count_12months: number;
    avg_365: string | null;
    avg_prev: string | null;
    peak_month: number | null;
  }>;

  const r = rows[0];
  const avg365 = toNum(r.avg_365);
  const avgPrev = toNum(r.avg_prev);
  const priceChangeYoy = avg365 !== null && avgPrev !== null && avgPrev !== 0
    ? (avg365 - avgPrev) / avgPrev
    : null;
  const temp = classifyTemperature(toNum(r.avg_sold_to_ask), toNum(r.avg_dom));

  await analytics`
    INSERT INTO analytics.street_sold_stats (
      street_slug, avg_sold_price, median_sold_price, avg_list_price,
      avg_dom, avg_sold_to_ask, sold_count_90days, sold_count_12months,
      price_change_yoy, peak_month, market_temperature, last_updated
    ) VALUES (
      ${streetSlug}, ${r.avg_sold_price}, ${r.median_sold_price}, ${r.avg_list_price},
      ${r.avg_dom}, ${r.avg_sold_to_ask}, ${r.sold_count_90days}, ${r.sold_count_12months},
      ${priceChangeYoy}, ${r.peak_month}, ${temp}, NOW()
    )
    ON CONFLICT (street_slug) DO UPDATE SET
      avg_sold_price      = EXCLUDED.avg_sold_price,
      median_sold_price   = EXCLUDED.median_sold_price,
      avg_list_price      = EXCLUDED.avg_list_price,
      avg_dom             = EXCLUDED.avg_dom,
      avg_sold_to_ask     = EXCLUDED.avg_sold_to_ask,
      sold_count_90days   = EXCLUDED.sold_count_90days,
      sold_count_12months = EXCLUDED.sold_count_12months,
      price_change_yoy    = EXCLUDED.price_change_yoy,
      peak_month          = EXCLUDED.peak_month,
      market_temperature  = EXCLUDED.market_temperature,
      last_updated        = NOW()
  `;

  // Monthly breakdown for the last 24 months
  await analytics`
    DELETE FROM analytics.street_monthly_stats WHERE street_slug = ${streetSlug}
  `;
  const monthly = (await sold`
    SELECT
      EXTRACT(YEAR  FROM sold_date)::int AS year,
      EXTRACT(MONTH FROM sold_date)::int AS month,
      AVG(sold_price)        AS avg_sold_price,
      COUNT(*)::int          AS sold_count,
      AVG(days_on_market)    AS avg_dom,
      AVG(sold_to_ask_ratio) AS avg_sold_to_ask
    FROM sold.sold_records
    WHERE street_slug = ${streetSlug}
      AND perm_advertise = TRUE
      AND mls_status = 'Sold'
      AND sold_date >= NOW() - INTERVAL '24 months'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `) as Array<{
    year: number; month: number;
    avg_sold_price: string | null; sold_count: number;
    avg_dom: string | null; avg_sold_to_ask: string | null;
  }>;
  for (const m of monthly) {
    await analytics`
      INSERT INTO analytics.street_monthly_stats
        (street_slug, year, month, avg_sold_price, sold_count, avg_dom, avg_sold_to_ask)
      VALUES
        (${streetSlug}, ${m.year}, ${m.month}, ${m.avg_sold_price}, ${m.sold_count}, ${m.avg_dom}, ${m.avg_sold_to_ask})
    `;
  }

  await invalidateMany([
    `street-stats:${streetSlug}`,
    `street-aggregate:${streetSlug}`,
  ]);
}

export async function computeNeighbourhoodSoldStats(neighbourhood: string): Promise<void> {
  const sold = requireSoldDb();
  const analytics = requireAnalyticsDb();

  const rows = (await sold`
    WITH d90 AS (
      SELECT * FROM sold.sold_records
      WHERE neighbourhood = ${neighbourhood}
        AND perm_advertise = TRUE
        AND mls_status = 'Sold'
        AND sold_date >= NOW() - INTERVAL '90 days'
    ),
    d365 AS (
      SELECT * FROM sold.sold_records
      WHERE neighbourhood = ${neighbourhood}
        AND perm_advertise = TRUE
        AND mls_status = 'Sold'
        AND sold_date >= NOW() - INTERVAL '365 days'
    ),
    prev AS (
      SELECT AVG(sold_price) AS avg_prev FROM sold.sold_records
      WHERE neighbourhood = ${neighbourhood}
        AND perm_advertise = TRUE
        AND mls_status = 'Sold'
        AND sold_date >= NOW() - INTERVAL '730 days'
        AND sold_date <  NOW() - INTERVAL '365 days'
    )
    SELECT
      (SELECT AVG(sold_price) FROM d90 WHERE property_type = 'detached')   AS avg_sold_detached,
      (SELECT AVG(sold_price) FROM d90 WHERE property_type = 'semi')       AS avg_sold_semi,
      (SELECT AVG(sold_price) FROM d90 WHERE property_type = 'townhouse')  AS avg_sold_town,
      (SELECT AVG(sold_price) FROM d90 WHERE property_type = 'condo')      AS avg_sold_condo,
      (SELECT AVG(days_on_market)    FROM d90) AS avg_dom,
      (SELECT AVG(sold_to_ask_ratio) FROM d90) AS avg_sold_to_ask,
      (SELECT COUNT(*)               FROM d90)::int  AS sold_count_90days,
      (SELECT COUNT(*)               FROM d365)::int AS sold_count_12months,
      (SELECT AVG(sold_price)        FROM d365)      AS avg_365,
      (SELECT avg_prev               FROM prev)      AS avg_prev
  `) as Array<{
    avg_sold_detached: string | null;
    avg_sold_semi: string | null;
    avg_sold_town: string | null;
    avg_sold_condo: string | null;
    avg_dom: string | null;
    avg_sold_to_ask: string | null;
    sold_count_90days: number;
    sold_count_12months: number;
    avg_365: string | null;
    avg_prev: string | null;
  }>;

  const r = rows[0];
  const avg365 = toNum(r.avg_365);
  const avgPrev = toNum(r.avg_prev);
  const priceChangeYoy = avg365 !== null && avgPrev !== null && avgPrev !== 0
    ? (avg365 - avgPrev) / avgPrev
    : null;

  // Market score (0-100): 50 baseline, ±25 from YoY appreciation, ±25 from velocity.
  const soldToAsk = toNum(r.avg_sold_to_ask);
  const dom = toNum(r.avg_dom);
  let score: number | null = null;
  if (soldToAsk !== null || priceChangeYoy !== null || dom !== null) {
    const yoyScore  = priceChangeYoy !== null ? Math.max(-25, Math.min(25, priceChangeYoy * 250)) : 0;
    const velScore  = soldToAsk !== null ? Math.max(-25, Math.min(25, (soldToAsk - 0.98) * 500)) : 0;
    const domScore  = dom !== null ? Math.max(-15, Math.min(15, (20 - dom) * 0.5)) : 0;
    score = Math.max(0, Math.min(100, 50 + yoyScore + velScore + domScore));
  }

  await analytics`
    INSERT INTO analytics.neighbourhood_sold_stats (
      neighbourhood, avg_sold_detached, avg_sold_semi, avg_sold_town, avg_sold_condo,
      avg_dom, avg_sold_to_ask, sold_count_90days, sold_count_12months,
      price_change_yoy, market_score, last_updated
    ) VALUES (
      ${neighbourhood}, ${r.avg_sold_detached}, ${r.avg_sold_semi}, ${r.avg_sold_town}, ${r.avg_sold_condo},
      ${r.avg_dom}, ${r.avg_sold_to_ask}, ${r.sold_count_90days}, ${r.sold_count_12months},
      ${priceChangeYoy}, ${score}, NOW()
    )
    ON CONFLICT (neighbourhood) DO UPDATE SET
      avg_sold_detached   = EXCLUDED.avg_sold_detached,
      avg_sold_semi       = EXCLUDED.avg_sold_semi,
      avg_sold_town       = EXCLUDED.avg_sold_town,
      avg_sold_condo      = EXCLUDED.avg_sold_condo,
      avg_dom             = EXCLUDED.avg_dom,
      avg_sold_to_ask     = EXCLUDED.avg_sold_to_ask,
      sold_count_90days   = EXCLUDED.sold_count_90days,
      sold_count_12months = EXCLUDED.sold_count_12months,
      price_change_yoy    = EXCLUDED.price_change_yoy,
      market_score        = EXCLUDED.market_score,
      last_updated        = NOW()
  `;

  await analytics`
    DELETE FROM analytics.neighbourhood_monthly_stats WHERE neighbourhood = ${neighbourhood}
  `;
  const monthly = (await sold`
    SELECT
      EXTRACT(YEAR  FROM sold_date)::int AS year,
      EXTRACT(MONTH FROM sold_date)::int AS month,
      AVG(sold_price)     AS avg_sold_price,
      COUNT(*)::int       AS sold_count,
      AVG(days_on_market) AS avg_dom
    FROM sold.sold_records
    WHERE neighbourhood = ${neighbourhood}
      AND perm_advertise = TRUE
      AND mls_status = 'Sold'
      AND sold_date >= NOW() - INTERVAL '24 months'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `) as Array<{ year: number; month: number; avg_sold_price: string | null; sold_count: number; avg_dom: string | null }>;
  for (const m of monthly) {
    await analytics`
      INSERT INTO analytics.neighbourhood_monthly_stats
        (neighbourhood, year, month, avg_sold_price, sold_count, avg_dom)
      VALUES
        (${neighbourhood}, ${m.year}, ${m.month}, ${m.avg_sold_price}, ${m.sold_count}, ${m.avg_dom})
    `;
  }

  await invalidateMany([
    `neighbourhood-stats:${neighbourhood}`,
    `neighbourhood-aggregate:${neighbourhood}`,
  ]);
}

export async function computeAllStats(): Promise<{
  streets: number; neighbourhoods: number; durationMs: number;
}> {
  const sold = requireSoldDb();
  const t0 = Date.now();

  const streetRows = (await sold`
    SELECT DISTINCT street_slug FROM sold.sold_records
    WHERE perm_advertise = TRUE AND sold_date >= NOW() - INTERVAL '365 days'
  `) as Array<{ street_slug: string }>;

  // Batches of 10 parallel — keeps Neon HTTP pool happy, cuts wall clock ~10x.
  const BATCH = 10;
  for (let i = 0; i < streetRows.length; i += BATCH) {
    await Promise.all(
      streetRows.slice(i, i + BATCH).map((r) => computeStreetSoldStats(r.street_slug))
    );
  }

  const nbhdRows = (await sold`
    SELECT DISTINCT neighbourhood FROM sold.sold_records
    WHERE perm_advertise = TRUE AND sold_date >= NOW() - INTERVAL '365 days'
  `) as Array<{ neighbourhood: string }>;

  for (let i = 0; i < nbhdRows.length; i += BATCH) {
    await Promise.all(
      nbhdRows.slice(i, i + BATCH).map((r) => computeNeighbourhoodSoldStats(r.neighbourhood))
    );
  }

  return {
    streets: streetRows.length,
    neighbourhoods: nbhdRows.length,
    durationMs: Date.now() - t0,
  };
}
