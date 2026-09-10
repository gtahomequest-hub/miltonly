// src/lib/marketWatch/windows.ts
//
// Every date window the Content tier uses, and the k-gates on what each one
// may publish.
//
// RULING 10, 2026-09-10 — EVERY WINDOW IS BOUNDED TO TODAY. `sold.sold_records`
// holds 192 For Sale rows and 53 For Lease rows with a `sold_date` in the
// future, the furthest at 2027-01-29 (report 063). An unbounded 28-day
// neighbourhood count returns 327 rows where the bounded one returns 135. A
// window that forgets `sold_date <= NOW()` does not fail; it publishes a number
// inflated 2.4x and reports sales that have not happened. Every query in this
// file carries the upper bound, and any query added later must too. The
// future-dated rows themselves are a Core data bug, logged, not fixed here.
//
// RULING 9 — the weekly typical is the headline. Measured over the last twelve
// complete weeks the town-wide count runs 26 to 67 (report 063), so the weekly
// figure clears K_ANON_PRICE and K_ANON_RANGE in every week measured. The gate
// is still applied per edition and never assumed: a thin week publishes null
// and a plain sentence saying the week was thin. Never 0.
//
// LEASE IS OUT OF V1. Weekly lease counts read 130, 6, 4, 51, 14, 15, 127, 5,
// 20, 3, 23 over the same period. Those spikes are ingest stamping rather than
// a market: the lease buckets have no close date and proxy through
// `updatedAt`, a caveat the daily-summary route already carries.

import "server-only";
import { DateTime } from "luxon";
import { getSoldDb } from "@/lib/db";
import { config } from "@/lib/config";
import { K_ANON_PRICE, K_ANON_RANGE } from "@/lib/kAnon";

const CITY = config.PRISMA_CITY_VALUE;
const ZONE = "America/Toronto";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
};
/** Nearest $5k — the sitewide convention, so a Market Watch figure renders
 *  byte-identical to the same figure on /sold and on a hub. */
const round5k = (v: number | null): number | null => (v === null ? null : Math.round(v / 5000) * 5000);

// ── the week ──────────────────────────────────────────────────────────────

// TWO BASES FOR ONE WEEK, AND THE REASON.
//
// `sold.sold_records.sold_date` is a `timestamp with time zone` whose every
// value is EXACTLY UTC midnight: it is a calendar date wearing a timestamp
// type. Measured 2026-09-10 across all 3,961 Milton For Sale rows, the
// distinct time-of-day count is one, and it is 00:00:00 UTC.
//
// A Toronto-midnight window therefore does NOT select the Toronto week from
// that column. Monday 00:00 Toronto is 04:00 UTC, which is four hours AFTER
// every Monday row was stamped, so the whole first day falls out and part of
// the following Monday falls in. Caught on the first real edition: the week of
// 2026-08-31 returned 18 sales where the day-by-day count is 22+5+2+4+7 = 40.
//
// DB1's `Listing.listedAt` is the opposite: a real timestamp with a real
// time-of-day. Toronto instants are correct there and UTC-midnight bounds
// would shift it four hours.
//
// So a week carries both bases, named for what they are, and each query uses
// the one that matches its column. Neither is a default.
export interface WeekWindow {
  /** The Monday the week commences, YYYY-MM-DD. The URL segment. */
  weekOf: string;
  /** DATE-STAMPED COLUMNS (DB2 sold_date). Inclusive, UTC midnight Monday. */
  dateStartUtc: Date;
  /** DATE-STAMPED COLUMNS. EXCLUSIVE, UTC midnight of the FOLLOWING Monday. */
  dateEndExclusiveUtc: Date;
  /** REAL TIMESTAMPS (DB1 listedAt). Inclusive, 00:00:00 Toronto Monday. */
  startUtc: Date;
  /** REAL TIMESTAMPS. Inclusive, 23:59:59.999 Toronto Sunday. */
  endUtc: Date;
  label: string;
}

function makeWeek(monday: DateTime): WeekWindow {
  const sunday = monday.plus({ days: 6 }).endOf("day");
  const weekOf = monday.toFormat("yyyy-MM-dd");
  return {
    weekOf,
    dateStartUtc: new Date(`${weekOf}T00:00:00.000Z`),
    dateEndExclusiveUtc: new Date(`${monday.plus({ days: 7 }).toFormat("yyyy-MM-dd")}T00:00:00.000Z`),
    startUtc: monday.toUTC().toJSDate(),
    endUtc: sunday.toUTC().toJSDate(),
    label: `week of ${monday.toFormat("d LLLL yyyy")}`,
  };
}

/** The most recent COMPLETE Monday-to-Sunday week, in Toronto time. An edition
 *  never covers a week still in progress: a partial week's count is not a
 *  weekly count, and the edition is immutable once written. */
export function lastCompleteWeek(now: Date = new Date()): WeekWindow {
  const t = DateTime.fromJSDate(now, { zone: ZONE });
  // startOf("week") is Monday in Luxon. The week containing `now` is still
  // running, so step back one.
  return makeWeek(t.startOf("week").minus({ weeks: 1 }));
}

/** The week identified by its Monday, for an archived edition. */
export function weekFromMonday(weekOf: string): WeekWindow | null {
  const monday = DateTime.fromFormat(weekOf, "yyyy-MM-dd", { zone: ZONE });
  if (!monday.isValid || monday.weekday !== 1) return null;
  return makeWeek(monday);
}

// ── weekly sale figures, town-wide ────────────────────────────────────────

export interface WeeklySales {
  count: number;
  /** k >= K_ANON_PRICE. Null below, never 0. */
  typicalPrice: number | null;
  /** k >= K_ANON_RANGE, the middle-half band. */
  bandLow: number | null;
  bandHigh: number | null;
  /** k >= K_ANON_PRICE. */
  avgDom: number | null;
  soldToAskPct: number | null;
}

export async function getWeeklySales(w: WeekWindow): Promise<WeeklySales> {
  const db = getSoldDb();
  const empty: WeeklySales = {
    count: 0, typicalPrice: null, bandLow: null, bandHigh: null, avgDom: null, soldToAskPct: null,
  };
  if (!db) return empty;

  const rows = (await db`
    SELECT
      COUNT(*)::int AS n,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS median,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sold_price) AS p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sold_price) AS p75,
      AVG(days_on_market) AS dom,
      AVG(CASE WHEN list_price > 0 THEN sold_price::numeric / list_price END) AS sta
    FROM sold.sold_records
    WHERE city = ${CITY}
      AND perm_advertise = TRUE
      AND transaction_type = 'For Sale'
      AND sold_date >= ${w.dateStartUtc}
      AND sold_date < ${w.dateEndExclusiveUtc}
      AND sold_date <= NOW()
  `) as Array<Record<string, unknown>>;

  const r = rows[0];
  if (!r) return empty;
  const n = num(r.n) ?? 0;
  const sta = num(r.sta);
  return {
    count: n,
    typicalPrice: n >= K_ANON_PRICE ? round5k(num(r.median)) : null,
    bandLow: n >= K_ANON_RANGE ? round5k(num(r.p25)) : null,
    bandHigh: n >= K_ANON_RANGE ? round5k(num(r.p75)) : null,
    avgDom: n >= K_ANON_PRICE && num(r.dom) !== null ? Math.round(num(r.dom) as number) : null,
    soldToAskPct: n >= K_ANON_PRICE && sta !== null ? Math.round(sta * 1000) / 10 : null,
  };
}

/** The same shape for the week BEFORE, so the edition can state a change as a
 *  count. Deltas are counts, never percentages: a percentage on a base of
 *  eleven is noise wearing a decimal point. */
export function previousWeek(w: WeekWindow): WeekWindow {
  return makeWeek(DateTime.fromFormat(w.weekOf, "yyyy-MM-dd", { zone: ZONE }).minus({ weeks: 1 }));
}

// ── the 28-day by-form block ──────────────────────────────────────────────
//
// Ruling 9: ships with the same gates per form. A form clears k5 for a point
// and k10 for a band on its OWN count, checked per edition. Measured
// 2026-09-10: detached 71, townhouse 37, condo 14, semi 13 — so a point for
// all four and a band for two. Those are measurements, not guarantees, and the
// gate is what decides each week.

export interface FormRow {
  slug: "detached" | "semi" | "townhouse" | "condo";
  label: string;
  count: number;
  typicalPrice: number | null; // k >= 5
  bandLow: number | null;      // k >= 10
  bandHigh: number | null;     // k >= 10
}

const FORMS: Array<{ slug: FormRow["slug"]; label: string }> = [
  { slug: "detached", label: "Detached" },
  { slug: "semi", label: "Semi-detached" },
  { slug: "townhouse", label: "Townhouse" },
  { slug: "condo", label: "Condo" },
];

export interface TrailingWindow {
  startUtc: Date;
  endExclusiveUtc: Date;
  days: number;
  label: string;
}

/** A trailing window ending at the covered week's Sunday, never at "now" — an
 *  archived edition must recompute to the same numbers a year later. */
export function trailingWindow(w: WeekWindow, days = 28): TrailingWindow {
  // Date-stamped basis, like every other DB2 window here, and ending at the
  // covered week's exclusive end rather than at "now" — an archived edition
  // must recompute to the same numbers a year later.
  const endExclusive = w.dateEndExclusiveUtc;
  const start = new Date(endExclusive.getTime() - days * 86_400_000);
  return {
    startUtc: start,
    endExclusiveUtc: endExclusive,
    days,
    label: `trailing ${days} days`,
  };
}

export async function getByForm(t: TrailingWindow): Promise<FormRow[]> {
  const db = getSoldDb();
  if (!db) return [];
  const rows = (await db`
    SELECT property_type,
      COUNT(*)::int AS n,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS median,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sold_price) AS p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sold_price) AS p75
    FROM sold.sold_records
    WHERE city = ${CITY}
      AND perm_advertise = TRUE
      AND transaction_type = 'For Sale'
      AND sold_date >= ${t.startUtc}
      AND sold_date < ${t.endExclusiveUtc}
      AND sold_date <= NOW()
    GROUP BY property_type
  `) as Array<Record<string, unknown>>;

  const by = new Map(rows.map((r) => [String(r.property_type), r]));
  return FORMS.map((f) => {
    const r = by.get(f.slug);
    const n = r ? num(r.n) ?? 0 : 0;
    return {
      slug: f.slug,
      label: f.label,
      count: n,
      typicalPrice: n >= K_ANON_PRICE && r ? round5k(num(r.median)) : null,
      bandLow: n >= K_ANON_RANGE && r ? round5k(num(r.p25)) : null,
      bandHigh: n >= K_ANON_RANGE && r ? round5k(num(r.p75)) : null,
    };
  });
}

// ── where it happened ─────────────────────────────────────────────────────
//
// COUNTS ONLY, per neighbourhood, for the week. No weekly neighbourhood price
// at any n: about one to two sales per neighbourhood per week, so a figure
// would suppress nearly always and, on the weeks it did not, would describe
// two houses. The 12-month typical shown beside each row comes from
// getMiltonSoldByNeighbourhood, the hub's own statistic, and is labelled with
// its own window so the two cannot be read as one number.

export interface NeighbourhoodWeekRow {
  neighbourhood: string;
  count: number;
}

export async function getNeighbourhoodCounts(w: WeekWindow): Promise<NeighbourhoodWeekRow[]> {
  const db = getSoldDb();
  if (!db) return [];
  const rows = (await db`
    SELECT neighbourhood, COUNT(*)::int AS n
    FROM sold.sold_records
    WHERE city = ${CITY}
      AND perm_advertise = TRUE
      AND transaction_type = 'For Sale'
      AND sold_date >= ${w.dateStartUtc}
      AND sold_date < ${w.dateEndExclusiveUtc}
      AND sold_date <= NOW()
      AND neighbourhood IS NOT NULL
    GROUP BY neighbourhood
    ORDER BY n DESC
  `) as Array<Record<string, unknown>>;
  return rows
    .map((r) => ({ neighbourhood: String(r.neighbourhood ?? "").trim(), count: num(r.n) ?? 0 }))
    .filter((r) => r.neighbourhood.length > 0);
}

// ── streets that moved ────────────────────────────────────────────────────
//
// A COUNT per street slug, and only for streets that already have a published
// page. No price at street level in a week: one street in one week is a
// population of one or two houses. The count is what licenses the link.

export interface StreetWeekRow {
  streetSlug: string;
  count: number;
}

export async function getStreetCounts(w: WeekWindow): Promise<StreetWeekRow[]> {
  const db = getSoldDb();
  if (!db) return [];
  const rows = (await db`
    SELECT street_slug, COUNT(*)::int AS n
    FROM sold.sold_records
    WHERE city = ${CITY}
      AND perm_advertise = TRUE
      AND transaction_type = 'For Sale'
      AND sold_date >= ${w.dateStartUtc}
      AND sold_date < ${w.dateEndExclusiveUtc}
      AND sold_date <= NOW()
      AND street_slug IS NOT NULL
    GROUP BY street_slug
    ORDER BY n DESC
  `) as Array<Record<string, unknown>>;
  return rows
    .map((r) => ({ streetSlug: String(r.street_slug ?? "").trim(), count: num(r.n) ?? 0 }))
    .filter((r) => r.streetSlug.length > 0);
}
