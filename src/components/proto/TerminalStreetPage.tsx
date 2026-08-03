// src/components/proto/TerminalStreetPage.tsx
// PROTOTYPE two-layer street page. Server component. Layer 1 = deterministic blocks (every number lives
// here). Layer 2 = grounded prose with no volatile numbers. v5: ONE 12-col grid, one stat treatment, one
// shared bar-chart component (split + comparison), 2 full-bleed only (hero + CTA, both direct children of
// .tp so full-width is pure CSS — no scrollbar script). Data, blocks and copy are VERBATIM from prior pass.
import './terminal.css';
import type { ReactNode } from 'react';
import type { ClarriageFacts } from '@/lib/proto/clarriageData';

// ---- number formatters (compact for headlines, full for rents) ----
function money(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}
const full = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);

// The registry name arrives abbreviated + directional ("Clarriage Crt E"); show the canonical
// display form. (Production would use expandStreetName; inlined here to stay self-contained.)
function cleanName(raw: string): string {
  return raw
    .replace(/\bCrt\b/gi, 'Court').replace(/\bDr\b/gi, 'Drive').replace(/\bRd\b/gi, 'Road')
    .replace(/\bAve\b/gi, 'Avenue').replace(/\bBlvd\b/gi, 'Boulevard').replace(/\bCres\b/gi, 'Crescent')
    .replace(/\s+[EWNS]$/, '').trim();
}

// ── the ONE stat treatment: a mono label + a body line. Every fact-block on the page is one of these. ──
function Stat({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'tp-stat tp-span' : 'tp-stat'}>
      <div className="tp-lbl">{label}</div>
      <p className="tp-body-t">{children}</p>
    </div>
  );
}

// ── the ONE chart: horizontal bars on a shared axis. Split and comparison are the SAME component. ──
type Row = { label: string; value: string; pct: number; tone: 'a' | 'b' };
function BarChart({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <div className="tp-chart tp-span" role="img" aria-label={caption}>
      {rows.map((r) => (
        <div className="tp-chart-row" key={r.label}>
          <div className="tp-lbl tp-chart-lbl">{r.label}</div>
          <div className="tp-chart-track"><i className={`tp-chart-fill tp-tone-${r.tone}`} style={{ width: `${Math.max(2, r.pct)}%` }} /></div>
          <div className="tp-chart-val">{r.value}</div>
        </div>
      ))}
      <div className="tp-cap">{caption}</div>
    </div>
  );
}

export function TerminalStreetPage({ facts, analysis }: { facts: ClarriageFacts; analysis: string[] }) {
  const f = facts;
  const displayName = cleanName(f.name);
  const condoSqft = f.mix.sqft.filter((s) => /^[5-9]\d\d|^1000/.test(s.range)).reduce((a, s) => a + s.n, 0);
  const freeholdSqft = f.mix.sqft.filter((s) => /^1[1-9]\d\d|^[2-9]\d\d\d/.test(s.range)).reduce((a, s) => a + s.n, 0);
  const maxSqft = Math.max(1, condoSqft, freeholdSqft);
  const maxQ = Math.max(1, ...f.quarterlyVolume.map((q) => q.n));
  const areaTypical = f.area?.typical ?? null;
  const cmpBase = Math.max(f.sale.median ?? 0, areaTypical ?? 0) || 1;
  const rents = f.rental.byBed.filter((b) => b.median != null);

  return (
    <div className="tp">
      {/* ══ HERO — the one moment of maximum contrast (full-bleed #1) ══ */}
      <header className="tp-hero">
        <div className="tp-wrap tp-hero-in">
          <div className="tp-lbl tp-hero-eyebrow">Street profile · {f.neighbourhood} · Milton, ON</div>
          <h1 className="tp-head tp-h1">{displayName}</h1>
          <p className="tp-body-t tp-thesis">
            Two housing markets on one street: the 1440&nbsp;Clarriage&nbsp;Court condominium, and a row of
            freehold townhomes and semis. Read the average with that in mind.
          </p>
          <div className="tp-hero-grid">
            <div>
              <div className="tp-display">{money(f.sale.median)}</div>
              <div className="tp-lbl tp-display-l">typical sold price · median of {f.sale.fullN} sales · last ~2 years</div>
            </div>
            <div className="tp-hero-rail">
              <div className="tp-kv"><span className="tp-lbl">Range</span><b className="tp-body-t">{f.sale.range ? `${money(f.sale.range.lo)} – ${money(f.sale.range.hi)}` : '—'}</b></div>
              <div className="tp-kv"><span className="tp-lbl">Days to sell</span><b className="tp-body-t">{f.sale.dom ?? '—'}</b></div>
              <div className="tp-kv"><span className="tp-lbl">Sold-to-ask</span><b className="tp-body-t">{f.sale.soldToAsk != null ? `${f.sale.soldToAsk}%` : '—'}</b></div>
            </div>
          </div>
        </div>
      </header>

      <main className="tp-body">
        {/* 1 · what it's made of */}
        <section className="tp-sec">
          <div className="tp-sec-head"><h2 className="tp-head">What Clarriage Court is made of</h2></div>
          <div className="tp-sec-c">
            <Stat label="Why one price can’t describe this street" wide>
              Home sizes here split cleanly into two groups: condominium units of roughly {condoSqft ? `${condoSqft} recorded sales at ` : ''}500–999&nbsp;sq&nbsp;ft, and
              freehold houses of {freeholdSqft ? `${freeholdSqft} at ` : ''}1,100&nbsp;sq&nbsp;ft and up. A stacked apartment and a house with a yard trade under the same street name,
              which is why a single midpoint understates the freehold end and overstates the condo end.
            </Stat>
            <BarChart
              caption="Recorded sales by home size"
              rows={[
                { label: 'Condo-scale · 500–999 sq ft', value: String(condoSqft), pct: (condoSqft / maxSqft) * 100, tone: 'a' },
                { label: 'Freehold-scale · 1,100 sq ft +', value: String(freeholdSqft), pct: (freeholdSqft / maxSqft) * 100, tone: 'b' },
              ]}
            />
            <Stat label="The 1440 Clarriage Court condo anchors the small-unit end" wide>
              The building is on record as a distinct condominium on this street. It supplies the compact, entry-priced
              units and drives the street’s unusually deep rental market below. Its exact unit count and build year
              aren’t in our data yet — see the gap list.
            </Stat>
          </div>
        </section>

        {/* 2 · cost */}
        <section className="tp-sec">
          <div className="tp-sec-head"><h2 className="tp-head">What it costs, and why the average misleads</h2></div>
          <div className="tp-sec-c">
            {areaTypical != null && f.sale.median != null && (
              <BarChart
                caption="Typical sold price · median, last ~2 years"
                rows={[
                  { label: 'Clarriage Court', value: money(f.sale.median), pct: (f.sale.median / cmpBase) * 100, tone: 'a' },
                  { label: `${f.area?.neighbourhood ?? 'Ford'} area`, value: money(areaTypical), pct: (areaTypical / cmpBase) * 100, tone: 'b' },
                ]}
              />
            )}
            <Stat label="The typical price"><b className="tp-num">{full(f.sale.median)}</b> is the median across {f.sale.fullN} sales over the last two years. It is a true midpoint, but a midpoint between two different products.</Stat>
            <Stat label="The spread is the story">Sales run from <b className="tp-num">{money(f.sale.range?.lo ?? null)}</b> to <b className="tp-num">{money(f.sale.range?.hi ?? null)}</b> — the low end a condo unit, the high end a large freehold home. Few Milton streets span this range.</Stat>
            <Stat label="What the last year looked like">Over the last 12 months the median was <b className="tp-num">{full(f.sale.median12)}</b> across {f.sale.n12} sales — below the two-year figure, because recent trading skewed toward the condo end.</Stat>
            <Stat label="How it sits against Ford">The {f.area?.neighbourhood ?? 'Ford'} neighbourhood’s typical home sells around <b className="tp-num">{full(areaTypical)}</b>. Clarriage sits below it — its condo share is the reason, and its entry point into Ford is the opportunity.</Stat>
          </div>
        </section>

        {/* 3 · how it trades */}
        <section className="tp-sec">
          <div className="tp-sec-head"><h2 className="tp-head">How it trades</h2></div>
          <div className="tp-sec-c">
            <div className="tp-stat tp-span">
              <div className="tp-lbl">Sales volume, quarter by quarter</div>
              <div className="tp-spark" role="img" aria-label="Quarterly sales volume">
                {f.quarterlyVolume.map((q) => (
                  <div className="tp-spark-col" key={q.q}>
                    <div className="tp-spark-bar" style={{ height: `${Math.round((q.n / maxQ) * 100)}%` }}><span className="tp-num tp-spark-n">{q.n}</span></div>
                    <div className="tp-lbl tp-spark-x">{q.q}</div>
                  </div>
                ))}
              </div>
              <p className="tp-cap">Shown as transaction count, not price: with only a handful of sales per quarter, a per-quarter price line would sit below our publish threshold. Volume is the honest shape.</p>
            </div>
            <Stat label="The pace">A home takes about <b className="tp-num">{f.sale.dom ?? '—'} days</b> to sell and closes near <b className="tp-num">{f.sale.soldToAsk ?? '—'}%</b> of asking — a patient, slightly-below-ask market, not a bidding-war street.</Stat>
            <Stat label="Direction, read safely">The two figures that clear our threshold — the two-year median <b className="tp-num">{money(f.pricePoints.full)}</b> and the last-12-month median <b className="tp-num">{money(f.pricePoints.last12)}</b> — point down, but that reflects a shift in <em>what</em> sold as much as any change in value.</Stat>
          </div>
        </section>

        {/* 4 · rental depth */}
        <section className="tp-sec">
          <div className="tp-sec-head"><h2 className="tp-head">The rental market runs deeper than the sales market</h2></div>
          <div className="tp-sec-c">
            <Stat label="More homes lease here than sell">The street recorded <b className="tp-num">{f.rental.n} leases</b> in the last year against {f.sale.n12} sales — a condo-anchored signature. Typical rent runs <b className="tp-num">{full(f.rental.median)}/mo</b>, leased in about <b className="tp-num">{f.rental.dom ?? '—'} days</b>.</Stat>
            <Stat label="By bedroom">
              {rents.length ? rents.map((b, i) => (
                <span key={b.beds}>{i > 0 ? ' · ' : ''}<b className="tp-num">{full(b.median)}</b> {b.beds}-bed · {b.n} leases</span>
              )) : 'Per-bedroom rents are below the publish threshold.'}
            </Stat>
          </div>
        </section>

        {/* 5 · location */}
        <section className="tp-sec">
          <div className="tp-sec-head"><h2 className="tp-head">Where it sits, and what’s reachable</h2></div>
          <div className="tp-sec-c">
            <Stat label="Commute reach">Milton GO is about <b className="tp-num">{f.commute.goDriveMin} min</b> by car and a Highway&nbsp;401 on-ramp about <b className="tp-num">{f.commute.hwy401DriveMin} min</b> — measured from the {f.neighbourhood} area, not the doorstep.</Stat>
            <Stat label="Nearest schools">
              {f.schoolsNearby.map((s, i) => (
                <span key={s.name}>{i > 0 ? ' · ' : ''}{s.name} <b className="tp-num">~{s.approxMin} min</b></span>
              ))}
              <span className="tp-cap-inline"> Distances are {f.neighbourhood}-area approximations — per-street geocoding isn’t populated yet.</span>
            </Stat>
          </div>
        </section>

        {/* 6 · on the market */}
        {f.active.total > 0 && (
          <section className="tp-sec">
            <div className="tp-sec-head"><h2 className="tp-head">On the market right now</h2></div>
            <div className="tp-sec-c">
              <p className="tp-body-t tp-span"><b className="tp-num">{f.active.total}</b> active listing — a {f.active.type} at <b className="tp-num">{full(f.active.price)}</b>. Live inventory turns over; this is a snapshot.</p>
            </div>
          </section>
        )}

        {/* 7 · the read (Layer 2) — same grid; prose in two columns, pull-quote a full-width break */}
        <section className="tp-sec">
          <div className="tp-sec-head"><div className="tp-lbl tp-read-eyebrow">The read</div><h2 className="tp-head">How to actually think about Clarriage Court</h2></div>
          <div className="tp-sec-c">
            <div className="tp-read-body tp-span">
              {analysis.flatMap((p, i) => {
                const nodes = [<p className="tp-body-t tp-read-p" key={`p${i}`}>{p}</p>];
                if (i === 2) nodes.push(
                  <aside className="tp-pull" key="pull">&ldquo;&hellip;one address offering two very different ways in.&rdquo;</aside>
                );
                return nodes;
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ══ CONVERSION (full-bleed #2) — the one place signal green is allowed ══ */}
      <section className="tp-cta">
        <div className="tp-wrap tp-cta-in">
          <div>
            <div className="tp-head tp-cta-h">Track Clarriage Court</div>
            <div className="tp-body-t tp-cta-p">Get an email when a home here is listed, sold, or leased.</div>
          </div>
          <a className="tp-cta-btn" href="/signin?intent=alert&street=clarriage-court-milton">Set an alert →</a>
        </div>
      </section>
    </div>
  );
}

export default TerminalStreetPage;
