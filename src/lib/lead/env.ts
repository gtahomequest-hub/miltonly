// Which deployment is producing a lead row.
//
// Preview and production share ONE database — same Neon host, same `Lead` table — so a
// preview submission is indistinguishable from a real lead unless it is tagged at write
// time. Every count and every ops alert reads this.
//
// The host matters as well as the env var. `.env.local` in this repo carries
// VERCEL_ENV="production", so a local dev server would otherwise write rows claiming to be
// production. On Vercel that variable comes from the platform and is correct; locally the
// request host is the thing that cannot lie.

export type LeadEnv = "production" | "preview" | "development";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i;

export function resolveLeadEnv(host?: string | null): LeadEnv {
  if (host && LOCAL_HOST.test(host.trim())) return "development";
  const v = (process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (v === "preview") return "preview";
  if (v === "production") return "production";
  return "development";
}

/** Only production rows are counted and only production leads raise an ops alert. */
export function isCountable(env: LeadEnv): boolean {
  return env === "production";
}

/** Escape hatch for PROVING the alert path on a preview deployment. Off unless the
 *  variable is set in the Preview environment, and it only ever adds a prefixed alert —
 *  it cannot make a preview row countable. */
export function alertsForcedOnNonProduction(): boolean {
  return process.env.LEAD_ALERTS_ON_PREVIEW === "true";
}
