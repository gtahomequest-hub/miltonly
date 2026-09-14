// src/lib/rentSignals.ts
// THE LEASE MARKET, AS THE RENT MENU STATES IT (MH-007).
//
// Two sources, kept apart the way the sale side keeps them apart. What is FOR RENT is DB1's
// live feed: `transactionType='For Lease'` with `leaseStatus='active'` (a lease row is
// `status='rented'` for its whole life; see rentalsAvailable.ts), and those are counts of
// listings on the public MLS, public by construction. What was LEASED is DB2's
// `sold.sold_records` with `transaction_type='For Lease'`, and every figure derived from it is
// gated at the same floors the sold side uses: a typical rent needs K_ANON_PRICE closed
// leases behind it, checked against the exact sample the figure is computed over (each home
// type's own count for each home type's own typical), and below the floor the menu says the
// sample is too small rather than printing a number. Suppression is null, never 0.
//
// "Typical" is the midpoint of the pool, the statistic the hero, the Board and the homepage's
// month-to-date figure all publish (PERCENTILE_CONT(0.5)), so the menu cannot state a
// different kind of typical from the page under it.
import { config } from "@/lib/config";
import { getSoldDb } from "@/lib/db";
import { cached, CACHE_TTL } from "@/lib/cache";
import { K_ANON_PRICE } from "@/lib/kAnon";

/** The four geometry buckets DB2's property_type carries, in the order the panel lists them. */
export const RENT_TYPES = ["detached", "semi", "townhouse", "condo"] as const;
export type RentType = (typeof RENT_TYPES)[number];
export const RENT_TYPE_LABEL: Record<RentType, string> = {
  detached: "Detached",
  semi: "Semi-detached",
  townhouse: "Townhouse",
  condo: "Condo",
};

export interface LeaseTypeFigure {
  type: RentType;
  /** closed leases in the window, the exact sample behind `typical` */
  count: number;
  /** midpoint rent; null below K_ANON_PRICE */
  typical: number | null;
}

export interface LeaseMarket {
  /** closed leases in the last 12 months, Milton-wide */
  count: number;
  /** midpoint rent over that pool; null below K_ANON_PRICE */
  typical: number | null;
  /** mean days on market over that pool; null below K_ANON_PRICE */
  days: number | null;
  /** mean leased-to-ask RATIO (not a percent) over that pool; null below K_ANON_PRICE */
  leasedToAsk: number | null;
  byType: LeaseTypeFigure[];
  /** the window, in words, for the figure captions */
  window: string;
  /** ISO date of the latest closed lease in the pool; the panel states it in prose */
  through: string | null;
}

const WINDOW = "last 12 months";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The empty market: no DB2, or nothing closed. Every figure suppressed, every count 0. */
const EMPTY: LeaseMarket = {
  count: 0,
  typical: null,
  days: null,
  leasedToAsk: null,
  byType: RENT_TYPES.map((type) => ({ type, count: 0, typical: null })),
  window: WINDOW,
  through: null,
};

/** The last 12 months of closed Milton leases, overall and by home type, k-gated. */
export async function getLeaseMarket(): Promise<LeaseMarket> {
  const db = getSoldDb();
  if (!db) return EMPTY;
  const day = new Date().toISOString().slice(0, 10);
  return cached(`home:lease-market:${day}`, CACHE_TTL.stats, async () => {
    type AllRow = { n: number; typical: unknown; dom: unknown; ratio: unknown; latest: unknown };
    type TypeRow = { property_type: string; n: number; typical: unknown };
    const [all, types] = await Promise.all([
      db`
        SELECT COUNT(*)::int AS n,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS typical,
               AVG(days_on_market) AS dom,
               AVG(sold_price::float / NULLIF(list_price, 0)) AS ratio,
               MAX(sold_date) AS latest
        FROM sold.sold_records
        WHERE city = ${config.PRISMA_CITY_VALUE} AND perm_advertise = TRUE
          AND transaction_type = 'For Lease'
          AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
      `.then((rows) => rows as AllRow[]),
      db`
        SELECT property_type, COUNT(*)::int AS n,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS typical
        FROM sold.sold_records
        WHERE city = ${config.PRISMA_CITY_VALUE} AND perm_advertise = TRUE
          AND transaction_type = 'For Lease'
          AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
        GROUP BY property_type
      `.then((rows) => rows as TypeRow[]),
    ]);
    const r = all[0];
    const count = Number(r?.n ?? 0);
    // THE FLOOR IS CHECKED AGAINST THE SAMPLE EACH FIGURE IS COMPUTED OVER: the three overall
    // figures share the pool of `count`, each type's typical has its own.
    const gate = <T>(n: number, v: T | null): T | null => (n >= K_ANON_PRICE ? v : null);
    const latest = r?.latest instanceof Date ? r.latest : r?.latest ? new Date(String(r.latest)) : null;
    const byRow = new Map(types.map((t) => [t.property_type, t]));
    return {
      count,
      typical: gate(count, num(r?.typical)),
      days: gate(count, num(r?.dom)),
      leasedToAsk: gate(count, num(r?.ratio)),
      byType: RENT_TYPES.map((type) => {
        const row = byRow.get(type);
        const n = Number(row?.n ?? 0);
        return { type, count: n, typical: gate(n, num(row?.typical)) };
      }),
      window: WINDOW,
      through: latest && !Number.isNaN(latest.getTime()) ? latest.toISOString().slice(0, 10) : null,
    };
  });
}
