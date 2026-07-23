// src/lib/board/computeBoard.ts
// THE BOARD — Phase 1 compute (DB2 -> DB3). Precomputes analytics.board_stats,
// one row per tab (overall/detached/townhouse/semi/condo), read by the homepage.
//
// Scope: URBAN Milton residential For-Sale sales. Urban = Neighbourhood.kind
// === 'urban' (NOT profile — profile mis-tags Bronte Meadows + Milton North).
// Lot-width guard drops acreage sitting inside urban tracts: normalize units
// FIRST (Feet as-is, Metres x3.28084, Acres -> treat as >100ft rural, null ->
// kept, kind governs), then exclude lot_width_ft > 100.
//
// typical_price is MIX-ADJUSTED (Laspeyres): per (property_type x neighbourhood)
// cell median, weighted by a FIXED prior-12-month transaction basket, so the
// figure moves with price not with sales mix. Each cell's window WIDENS from
// 4wk -> 8wk -> 13wk -> 26wk -> 52wk until it clears k-anon (k=5); if it can't
// clear even at 52wk it is SUPPRESSED and disclosed. Deltas re-run the same
// per-cell windows shifted -1 month / -1 year. Provenance states the widest
// window used, the sample, and "mix adjusted".
//
// Secondary metrics (sales volume / days-to-sell / sold-to-ask / months-supply)
// are simple tab-scope aggregates over their own stated windows. NO $/sqft.
// Public aggregates only — never an individual record.

import { requireSoldDb, requireAnalyticsDb } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const K = 5; // k-anon floor per cell
const DAY = 86_400_000;
const STEPS = [28, 56, 91, 182, 365]; // widening ladder (days)
const TYPES = ["detached", "townhouse", "semi", "condo"] as const;
type Ptype = (typeof TYPES)[number];
const TAB_LABEL: Record<string, string> = {
  overall: "Overall", detached: "Detached", townhouse: "Townhouse", semi: "Semi", condo: "Condo",
};

function windowLabel(days: number): string {
  if (days <= 28) return "4 weeks";
  if (days <= 56) return "8 weeks";
  if (days <= 91) return "13 weeks";
  if (days <= 182) return "6 months";
  return "12 months";
}

export interface Sale {
  type: Ptype;
  slug: string;
  price: number;
  t: number; // sold_date ms
  dom: number | null;
  sta: number | null;
}

export interface MetricBlock {
  value: number | null;
  deltaMonth: number | null;
  deltaYear: number | null;
  window: string;
  sample: number;
}
export interface BoardTab {
  tab: string;
  label: string;
  typical: MetricBlock & { mixAdjusted: true };
  salesVolume: MetricBlock;
  daysToSell: MetricBlock;
  soldToAsk: MetricBlock;
  monthsSupply: { value: number | null };
  priceBand: { p5: number; p25: number; p50: number; p75: number; p95: number } | null;
  chart: { label: string; cur: number | null; ghost: number | null }[];
  suppressed: { type: string; slug: string; count: number }[];
  widenedTo: string;
  dataThrough: string;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const avg = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const inWin = (sales: Sale[], loT: number, hiT: number) => sales.filter((s) => s.t > loT && s.t <= hiT);

// ── loaders ──────────────────────────────────────────────────────────────────
export async function loadBoardInputs(): Promise<{ sales: Sale[]; active: Record<Ptype, number>; nowMs: number }> {
  const sold = requireSoldDb();
  // raw string -> {slug, kind}
  const nbs = await prisma.neighbourhood.findMany({ select: { slug: true, kind: true, rawStrings: true } });
  const rawToSlug = new Map<string, { slug: string; kind: string }>();
  for (const nb of nbs) for (const raw of nb.rawStrings) rawToSlug.set(raw, { slug: nb.slug, kind: nb.kind });

  const lotFt = `CASE WHEN lot_size_units='Metres' THEN lot_width*3.28084 WHEN lot_size_units='Acres' THEN 9999 ELSE lot_width END`;
  // dom = LIST-TO-FIRM (contract_date − list_date), i.e. true "days to sell".
  // The stored days_on_market is list-to-CLOSE and is NOT used here.
  const domFirm = `CASE WHEN contract_date IS NOT NULL AND list_date IS NOT NULL AND contract_date >= list_date
    THEN EXTRACT(EPOCH FROM (contract_date - list_date)) / 86400 END`;
  const rows = (await sold`
    SELECT property_type, neighbourhood, sold_price,
           EXTRACT(EPOCH FROM sold_date) * 1000 AS t_ms,
           (${sold.unsafe(domFirm)}) AS dom_firm, sold_to_ask_ratio,
           (${sold.unsafe(lotFt)}) AS lot_ft
    FROM sold.sold_records
    WHERE transaction_type = 'For Sale' AND perm_advertise = TRUE
      AND sold_date >= NOW() - INTERVAL '760 days' AND sold_date <= NOW()
  `) as Array<Record<string, unknown>>;

  const sales: Sale[] = [];
  for (const r of rows) {
    const map = rawToSlug.get(String(r.neighbourhood));
    if (!map || map.kind !== "urban") continue; // urban only
    const lot = num(r.lot_ft);
    if (lot !== null && lot > 100) continue; // lot guard (null kept)
    const type = String(r.property_type) as Ptype;
    if (!TYPES.includes(type)) continue;
    const price = num(r.sold_price);
    const t = num(r.t_ms);
    if (price === null || t === null) continue;
    sales.push({ type, slug: map.slug, price, t, dom: num(r.dom_firm), sta: num(r.sold_to_ask_ratio) });
  }

  const grp = await prisma.listing.groupBy({
    by: ["propertyType"],
    where: { status: "active", permAdvertise: true },
    _count: true,
  });
  const active = { detached: 0, townhouse: 0, semi: 0, condo: 0 } as Record<Ptype, number>;
  for (const g of grp) {
    const k = String(g.propertyType) as Ptype;
    if (k in active) active[k] = g._count;
  }
  return { sales, active, nowMs: Date.now() };
}

// ── mix-adjusted typical for one tab ──────────────────────────────────────────
function computeTypical(sales: Sale[], cells: { type: Ptype; slug: string }[], nowMs: number) {
  const basketLo = nowMs - 365 * DAY;
  type Cell = { key: string; weight: number; winDays: number; medNow: number; cnt: number; medMonth: number | null; medYear: number | null };
  const good: Cell[] = [];
  const suppressed: { type: string; slug: string; count: number }[] = [];
  let widest = 0;
  let sample = 0;

  for (const c of cells) {
    const cs = sales.filter((s) => s.type === c.type && s.slug === c.slug);
    const weight = cs.filter((s) => s.t > basketLo && s.t <= nowMs).length; // fixed prior-12mo basket
    if (weight === 0) continue;
    // widen "now" until >= K
    let picked: { winDays: number; med: number; cnt: number } | null = null;
    for (const w of STEPS) {
      const win = cs.filter((s) => s.t > nowMs - w * DAY && s.t <= nowMs);
      if (win.length >= K) { picked = { winDays: w, med: median(win.map((s) => s.price))!, cnt: win.length }; break; }
    }
    if (!picked) { suppressed.push({ type: c.type, slug: c.slug, count: cs.filter((s) => s.t > nowMs - 365 * DAY).length }); continue; }
    const at = (anchor: number) => {
      const win = cs.filter((s) => s.t > anchor - picked!.winDays * DAY && s.t <= anchor);
      return median(win.map((s) => s.price));
    };
    good.push({
      key: `${c.type}/${c.slug}`, weight, winDays: picked.winDays, medNow: picked.med, cnt: picked.cnt,
      medMonth: at(nowMs - 28 * DAY), medYear: at(nowMs - 365 * DAY),
    });
    widest = Math.max(widest, picked.winDays);
    sample += picked.cnt;
  }

  const wmean = (pick: (c: Cell) => number | null): number | null => {
    let sw = 0, sv = 0;
    for (const c of good) { const v = pick(c); if (v !== null) { sw += c.weight; sv += c.weight * v; } }
    return sw ? sv / sw : null;
  };
  const now = wmean((c) => c.medNow);
  const mo = wmean((c) => c.medMonth);
  const yr = wmean((c) => c.medYear);
  return {
    value: now, sample, widest,
    deltaMonth: now !== null && mo ? (now - mo) / mo : null,
    deltaYear: now !== null && yr ? (now - yr) / yr : null,
    suppressed,
  };
}

// ── secondary metric over a tab-scope window (widen to reach minN) ────────────
function windowedAgg(sales: Sale[], nowMs: number, baseDays: number, minN: number, pick: (s: Sale) => number | null) {
  const val = (anchor: number, days: number) => {
    const xs = inWin(sales, anchor - days * DAY, anchor).map(pick).filter((v): v is number => v !== null);
    return { v: avg(xs), n: xs.length };
  };
  let days = baseDays;
  for (const d of [baseDays, 182, 365]) { days = d; if (val(nowMs, d).n >= minN) break; }
  const cur = val(nowMs, days);
  const mo = val(nowMs - 30 * DAY, days);
  const yr = val(nowMs - 365 * DAY, days);
  return {
    value: cur.v, sample: cur.n, window: windowLabel(days),
    deltaMonth: cur.v !== null && mo.v ? (cur.v - mo.v) / mo.v : null,
    deltaYear: cur.v !== null && yr.v ? (cur.v - yr.v) / yr.v : null,
  };
}

export function computeBoardFromSales(sales: Sale[], active: Record<Ptype, number>, nowMs: number): BoardTab[] {
  const urbanSlugs = Array.from(new Set(sales.map((s) => s.slug)));
  const dataThrough = new Date(Math.max(...sales.map((s) => s.t))).toISOString().slice(0, 10);

  const tabs: BoardTab[] = [];
  for (const tab of ["overall", ...TYPES] as const) {
    const scope = tab === "overall" ? sales : sales.filter((s) => s.type === tab);
    const cells = tab === "overall"
      ? TYPES.flatMap((tp) => urbanSlugs.map((slug) => ({ type: tp, slug })))
      : urbanSlugs.map((slug) => ({ type: tab as Ptype, slug }));

    const typ = computeTypical(sales, cells, nowMs);

    // sales volume — trailing 12 months (reconciles with the hero), YoY + MoM.
    const vol12 = inWin(scope, nowMs - 365 * DAY, nowMs).length;
    const volPrev12 = inWin(scope, nowMs - 730 * DAY, nowMs - 365 * DAY).length;
    const vol30 = inWin(scope, nowMs - 30 * DAY, nowMs).length;
    const volPrev30 = inWin(scope, nowMs - 60 * DAY, nowMs - 30 * DAY).length;

    const dom = windowedAgg(scope, nowMs, 90, 10, (s) => s.dom);
    const sta = windowedAgg(scope, nowMs, 90, 10, (s) => s.sta);

    const activeN = tab === "overall" ? Object.values(active).reduce((a, b) => a + b, 0) : active[tab as Ptype];
    const monthsSupply = vol12 > 0 ? activeN / (vol12 / 12) : null;

    const prices12 = inWin(scope, nowMs - 365 * DAY, nowMs).map((s) => s.price);
    const priceBand = prices12.length >= K ? {
      p5: percentile(prices12, 0.05), p25: percentile(prices12, 0.25), p50: percentile(prices12, 0.5),
      p75: percentile(prices12, 0.75), p95: percentile(prices12, 0.95),
    } : null;

    // 12 trailing 30-day buckets (oldest -> newest) + same-bucket-last-year ghost.
    const chart = [];
    for (let i = 11; i >= 0; i--) {
      const hi = nowMs - i * 30 * DAY, lo = hi - 30 * DAY;
      const cur = median(inWin(scope, lo, hi).map((s) => s.price));
      const ghost = median(inWin(scope, lo - 365 * DAY, hi - 365 * DAY).map((s) => s.price));
      chart.push({ label: new Date(hi).toLocaleDateString("en-CA", { month: "short" }), cur, ghost });
    }

    tabs.push({
      tab, label: TAB_LABEL[tab], dataThrough,
      typical: {
        value: typ.value, deltaMonth: typ.deltaMonth, deltaYear: typ.deltaYear,
        window: windowLabel(typ.widest), sample: typ.sample, mixAdjusted: true,
      },
      salesVolume: {
        value: vol12, sample: vol12, window: "trailing 12 months",
        deltaMonth: volPrev30 ? (vol30 - volPrev30) / volPrev30 : null,
        deltaYear: volPrev12 ? (vol12 - volPrev12) / volPrev12 : null,
      },
      daysToSell: { value: dom.value, deltaMonth: dom.deltaMonth, deltaYear: dom.deltaYear, window: dom.window, sample: dom.sample },
      soldToAsk: { value: sta.value, deltaMonth: sta.deltaMonth, deltaYear: sta.deltaYear, window: sta.window, sample: sta.sample },
      monthsSupply: { value: monthsSupply },
      priceBand,
      chart,
      suppressed: typ.suppressed,
      widenedTo: windowLabel(typ.widest),
    });
  }
  return tabs;
}

// ── DB3 write ─────────────────────────────────────────────────────────────────
export async function writeBoardStats(tabs: BoardTab[]): Promise<void> {
  const a = requireAnalyticsDb();
  await a`CREATE TABLE IF NOT EXISTS analytics.board_stats (
    tab text PRIMARY KEY,
    data jsonb NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT NOW()
  )`;
  for (const t of tabs) {
    await a`INSERT INTO analytics.board_stats (tab, data, computed_at)
      VALUES (${t.tab}, ${JSON.stringify(t)}::jsonb, NOW())
      ON CONFLICT (tab) DO UPDATE SET data = EXCLUDED.data, computed_at = NOW()`;
  }
}

export async function computeAndWriteBoard(): Promise<BoardTab[]> {
  const { sales, active, nowMs } = await loadBoardInputs();
  const tabs = computeBoardFromSales(sales, active, nowMs);
  await writeBoardStats(tabs);
  return tabs;
}
