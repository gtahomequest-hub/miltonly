// src/components/board/TheBoard.tsx
'use client';

import { useState } from 'react';
import type { BoardTab, MetricBlock } from '@/lib/board/computeBoard';
import { ThinSegmentCard } from './ThinSegmentCard';
import './board.css';

const METRICS = [
  { key: 'typical', label: 'Typical price' },
  { key: 'salesVolume', label: 'Sales volume' },
  { key: 'daysToSell', label: 'Days to sell' },
  { key: 'soldToAsk', label: 'Sold to ask' },
] as const;
type MetricKey = (typeof METRICS)[number]['key'];

const money = (n: number | null) => (n === null ? '—' : '$' + Math.round(n).toLocaleString('en-CA'));
const money1k = (n: number | null) => (n === null ? '—' : '$' + (Math.round(n / 1000) * 1000).toLocaleString('en-CA'));
const pct1 = (n: number | null) => (n === null ? '—' : (n * 100).toFixed(1) + '%');
const titleCase = (slug: string) =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function DeltaChip({ value, label, goodWhenDown }: { value: number | null; label: string; goodWhenDown?: boolean }) {
  if (value === null) return <span className="brd-chip brd-chip-flat">— {label}</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const good = goodWhenDown ? down : up;
  const bad = goodWhenDown ? up : down;
  const cls = good ? ' brd-chip-up' : bad ? ' brd-chip-down' : ' brd-chip-flat';
  const arrow = up ? '▲' : down ? '▼' : '■';
  return (
    <span className={`brd-chip${cls}`}>
      {arrow} {value >= 0 ? '+' : ''}{(value * 100).toFixed(1)}% <em>{label}</em>
    </span>
  );
}

function PriceBandBar({ band, typical }: { band: BoardTab['priceBand']; typical: number | null }) {
  if (!band) return null;
  const span = band.p95 - band.p5 || 1;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - band.p5) / span) * 100));
  const fillL = pos(band.p25);
  const fillW = pos(band.p75) - fillL;
  const tick = typical !== null ? pos(typical) : pos(band.p50);
  return (
    <div className="brd-band">
      <div className="brd-band-track">
        <div className="brd-band-fill" style={{ left: `${fillL}%`, width: `${fillW}%` }} />
        <div className="brd-band-tick" style={{ left: `${tick}%` }} />
      </div>
      <div className="brd-band-labels">
        <span>{money1k(band.p5)}</span>
        <span className="brd-band-mid">middle half {money1k(band.p25)}–{money1k(band.p75)}</span>
        <span>{money1k(band.p95)}</span>
      </div>
      <p className="brd-band-note">Milton is not one market — the middle half spans a wide range, and it moves by neighbourhood.</p>
    </div>
  );
}

function Chart({ data }: { data: BoardTab['chart'] }) {
  const W = 320, H = 130, PADX = 8, PADY = 14;
  const vals = data.flatMap((d) => [d.cur, d.ghost]).filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => PADX + (i / (data.length - 1)) * (W - 2 * PADX);
  const y = (v: number) => H - PADY - ((v - min) / span) * (H - 2 * PADY);
  const path = (key: 'cur' | 'ghost') => {
    let d = '';
    data.forEach((pt, i) => {
      const v = pt[key];
      if (v === null) return;
      d += (d ? ' L' : 'M') + ` ${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    });
    return d;
  };
  return (
    <div className="brd-chart">
      <div className="brd-chart-legend">
        <span><i className="brd-leg-cur" /> last 12 months</span>
        <span><i className="brd-leg-ghost" /> same period last year</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="brd-chart-svg" preserveAspectRatio="none" role="img" aria-label="12-month typical price trend with prior-year overlay">
        <path d={path('ghost')} className="brd-path-ghost" />
        <path d={path('cur')} className="brd-path-cur" />
      </svg>
      <div className="brd-chart-x">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function headline(tab: BoardTab, metric: MetricKey) {
  switch (metric) {
    case 'typical':
      return { value: money1k(tab.typical.value), block: tab.typical as MetricBlock, prov: `${tab.typical.window} · ${tab.typical.sample.toLocaleString('en-CA')} sales · mix adjusted`, goodWhenDown: false };
    case 'salesVolume':
      return { value: tab.salesVolume.value === null ? '—' : tab.salesVolume.value.toLocaleString('en-CA'), block: tab.salesVolume, prov: `${tab.salesVolume.window} · ${(tab.salesVolume.value ?? 0).toLocaleString('en-CA')} sales`, goodWhenDown: false };
    case 'daysToSell':
      return { value: tab.daysToSell.value === null ? '—' : `${Math.round(tab.daysToSell.value)} days`, block: tab.daysToSell, prov: `${tab.daysToSell.window} · ${tab.daysToSell.sample} sales`, goodWhenDown: true };
    case 'soldToAsk':
      return { value: pct1(tab.soldToAsk.value), block: tab.soldToAsk, prov: `${tab.soldToAsk.window} · ${tab.soldToAsk.sample} sales`, goodWhenDown: false };
  }
}

export function TheBoard({ board }: { board: BoardTab[] }) {
  const [tabKey, setTabKey] = useState('overall');
  const [metric, setMetric] = useState<MetricKey>('typical');
  const tab = board.find((t) => t.tab === tabKey) ?? board[0];
  const h = headline(tab, metric);

  return (
    <section className="brd" id="board">
      <div className="brd-wrap">
        <div className="brd-eyebrow">
          <span>THE BOARD</span>
          <span className="brd-hair" />
          <span className="brd-through">Data through {tab.dataThrough}</span>
        </div>
        <h2 className="brd-heading">Milton&rsquo;s market, read by property type</h2>

        <div className="brd-tabs" role="tablist">
          {board.map((t) => (
            <button
              key={t.tab}
              role="tab"
              aria-selected={t.tab === tabKey}
              className={`brd-tab${t.tab === tabKey ? ' brd-tab-on' : ''}`}
              onClick={() => setTabKey(t.tab)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tabKey === 'detached' && (
          <div className="brd-scopenote">
            Detached is scoped to <b>urban Milton</b>. Rural and acreage sales sit in a different market and
            are reported separately. <a href="/neighbourhoods">See rural &amp; acreage →</a>
          </div>
        )}

        <div className="brd-metrics">
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={`brd-metric${m.key === metric ? ' brd-metric-on' : ''}`}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="brd-headline">
          <div className="brd-big">{h.value}</div>
          <div className="brd-deltas">
            <DeltaChip value={h.block.deltaMonth} label="vs last month" goodWhenDown={h.goodWhenDown} />
            <DeltaChip value={h.block.deltaYear} label="vs last year" goodWhenDown={h.goodWhenDown} />
          </div>
          <div className="brd-prov">{h.prov}</div>
        </div>

        {metric === 'typical' && <PriceBandBar band={tab.priceBand} typical={tab.typical.value} />}

        <Chart data={tab.chart} />

        <div className="brd-tiles">
          <div className="brd-tile">
            <div className="brd-tile-v">{tab.salesVolume.value?.toLocaleString('en-CA') ?? '—'}</div>
            <div className="brd-tile-l">Sales volume<span>trailing 12 months</span></div>
          </div>
          <div className="brd-tile">
            <div className="brd-tile-v">{tab.daysToSell.value === null ? '—' : Math.round(tab.daysToSell.value)}</div>
            <div className="brd-tile-l">Days to sell<span>{tab.daysToSell.window}</span></div>
          </div>
          <div className="brd-tile">
            <div className="brd-tile-v">{pct1(tab.soldToAsk.value)}</div>
            <div className="brd-tile-l">Sold to ask<span>{tab.soldToAsk.window}</span></div>
          </div>
          <div className="brd-tile">
            <div className="brd-tile-v">{tab.monthsSupply.value === null ? '—' : tab.monthsSupply.value.toFixed(1)}</div>
            <div className="brd-tile-l">Months of supply<span>at current pace</span></div>
          </div>
        </div>

        {tab.suppressed.length > 0 && (
          <div className="brd-thins">
            {tab.suppressed.map((c) => (
              <ThinSegmentCard
                key={`${c.type}-${c.slug}`}
                label={`${titleCase(c.slug)} · ${c.type}`}
                count={c.count}
                window={tab.widenedTo}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default TheBoard;
