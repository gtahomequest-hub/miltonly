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
//
// A HOUSE IS NOT ONE UNIT TYPE (MH-007 addendum). Measured 2026-09-15 over the 12-month pool:
// of 568 detached leases, 195 were a basement unit and 87 the upper floors only; of 141 semis,
// 19 and 15. A blended detached "typical" of $3,200 sat between a $3,500 whole home and a
// $1,750 basement, describing neither. So each lease is classed from the feed's own markers,
// the unit field ("Bsmt", "Lower", "Upper", "Main & Upper") and the remarks ("legal basement
// apartment", "main floor only", "basement not included"), and the typical rent for a house
// type is stated for the WHOLE HOME, with a BASEMENT UNIT figure beside it where at least
// K_ANON_PRICE leased. Upper-floors-only leases are in the count and in neither figure. A
// condo suite is one unit and is not classed.
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

/** How a lease was classed from the feed's markers. `whole` is the default: no marker. */
export type UnitClass = "whole" | "basement" | "upper";

export interface LeaseTypeFigure {
  type: RentType;
  /** closed leases of the type in the window, every unit class */
  count: number;
  /** whole-home leases, the exact sample behind `typical` (for a condo, every lease) */
  wholeCount: number;
  /** midpoint whole-home rent; null below K_ANON_PRICE */
  typical: number | null;
  /** basement-unit leases; 0 for a condo */
  basementCount: number;
  /** midpoint basement-unit rent; null below K_ANON_PRICE or for a condo */
  basementTypical: number | null;
  /** upper-floors-only leases, counted and stated in neither figure */
  upperCount: number;
}

export interface LeaseMarket {
  /** closed leases in the last 12 months, Milton-wide */
  count: number;
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

/** The unit-class markers, as Postgres regexes (case-insensitive via ~*). The unit field is
 *  the feed's UnitNumber, which a listing of part of a house carries as words; the remarks
 *  patterns name the unit as what is offered, not as a feature of a whole home ("finished
 *  basement" is a feature; "basement apartment" is the unit). A basement phrase counts only
 *  in the opening of the remarks, where a listing says what it is; a whole home that mentions
 *  its basement apartment does so later. Measured 2026-09-15: "legal basement" and "main and
 *  second floor" without "only" classed whole townhomes wrongly and were dropped. */
export const REMARKS_LEAD = 120;
export const UNIT_BASEMENT = "(bsmt|bsmnt|bsment|basement|basemnt|basmt|lower|lwr|\\mll\\M)";
export const REMARKS_BASEMENT = "(basement (apartment|unit|suite|apt)|lower[- ]level (unit|apartment|apt|suite)|\\mbsmt\\M)";
export const UNIT_UPPER = "(upper|upr|upl|\\mmain\\M|\\mmn\\M|ground|grnd|1st|first|2nd)";
export const REMARKS_UPPER = "((upper|main) (level|floor)s? only|main (and|&) (second|upper|2nd) (floors?|levels?) only|excluding (the )?basement|basement (is )?not included|basement excluded|no (access to (the )?)?basement( access)?|upper (two|2) (levels|floors) only)";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The empty market: no DB2, or nothing closed. Every figure suppressed, every count 0. */
const emptyType = (type: RentType): LeaseTypeFigure => ({ type, count: 0, wholeCount: 0, typical: null, basementCount: 0, basementTypical: null, upperCount: 0 });
const EMPTY: LeaseMarket = {
  count: 0,
  days: null,
  leasedToAsk: null,
  byType: RENT_TYPES.map(emptyType),
  window: WINDOW,
  through: null,
};

/** The last 12 months of closed Milton leases, overall and by home type, k-gated. */
export async function getLeaseMarket(): Promise<LeaseMarket> {
  const db = getSoldDb();
  if (!db) return EMPTY;
  // v3: the classed shape with the tightened markers (MH-007 addendum). The key is versioned because Upstash is shared
  // across builds, and a cached row of the old shape would be read as the new one for an hour.
  const day = new Date().toISOString().slice(0, 10);
  return cached(`home:lease-market:v3:${day}`, CACHE_TTL.stats, async () => {
    type AllRow = { n: number; dom: unknown; ratio: unknown; latest: unknown };
    type ClassRow = { property_type: string; unit_class: string; n: number; typical: unknown };
    const [all, classes] = await Promise.all([
      db`
        SELECT COUNT(*)::int AS n,
               AVG(days_on_market) AS dom,
               AVG(sold_price::float / NULLIF(list_price, 0)) AS ratio,
               MAX(sold_date) AS latest
        FROM sold.sold_records
        WHERE city = ${config.PRISMA_CITY_VALUE} AND perm_advertise = TRUE
          AND transaction_type = 'For Lease'
          AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
      `.then((rows) => rows as AllRow[]),
      // THE UNIT CLASS, from the feed's own markers. The unit field first ("Bsmt", "Lower",
      // "Upper", "Main & Upper"), then the remarks; a basement marker wins over an upper one
      // because a whole-home remark can mention its upper floors, but only a basement lease
      // calls itself a basement apartment. A condo suite is one unit: its class is `whole`.
      // Postgres regex: \m and \M are word boundaries (doubled for the JS template).
      db`
        WITH pool AS (
          SELECT property_type, sold_price,
                 CASE
                   WHEN property_type = 'condo' THEN 'whole'
                   WHEN COALESCE(unit_number, '') ~* ${UNIT_BASEMENT}
                     OR LEFT(COALESCE(public_remarks, ''), ${REMARKS_LEAD}) ~* ${REMARKS_BASEMENT} THEN 'basement'
                   WHEN COALESCE(unit_number, '') ~* ${UNIT_UPPER}
                     OR COALESCE(public_remarks, '') ~* ${REMARKS_UPPER} THEN 'upper'
                   ELSE 'whole'
                 END AS unit_class
          FROM sold.sold_records
          WHERE city = ${config.PRISMA_CITY_VALUE} AND perm_advertise = TRUE
            AND transaction_type = 'For Lease'
            AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
        )
        SELECT property_type, unit_class, COUNT(*)::int AS n,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS typical
        FROM pool
        GROUP BY property_type, unit_class
      `.then((rows) => rows as ClassRow[]),
    ]);
    const r = all[0];
    const count = Number(r?.n ?? 0);
    // THE FLOOR IS CHECKED AGAINST THE SAMPLE EACH FIGURE IS COMPUTED OVER: the two overall
    // figures share the pool of `count`; each type's whole-home typical has the whole-home
    // count and its basement typical the basement count.
    const gate = <T>(n: number, v: T | null): T | null => (n >= K_ANON_PRICE ? v : null);
    const latest = r?.latest instanceof Date ? r.latest : r?.latest ? new Date(String(r.latest)) : null;
    const cell = (type: string, cls: UnitClass) => classes.find((c) => c.property_type === type && c.unit_class === cls);
    return {
      count,
      days: gate(count, num(r?.dom)),
      leasedToAsk: gate(count, num(r?.ratio)),
      byType: RENT_TYPES.map((type) => {
        const whole = cell(type, "whole");
        const basement = cell(type, "basement");
        const upper = cell(type, "upper");
        const wholeCount = Number(whole?.n ?? 0);
        const basementCount = Number(basement?.n ?? 0);
        const upperCount = Number(upper?.n ?? 0);
        return {
          type,
          count: wholeCount + basementCount + upperCount,
          wholeCount,
          typical: gate(wholeCount, num(whole?.typical)),
          basementCount,
          basementTypical: gate(basementCount, num(basement?.typical)),
          upperCount,
        };
      }),
      window: WINDOW,
      through: latest && !Number.isNaN(latest.getTime()) ? latest.toISOString().slice(0, 10) : null,
    };
  });
}
