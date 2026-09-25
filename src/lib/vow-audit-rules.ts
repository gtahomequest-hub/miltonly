// The audit trail's rules that need no imports (MP-006), so scripts/export-vow-access-log.ts
// and the prebuild can read them without the database client: the suspicious-activity
// thresholds and the CSV cell. src/lib/vow-audit.ts re-exports them and is the one that writes.

/** A consumer reading records on more streets, neighbourhoods or listings than this in a day
 *  is a review item. A household comparing a few streets does not reach it; a scraper does. */
export const SUSPICIOUS_SCOPES_PER_DAY = 40;
/** And more rows than this in a day, regardless of scope: a script re-reading one street. */
export const SUSPICIOUS_READS_PER_DAY = 400;

/** The threshold rule, pure. */
export function isSuspicious(distinctScopes: number, reads: number, days = 1): boolean {
  return distinctScopes > SUSPICIOUS_SCOPES_PER_DAY * days || reads > SUSPICIOUS_READS_PER_DAY * days;
}

/** One CSV cell. Quotes commas, quotes and newlines; and a cell that a spreadsheet would read
 *  as a formula (a leading =, +, -, @, tab or CR: the user agent and the street slug are the
 *  consumer's own bytes) is prefixed with an apostrophe so it stays text when Aamir opens the
 *  file and forwards it. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const ACCESS_CSV_HEADER = ["at", "userId", "email", "name", "registrant", "reviewFlag", "kind", "scope", "path", "recordCount", "ip", "userAgent"] as const;
