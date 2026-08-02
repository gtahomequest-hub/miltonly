// src/components/proto/TerminalStreetPage.tsx
// PROTOTYPE two-layer street page. Server component, CSS-first, ZERO client JS. Layer 1 = deterministic
// blocks (every number lives here). Layer 2 = grounded prose with no volatile numbers. New file — imports
// none of the files feat/street-tier-rich touches.
import './terminal.css';
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

export function TerminalStreetPage({ facts, analysis }: { facts: ClarriageFacts; analysis: string[] }) {
  const f = facts;
  const displayName = cleanName(f.name);
  // group the sqft distribution into the two markets the street actually is
  const condoSqft = f.mix.sqft.filter((s) => /^[5-9]\d\d|^1000/.test(s.range)).reduce((a, s) => a + s.n, 0);
  const freeholdSqft = f.mix.sqft.filter((s) => /^1[1-9]\d\d|^[2-9]\d\d\d/.test(s.range)).reduce((a, s) => a + s.n, 0);
  const maxQ = Math.max(1, ...f.quarterlyVolume.map((q) => q.n));
  // sold-to-ask temperature: below 100% reads cooler. Position on a 90-105 scale.
  const staPos = f.sale.soldToAsk != null ? Math.max(0, Math.min(100, ((f.sale.soldToAsk - 90) / 15) * 100)) : null;

  return (
    <div className="tp">
      {/* ── HERO — one dominant number as a design element ── */}
      <header className="tp-hero">
        <div className="tp-wrap">
          <div className="tp-eyebrow">Street profile · {f.neighbourhood} · Milton, ON</div>
          <h1 className="tp-h1">{displayName}</h1>
          <p className="tp-thesis">
            Two housing markets on one street: the 1440&nbsp;Clarriage&nbsp;Court condominium, and a row of
            freehold townhomes and semis. Read the average with that in mind.
          </p>
          <div className="tp-hero-grid">
            <div className="tp-hero-num">
              <div className="tp-bignum">{money(f.sale.median)}</div>
              <div className="tp-bignum-l">typical sold price</div>
              <div className="tp-bignum-s">median of {f.sale.fullN} sales · last ~2 years</div>
            </div>
            <div className="tp-hero-side">
              <div className="tp-kv"><span>Range</span><b>{f.sale.range ? `${money(f.sale.range.lo)} – ${money(f.sale.range.hi)}` : '—'}</b></div>
              <div className="tp-kv"><span>Days to sell</span><b>{f.sale.dom ?? '—'}</b></div>
              <div className="tp-kv"><span>Sold-to-ask</span><b>{f.sale.soldToAsk != null ? `${f.sale.soldToAsk}%` : '—'}</b></div>
              {staPos != null && (
                <div className="tp-temp" aria-label={`Sold-to-ask ${f.sale.soldToAsk}% — cooler`}>
                  <div className="tp-temp-track"><span className="tp-temp-mark" style={{ left: `${staPos}%` }} /></div>
                  <div className="tp-temp-lbls"><span>cooler</span><span>at ask</span><span>hotter</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="tp-wrap tp-body">
        {/* ── H2: what it's made of ── */}
        <section className="tp-sec">
          <h2 className="tp-h2">What Clarriage Court is made of</h2>
          <div className="tp-block tp-lead">
            <h3 className="tp-h3">Why one price can&rsquo;t describe this street</h3>
            <p>
              Home sizes here split cleanly into two groups: condominium units of roughly {condoSqft ? `${condoSqft} recorded sales at ` : ''}500–999&nbsp;sq&nbsp;ft, and
              freehold houses of {freeholdSqft ? `${freeholdSqft} at ` : ''}1,100&nbsp;sq&nbsp;ft and up. A stacked apartment and a house with a yard trade under the same street name,
              which is why a single midpoint understates the freehold end and overstates the condo end.
            </p>
            <div className="tp-split">
              <div className="tp-split-a"><b>{condoSqft}</b><span>condo-scale sales<br />500–999 sq ft</span></div>
              <div className="tp-split-bar"><i style={{ flex: condoSqft || 1 }} className="tp-split-condo" /><i style={{ flex: freeholdSqft || 1 }} className="tp-split-free" /></div>
              <div className="tp-split-b"><b>{freeholdSqft}</b><span>freehold-scale sales<br />1,100 sq ft +</span></div>
            </div>
          </div>
          <div className="tp-block">
            <h3 className="tp-h3">The 1440 Clarriage Court condo anchors the small-unit end</h3>
            <p>
              The building is on record as a distinct condominium on this street. It supplies the compact, entry-priced
              units and drives the street&rsquo;s unusually deep rental market below. Its exact unit count and build year
              aren&rsquo;t in our data yet — see the gap list.
            </p>
          </div>
        </section>

        {/* ── H2: cost ── */}
        <section className="tp-sec">
          <h2 className="tp-h2">What it costs, and why the average misleads</h2>
          <div className="tp-grid2">
            <div className="tp-block"><h3 className="tp-h3">The typical price</h3><p><b className="tp-inline">{full(f.sale.median)}</b> is the median across {f.sale.fullN} sales over the last two years. It is a true midpoint, but a midpoint between two different products.</p></div>
            <div className="tp-block"><h3 className="tp-h3">The spread is the story</h3><p>Sales run from <b className="tp-inline">{money(f.sale.range?.lo ?? null)}</b> to <b className="tp-inline">{money(f.sale.range?.hi ?? null)}</b> — the low end a condo unit, the high end a large freehold home. Few Milton streets span this range.</p></div>
            <div className="tp-block"><h3 className="tp-h3">What the last year looked like</h3><p>Over the last 12 months the median was <b className="tp-inline">{full(f.sale.median12)}</b> across {f.sale.n12} sales — below the two-year figure, because recent trading skewed toward the condo end.</p></div>
            <div className="tp-block"><h3 className="tp-h3">How it sits against Ford</h3><p>The {f.area?.neighbourhood ?? 'Ford'} neighbourhood&rsquo;s typical home sells around <b className="tp-inline">{full(f.area?.typical ?? null)}</b>. Clarriage sits below it — its condo share is the reason, and its entry point into Ford is the opportunity.</p></div>
          </div>
        </section>

        {/* ── H2: how it trades — the shape feature ── */}
        <section className="tp-sec">
          <h2 className="tp-h2">How it trades</h2>
          <div className="tp-block">
            <h3 className="tp-h3">Sales volume, quarter by quarter</h3>
            <p className="tp-sub">
              Shown as transaction count, not price: with only a handful of sales per quarter, a per-quarter price line
              would sit below our publish threshold. Volume is the honest shape.
            </p>
            <div className="tp-bars" role="img" aria-label="Quarterly sales volume">
              {f.quarterlyVolume.map((q) => (
                <div className="tp-bar-col" key={q.q}>
                  <div className="tp-bar" style={{ height: `${Math.round((q.n / maxQ) * 100)}%` }}><span className="tp-bar-n">{q.n}</span></div>
                  <div className="tp-bar-x">{q.q}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="tp-grid2">
            <div className="tp-block"><h3 className="tp-h3">The pace</h3><p>A home takes about <b className="tp-inline">{f.sale.dom ?? '—'} days</b> to sell and closes near <b className="tp-inline">{f.sale.soldToAsk ?? '—'}%</b> of asking — a patient, slightly-below-ask market, not a bidding-war street.</p></div>
            <div className="tp-block"><h3 className="tp-h3">Direction, read safely</h3><p>The two figures that clear our threshold — the two-year median <b className="tp-inline">{money(f.pricePoints.full)}</b> and the last-12-month median <b className="tp-inline">{money(f.pricePoints.last12)}</b> — point down, but that reflects a shift in <em>what</em> sold as much as any change in value.</p></div>
          </div>
        </section>

        {/* ── H2: rental depth ── */}
        <section className="tp-sec">
          <h2 className="tp-h2">The rental market runs deeper than the sales market</h2>
          <div className="tp-grid2">
            <div className="tp-block"><h3 className="tp-h3">More homes lease here than sell</h3><p>The street recorded <b className="tp-inline">{f.rental.n} leases</b> in the last year against {f.sale.n12} sales — a condo-anchored signature. Typical rent runs <b className="tp-inline">{full(f.rental.median)}/mo</b>, leased in about <b className="tp-inline">{f.rental.dom ?? '—'} days</b>.</p></div>
            <div className="tp-block">
              <h3 className="tp-h3">By bedroom</h3>
              <div className="tp-rents">
                {f.rental.byBed.filter((b) => b.median != null).map((b) => (
                  <div className="tp-rent" key={b.beds}><b>{full(b.median)}</b><span>{b.beds}-bed · {b.n} leases</span></div>
                ))}
                {f.rental.byBed.filter((b) => b.median != null).length === 0 && <p className="tp-sub">Per-bedroom rents are below the publish threshold.</p>}
              </div>
            </div>
          </div>
        </section>

        {/* ── H2: location ── */}
        <section className="tp-sec">
          <h2 className="tp-h2">Where it sits, and what&rsquo;s reachable</h2>
          <div className="tp-grid2">
            <div className="tp-block"><h3 className="tp-h3">Commute reach</h3><p>Milton GO is about <b className="tp-inline">{f.commute.goDriveMin} min</b> by car and a Highway&nbsp;401 on-ramp about <b className="tp-inline">{f.commute.hwy401DriveMin} min</b> — measured from the {f.neighbourhood} area, not the doorstep.</p></div>
            <div className="tp-block">
              <h3 className="tp-h3">Nearest schools</h3>
              <ul className="tp-schools">
                {f.schoolsNearby.map((s) => (
                  <li key={s.name}><span className={`tp-dot tp-${s.board}`} />{s.name} <em>· ~{s.approxMin} min</em></li>
                ))}
              </ul>
              <p className="tp-sub">Distances are {f.neighbourhood}-area approximations — per-street geocoding isn&rsquo;t populated yet.</p>
            </div>
          </div>
        </section>

        {/* ── H2: on the market ── */}
        {f.active.total > 0 && (
          <section className="tp-sec">
            <h2 className="tp-h2">On the market right now</h2>
            <div className="tp-block"><p><b className="tp-inline">{f.active.total}</b> active listing — a {f.active.type} at <b className="tp-inline">{full(f.active.price)}</b>. Live inventory turns over; this is a snapshot.</p></div>
          </section>
        )}

        {/* ── LAYER 2 — grounded synthesis, no volatile numbers ── */}
        <section className="tp-sec tp-read">
          <div className="tp-read-eyebrow">The read</div>
          <h2 className="tp-h2">How to actually think about Clarriage Court</h2>
          {analysis.map((p, i) => (
            <p className="tp-read-p" key={i}>{p}</p>
          ))}
        </section>

        {/* ── conversion (the one place signal green is allowed) ── */}
        <section className="tp-cta">
          <div>
            <div className="tp-cta-h">Track Clarriage Court</div>
            <div className="tp-cta-p">Get an email when a home here is listed, sold, or leased.</div>
          </div>
          <a className="tp-cta-btn" href="/signin?intent=alert&street=clarriage-court-milton">Set an alert →</a>
        </section>
      </main>
    </div>
  );
}

export default TerminalStreetPage;
