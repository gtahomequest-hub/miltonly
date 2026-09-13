// The periods the weekly leads digest reports on, and the hour it sends at.
//
// The digest goes out Monday 07:00 America/Toronto and reports the 7 and the 28 local calendar
// days that ended at midnight, so "last 7 days" is the whole week just finished, Monday to
// Sunday, and "last 28 days" is the four whole weeks ending the same Sunday. Neither window
// reaches into the sending day: a figure that includes the first seven hours of a Monday is a
// figure that changes if the report is re-run at noon.
//
// THE SAME TWO BASES THE BRIEF CARRIES (src/lib/brief/window.ts). `Lead.createdAt`,
// `SavedSearch.createdAt`, `SavedSearch.lastAlertAt` and `LeadActivity.createdAt` are real
// timestamps and are read on the Toronto instants. `lead_daily_by_page.day` is a DATE column
// and is read on the date pair. A query picks the basis that matches its column; there is no
// default. The view itself buckets a lead by its UTC calendar day (see the Phase 1 migration),
// so a lead submitted after 20:00 Toronto sits on the following day's row. That is the view's
// definition, not this window's; it is stated in the digest and recorded as open.
//
// THE HOUR. Vercel cron schedules are UTC and carry no timezone. 07:00 Toronto is 11:00 UTC in
// EDT and 12:00 UTC in EST, so vercel.json registers both `0 11 * * 1` and `0 12 * * 1`, and the
// route runs only when the Toronto hour is 7. The other firing is refused. This is the pattern
// /api/content/market-watch established for its 08:00 send.

import { localMidnightUtc, localDate, dayOfWeek } from "@/lib/brief/window";

const ZONE = "America/Toronto";

/** The hour the digest sends, Toronto local. */
export const DIGEST_HOUR = 7;

export interface DigestPeriod {
  /** REAL TIMESTAMPS. Inclusive UTC instant of local midnight starting the period. */
  start: Date;
  /** REAL TIMESTAMPS. Exclusive UTC instant of local midnight ending it. */
  end: Date;
  /** DATE COLUMNS. Inclusive, UTC midnight of the first local date. */
  dateStartUtc: Date;
  /** DATE COLUMNS. EXCLUSIVE, UTC midnight of the local date after the last one. */
  dateEndExclusiveUtc: Date;
  /** First and last local calendar dates inside the period, ISO. */
  firstDate: string;
  lastDate: string;
  days: number;
}

export interface DigestWindow {
  /** The seven local days ending yesterday. */
  week: DigestPeriod;
  /** The twenty-eight local days ending yesterday. */
  month: DigestPeriod;
  /** The last local date reported, ISO. The digest's identity. */
  asOf: string;
  /** ISO date of the local day the digest was computed on. */
  sentOn: string;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function period(y: number, m: number, d: number, days: number): DigestPeriod {
  const end = localMidnightUtc(y, m, d);
  const back = new Date(Date.UTC(y, m - 1, d) - days * 86_400_000);
  const [sy, sm, sd] = [back.getUTCFullYear(), back.getUTCMonth() + 1, back.getUTCDate()];
  const last = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  return {
    start: localMidnightUtc(sy, sm, sd),
    end,
    dateStartUtc: new Date(Date.UTC(sy, sm - 1, sd)),
    dateEndExclusiveUtc: new Date(Date.UTC(y, m - 1, d)),
    firstDate: iso(sy, sm, sd),
    lastDate: iso(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate()),
    days,
  };
}

/** The periods a digest computed at `now` reports: the 7 and 28 local days ending yesterday. */
export function digestWindow(now: Date = new Date()): DigestWindow {
  const [y, m, d] = localDate(now);
  const week = period(y, m, d, 7);
  const month = period(y, m, d, 28);
  return { week, month, asOf: week.lastDate, sentOn: iso(y, m, d) };
}

/** The Toronto local hour of `at`, 0 to 23. */
export function localHour(at: Date): number {
  const h = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, hourCycle: "h23", hour: "2-digit" }).format(at);
  return Number(h);
}

/** Whether `now` is the one firing that lands on Monday 07:00 Toronto. */
export function isDigestSlot(now: Date = new Date()): { ok: boolean; hour: number; dow: number } {
  const [y, m, d] = localDate(now);
  const dow = dayOfWeek(y, m, d);
  const hour = localHour(now);
  return { ok: dow === 1 && hour === DIGEST_HOUR, hour, dow };
}
