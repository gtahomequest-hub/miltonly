// src/components/street/v2/StreetMinimalPage.tsx
// The MINIMAL street shell (registry ingest, 2026-07). A deterministic layout for a
// deliberately-published street with no generated profile. Reuses the forest-v2 Hero /
// Inventory / FinalCtas sections and CSS; adds a "where it is" block, schools and nearby
// streets. NO LLM prose.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40): the trust anchor ("No resales recorded
// yet" / "Too few recent sales to publish a price"), the area fallback line and the
// neighbourhood market block (the neighbourhood's sold count and typical) were claims derived
// from sold records, and left for every visitor. The hero's neutral line is the one mention.
import './street-theme.css';
import type { StreetV2Data } from './types';
import type { MinimalStreetView } from '@/lib/streetMinimal';
import { StreetHero, StreetInventory, StreetFinalCtas } from './sections';
import { StreetAddresses } from './AddressLadder';
import SiteNavLive from '../../nav/SiteNavLive';
import SiteFooter from '../../nav/SiteFooter';
import { GuideUplinks } from '../../guides/GuideUplinks';
import { guidesForStreet } from '@/lib/guides/uplinks';

export function StreetMinimalPage({ data, view }: { data: StreetV2Data; view: MinimalStreetView }) {
  const facts: Array<{ label: string; value: string }> = [];
  if (view.neighbourhoodName) facts.push({ label: 'Neighbourhood', value: view.neighbourhoodName });
  if (view.typeLabel) facts.push({ label: 'Street type', value: view.typeLabel.charAt(0).toUpperCase() + view.typeLabel.slice(1) });
  facts.push({ label: 'Official name', value: view.name });
  // THE PAGE IN THE CHROME (MH-006). The nav's CTA, the brief form and the strips follow the
  // street and its hub; the footer's brief form records the same.
  const hub = data.context.neighbourhoods[0];
  const navContext = { street: { slug: data.slug, name: data.name }, hub: hub ? { slug: hub.slug, name: hub.name } : undefined };

  return (
    <div className="street-v2">
      <SiteNavLive variant="page" context={navContext} />
      {/* This shell renders no sold-records island, so the neutral line signs in and returns
          here rather than pointing at an anchor the page does not carry. */}
      <StreetHero data={data} soldLine={{ returnPath: `/streets/${data.slug}` }} />

      {/* Section 2 — where it is + street facts */}
      <section className="s-block">
        <div className="s-wrap">
          <div className="s-sechead">
            <span className="s-eyebrow">The street</span>
            <h2>About {view.name}</h2>
          </div>
          <div className="s-desc-grid">
            <div className="s-prose">
              <p>{view.whereItIs}</p>
              {view.neighbourhoodName && view.neighbourhoodSlug && (
                <p>
                  It sits within{' '}
                  <a href={`/neighbourhoods/${view.neighbourhoodSlug}`}>{view.neighbourhoodName}</a>.
                </p>
              )}
            </div>
            <aside className="s-side">
              <div className="s-side-card">
                <h3>Street facts</h3>
                {facts.map((f) => (
                  <div className="s-fact" key={f.label}>
                    <span className="s-fact-l">{f.label}</span>
                    <span className="s-fact-v">{f.value}</span>
                  </div>
                ))}
              </div>
              {/* QUEUE item 5: the same road-facts card the full shell carries, same markup. */}
              {data.sidebar.geometry && (
                <div className="s-side-card s-geo" data-identity={data.sidebar.geometry.identity}>
                  <h3>Road facts</h3>
                  {data.sidebar.geometry.facts.map((f) => (
                    <div className="s-fact s-geo-fact" data-key={f.key} key={f.key}>
                      <span className="s-fact-l">{f.label}</span>
                      <span className="s-fact-v">{f.value}</span>
                    </div>
                  ))}
                  <div className="s-near-note">{data.sidebar.geometry.attribution}</div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

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
      <StreetAddresses data={data} />

      {/* Section 5 — nearby streets (link graph) */}
      {view.nearbyStreets.length > 0 && (
        <section className="s-block s-alt">
          <div className="s-wrap">
            <div className="s-sechead">
              <span className="s-eyebrow">Nearby</span>
              <h2>Streets near {view.name}</h2>
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

      {/* MC-003 guide up-links. Condo-heavy is an active condo listing (a condo type card), the
          same IDX marker the full shell reads (MC-046). */}
      <GuideUplinks
        guides={guidesForStreet({ condoHeavy: data.productTypes.some((t) => t.type === 'condo'), hubSlugs: view.neighbourhoodSlug ? [view.neighbourhoodSlug] : [] })}
        context={data.name}
        variant="street"
        hubs={view.neighbourhoodSlug ? [view.neighbourhoodSlug] : []}
      />

      <StreetFinalCtas data={data} />
      {/* The same map every page has (MH-006, MA-004 change 2). */}
      <SiteFooter context={navContext} />
    </div>
  );
}

export default StreetMinimalPage;
