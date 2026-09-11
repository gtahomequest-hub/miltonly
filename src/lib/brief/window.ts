// The period a brief edition reports on, in the only timezone its reader lives in.
//
// TWO THINGS A NAIVE WINDOW GETS WRONG, and both of them show up in the copy rather than in
// an error:
//
//   1. The cron fires in UTC and the subscriber is in Milton. `NOW() - 1 day` straddles two
//      local days for four hours of every year and lands an hour off on the two clock-change
//      days, which are exactly the days a reader would notice. The window is computed as two
//      UTC instants bounding whole America/Toronto calendar days, so the SQL stays a plain
//      range scan on an indexed timestamp and no query has to know about timezones.
//
//      THAT IS THE BASIS FOR A REAL TIMESTAMP ONLY. `sold.sold_records.sold_date` is a
//      calendar date wearing a timestamptz type: every value is exactly 00:00 UTC (see
//      src/lib/marketWatch/windows.ts, "TWO BASES FOR ONE WEEK"). Toronto midnight is 04:00
//      UTC, so the Toronto instants for the 9th select nothing stamped on the 9th and
//      everything stamped on the 10th. The 2026-09-09 edition read 3 sales where the day
//      holds 8, and the 3 were the next day's. A window therefore carries both bases, each
//      named for the column it fits, the same way a Market Watch week does. Neither is a
//      default; the query picks the one that matches its column.
//
//   2. The brief sends Monday to Friday. A literal "yesterday" would mean Saturday's activity
//      was never reported to anyone, ever: Sunday's edition does not exist and Monday's would
//      cover Sunday. Monday's edition therefore covers the whole weekend and says so. Nothing
//      that moved in Milton goes unreported, and the label always names the period it read.

const ZONE = "America/Toronto";

export interface BriefWindow {
  /** REAL TIMESTAMPS (DB1 listedAt, lastPriceChangeAt). Inclusive UTC instant of local midnight starting the period. */
  start: Date;
  /** REAL TIMESTAMPS. Exclusive UTC instant of local midnight ending it. */
  end: Date;
  /** DATE-STAMPED COLUMNS (DB2 sold_date, 00:00 UTC). Inclusive, UTC midnight of the first local date. */
  dateStartUtc: Date;
  /** DATE-STAMPED COLUMNS. EXCLUSIVE, UTC midnight of the local date after the last one. */
  dateEndExclusiveUtc: Date;
  /** The last local calendar date inside the period, ISO. The edition's identity. */
  date: string;
  /** What the copy calls the period: "yesterday", or "over the weekend" on a Monday. */
  label: string;
  /** How many local days it covers. 1 on most days, 2 on a Monday. */
  days: number;
}

/** The offset of `at` from UTC in the zone, in minutes. Positive means ahead of UTC. */
function zoneOffsetMinutes(at: Date): number {
  // Formatting the same instant as if it were UTC and subtracting gives the offset with no
  // dependency. `en-CA` yields ISO-shaped parts, which read unambiguously.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The UTC instant of local midnight starting the given local calendar date. */
function localMidnightUtc(year: number, month: number, day: number): Date {
  // Guess with the offset that applies at local noon, then correct once. One correction is
  // enough: an offset shift is an hour, and the corrected instant lands on the same side of
  // any transition.
  const noonish = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = zoneOffsetMinutes(noonish);
  const first = new Date(Date.UTC(year, month - 1, day) - offset * 60000);
  const corrected = zoneOffsetMinutes(first);
  if (corrected === offset) return first;
  return new Date(Date.UTC(year, month - 1, day) - corrected * 60000);
}

/** The local calendar date containing `at`, as [year, month, day]. */
function localDate(at: Date): [number, number, number] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = fmt.format(at).split("-").map(Number);
  return [y, m, d];
}

/** Day of week for a local calendar date. 0 is Sunday. */
function dayOfWeek(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The period the edition sent on `now` reports. Yesterday, or the weekend on a Monday. */
export function briefWindow(now: Date = new Date()): BriefWindow {
  const [y, m, d] = localDate(now);
  const today = dayOfWeek(y, m, d);
  // Monday reaches back across Sunday to Saturday; every other sending day reaches back one.
  const days = today === 1 ? 2 : 1;

  const end = localMidnightUtc(y, m, d);
  const back = new Date(Date.UTC(y, m - 1, d) - days * 86_400_000);
  const [sy, sm, sd] = [back.getUTCFullYear(), back.getUTCMonth() + 1, back.getUTCDate()];
  const start = localMidnightUtc(sy, sm, sd);

  const last = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  const date = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;

  // The date basis: the same local calendar dates, as the 00:00 UTC stamps sold_date carries.
  const dateStartUtc = new Date(Date.UTC(sy, sm - 1, sd));
  const dateEndExclusiveUtc = new Date(Date.UTC(y, m - 1, d));

  return {
    start,
    end,
    dateStartUtc,
    dateEndExclusiveUtc,
    date,
    label: days === 2 ? "over the weekend" : "yesterday",
    days,
  };
}

/** Whether today, locally, is a sending day. The brief runs Monday to Friday. */
export function isSendingDay(now: Date = new Date()): boolean {
  const [y, m, d] = localDate(now);
  const dow = dayOfWeek(y, m, d);
  return dow >= 1 && dow <= 5;
}
