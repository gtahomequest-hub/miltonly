// MA-008. Shared pieces of the morning report: the environment, a counted fetch, dates in
// Toronto time, number formatting, and the small-sample rules every rate on the page obeys.
//
// NOTHING HERE PRINTS A SECRET. Tokens are read from process.env, sent as headers, and never
// interpolated into a log line, a report or an error message. redact() strips any value that
// looks like one before an error is written anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../verify/lib/env.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..', '..');
export const OUT = path.join(REPO, 'scratchpad', 'audit', 'morning');
export const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
export const RULES = JSON.parse(fs.readFileSync(path.join(HERE, 'rules.json'), 'utf8'));

loadEnv();

const SECRET_KEYS = ['VERCEL_API_TOKEN', 'NEON_API_KEY', 'RESEND_API_KEY', 'DATABASE_URL', 'SOLD_DATABASE_URL', 'ANALYTICS_DATABASE_URL', 'GSC_SERVICE_ACCOUNT_JSON'];
/** Any secret value, or any 24+ character token-looking run, becomes [redacted] before it is written anywhere. */
export function redact(s) {
  let out = String(s ?? '');
  for (const k of SECRET_KEYS) { const v = process.env[k]; if (v && v.length > 8) out = out.split(v).join('[redacted]'); }
  return out.replace(/(Bearer|token=|key=|password=)[^\s&"']{8,}/gi, '$1[redacted]').replace(/postgres(ql)?:\/\/[^\s"']+/gi, 'postgres://[redacted]');
}

/** Every outbound call goes through here so the report can state its own cost. */
export const calls = { n: 0, byHost: {} };
export async function call(url, init = {}) {
  calls.n++;
  const host = new URL(url).host; calls.byHost[host] = (calls.byHost[host] || 0) + 1;
  const r = await fetch(url, init);
  return r;
}
export async function json(url, init = {}) {
  const r = await call(url, init);
  let body = null; try { body = await r.json(); } catch {}
  if (!r.ok) throw new Error(`${r.status} ${new URL(url).pathname}: ${redact(JSON.stringify(body)).slice(0, 160)}`);
  return body;
}

// ── dates, in Toronto ─────────────────────────────────────────────────────────
const TZ = 'America/Toronto';
export function torontoDate(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
export function daysAgo(n, from = new Date()) { return torontoDate(new Date(from.getTime() - n * 86400e3)); }
export function weekday(iso) { return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }); }
export const TODAY = torontoDate();
export const YESTERDAY = daysAgo(1);

// ── numbers ───────────────────────────────────────────────────────────────────
export const usd = (n, d = 2) => n == null || Number.isNaN(n) ? 'n/a' : `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const int = (n) => n == null || Number.isNaN(n) ? 'n/a' : Math.round(n).toLocaleString('en-CA');
export const gb = (bytes) => bytes == null ? 'n/a' : `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
export const hours = (s) => s == null ? 'n/a' : `${(s / 3600).toFixed(1)} h`;
/** A signed delta with its direction, or "flat"; for tiny bases the arrow is withheld. */
export function delta(now, then, { pct = true, minBase = 0 } = {}) {
  if (now == null || then == null) return '';
  const d = now - then;
  if (d === 0) return 'flat';
  const arrow = d > 0 ? '▲' : '▼';
  if (!pct || then === 0 || Math.abs(then) < minBase) return `${arrow} ${Math.abs(d) % 1 ? Math.abs(d).toFixed(2) : Math.abs(d)}`;
  return `${arrow} ${Math.abs(Math.round((d / then) * 100))}%`;
}

// ── small-sample honesty ──────────────────────────────────────────────────────
// A rate is printed with its denominator, and below the floor it is not printed at all. A
// day-over-day or week-over-week movement is called out only when both sides clear the floor
// AND the move is larger than the noise a Poisson count of that size carries (two standard
// deviations of sqrt(n)), otherwise the numbers are shown and no claim is made about them.
export const FLOOR = CONFIG.sampleFloor;
export function rate(num, den, label = '') {
  if (den == null || den < FLOOR.rateDenominator) return `not enough data (${label}${label ? ' ' : ''}n=${den ?? 0})`;
  return `${((num / den) * 100).toFixed(1)}% of ${int(den)}`;
}
export function movement(now, then) {
  if (now == null || then == null) return { claim: false, text: '' };
  const floor = FLOOR.countForTrend;
  if (Math.max(now, then) < floor) return { claim: false, text: `${int(now)} vs ${int(then)}, too few to call` };
  const noise = 2 * Math.sqrt(Math.max(then, 1));
  const claim = Math.abs(now - then) > noise;
  return { claim, text: `${int(now)} vs ${int(then)}${claim ? ` (${delta(now, then)})` : ', within noise'}` };
}

export function readState(dir = OUT) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')); } catch { return null; } }
export function writeState(state, dir = OUT) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 1)); }
