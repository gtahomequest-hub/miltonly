// src/components/street/v2/StreetMinimalPage.tsx
// The MINIMAL street shell (registry ingest, 2026-07). A deterministic, honest
// layout for a deliberately-published zero/low-sale street. Reuses the forest-v2
// Hero / Inventory / FinalCtas sections and CSS; adds the no-data trust anchor,
// a "where it is" block, neighbourhood-level (clearly-labelled) market context,
// schools, and nearby streets. NO LLM prose, NO fabricated street-level stats.
import './street-theme.css';
import type { StreetV2Data } from './types';
import type { MinimalStreetView } from '@/lib/streetMinimal';
import { StreetHero, StreetInventory, StreetFinalCtas } from './sections';
import { SiteNav } from '../../nav/SiteNav';

export function StreetMinimalPage({ data, view }: { data: StreetV2Data; view: MinimalStreetView }) {
  const facts: Array<{ label: string; value: string }> = [];
  if (view.neighbourhoodName) facts.push({ label: 'Neighbourhood', value: view.neighbourhoodName });
  if (view.typeLabel) facts.push({ label: 'Street type', value: view.typeLabel.charAt(0).toUpperCase() + view.typeLabel.slice(1) });
  facts.push({ label: 'Official name', value: view.name });

  return (
    <div className="street-v2">
      <SiteNav variant="page" />
      <StreetHero data={data} />

      {/* Section 6 — the trust anchor. Plain, prominent, no hedging. */}
      <section className="s-block">
        <div className="s-wrap">
          <div
            className="s-placeholder"
            style={{ borderLeft: '3px solid var(--s-green, #2f6b3f)', paddingLeft: 20 }}
          >
            <h3>No resales recorded yet</h3>
            <p>{view.noData}</p>
          </div>
        </div>
      </section>

      {/* Section 2 — where it is + street facts */}
      <section className="s-block s-alt">
        <div className="s-wrap">
          <div className="s-sechead">
            <span className="s-eyebrow">The street</span>
            <h2>About {view.shortName}</h2>
          </div>
          <div className="s-desc-grid">
            <div className="s-prose">
              <p>{view.whereItIs}</p>
              {view.neighbourhoodName && view.neighbourhoodSlug && (
                <p>
                  It sits within{' '}
                  <a href={`/neighbourhoods/${view.neighbourhoodSlug}`}>{view.neighbourhoodName}</a>. The area read below
                  is the closest market signal we can offer honestly until a home on {view.shortName} trades.
                </p>
              )}
            </div>
            <aside className="s-side">
              <div className="s-side-card">
                <h4>Street facts</h4>
                {facts.map((f) => (
                  <div className="s-fact" key={f.label}>
                    <span className="s-fact-l">{f.label}</span>
                    <span className="s-fact-v">{f.value}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Section 4 — neighbourhood-level market context. Provenance is explicit:
          named as neighbourhood-wide, with the sample and window, never as this
          street's own numbers. */}
      {view.area && (
        <section className="s-block">
          <div className="s-wrap">
            <div className="s-sechead">
              <span className="s-eyebrow">Area market context</span>
              <h2>How {view.area.neighbourhoodName} is trading</h2>
            </div>
            <div className="s-msum">
              <p>
                These figures describe <b>{view.area.neighbourhoodName}</b> overall — {view.area.soldCount12mo} recorded
                {' '}sale{view.area.soldCount12mo === 1 ? '' : 's'} over the {view.area.window} — <b>not {view.shortName} specifically</b>.
                They are the neighbourhood the street belongs to, offered as context, not a street-level estimate.
              </p>
              <div className="s-msum-stats">
                <div className="s-stat" style={{ padding: 0 }}>
                  <div className="s-stat-l">Neighbourhood sales</div>
                  <div className="s-stat-v">{view.area.soldCount12mo}</div>
                </div>
                <div className="s-stat" style={{ padding: 0 }}>
                  <div className="s-stat-l">Window</div>
                  <div className="s-stat-v">{view.area.window}</div>
                </div>
                {view.area.marketScore != null && (
                  <div className="s-stat" style={{ padding: 0 }}>
                    <div className="s-stat-l">Market activity score</div>
                    <div className="s-stat-v">{Math.round(view.area.marketScore)}</div>
                  </div>
                )}
              </div>
              {view.neighbourhoodSlug && (
                <p style={{ marginTop: 16 }}>
                  <a className="s-b2" href={`/neighbourhoods/${view.neighbourhoodSlug}`}>
                    See the full {view.area.neighbourhoodName} market →
                  </a>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 3 — schools serving the area */}
      {view.schools.length > 0 && (
        <section className="s-block s-alt">
          <div className="s-wrap">
            <div className="s-sechead">
              <span className="s-eyebrow">Schools</span>
              <h2>Schools serving {view.neighbourhoodName ?? 'the area'}</h2>
            </div>
            <div className="s-ctx">
              <div className="s-ctx-col">
                {view.schools.map((s) => (
                  <a className="s-ctx-item" href={`/schools/${s.slug}`} key={s.slug}>
                    <div className="s-ctx-n">{s.name}</div>
                    <div className="s-ctx-m">
                      {s.boardName} · {s.level}
                      {s.grades ? ` · ${s.grades}` : ''}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section 7 — live listings (the new-construction earner) */}
      <StreetInventory data={data} />

      {/* Section 5 — nearby streets (link graph) */}
      {view.nearbyStreets.length > 0 && (
        <section className="s-block s-alt">
          <div className="s-wrap">
            <div className="s-sechead">
              <span className="s-eyebrow">Nearby</span>
              <h2>Streets near {view.shortName}</h2>
            </div>
            <div className="s-ctx">
              <div className="s-ctx-col">
                {view.nearbyStreets.map((n) => (
                  <a className="s-ctx-item" href={`/streets/${n.slug}`} key={n.slug}>
                    <div className="s-ctx-n">{n.name}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <StreetFinalCtas data={data} />
    </div>
  );
}

export default StreetMinimalPage;
