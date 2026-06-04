// src/components/condo/sections.tsx
import type { CondoData, CondoListing, CondoBedRow } from './types';
import { fullPrice } from './format';
import { IconWallet, IconPaw, IconKeyR, IconCar, IconBuilding, IntentIcon } from './icons';

export function CondoHero({ data }: { data: CondoData }) {
  const f = data.facts;
  const facts = [
    { n: f.units, l: 'units' },
    { n: f.storeys, l: 'storeys' },
    { n: f.yearBuilt, l: 'year built' },
  ];
  return (
    <header className="c-hero">
      <div className="c-wrap">
        <div className="c-crumb">
          <a href="/">Miltonly</a>
          <span>/</span>
          <a href={`/neighbourhoods/${data.neighbourhood.slug}`}>{data.neighbourhood.name}</a>
          <span>/</span>
          {data.name}
        </div>
        <div className="c-hero-grid">
          <div>
            <span className="c-eyebrow">Condo building</span>
            <h1>{data.name}</h1>
            <div className="c-addr">{data.address}</div>
            <p className="c-character">{data.character}</p>
            <div className="c-factline">
              {facts.map((x) => (
                <div className="c-fact" key={x.l}>
                  <div className={`c-fact-n${x.n === null ? ' c-silent' : ''}`}>
                    {x.n === null ? 'n/a' : x.n}
                  </div>
                  <div className="c-fact-l">{x.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="c-intents">
            {data.intents.map((it) => (
              <a className="c-intent" href={it.href} key={it.key}>
                <span className="c-intent-ic">
                  <IntentIcon k={it.key} />
                </span>
                <span className="c-intent-l">{it.label}</span>
                <span className="c-intent-s">{it.sub}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export function CondoCost({ data }: { data: CondoData }) {
  const o = data.ownership;
  return (
    <div className="c-cost">
      <div className="c-wrap">
        <div className="c-card">
          <div>
            <div className="c-cost-ic">
              <IconBuilding />
            </div>
            <div className="c-cost-l">Typical price</div>
            <div className={`c-cost-v${o.typicalPrice === null ? ' c-silent' : ''}`}>
              {o.typicalPrice === null ? 'not stated' : fullPrice(o.typicalPrice)}
            </div>
            {o.priceRange && <div className="c-cost-sub">Range {o.priceRange}</div>}
          </div>
          <div>
            <div className="c-cost-ic">
              <IconWallet />
            </div>
            <div className="c-cost-l">Maintenance fee</div>
            <div className={`c-cost-v${o.maintenanceFee === null ? ' c-silent' : ''}`}>
              {o.maintenanceFee ?? 'not stated'}
            </div>
            {o.maintenanceFee === null && o.feeNote && (
              <div className="c-cost-sub">{o.feeNote}</div>
            )}
          </div>
          <div>
            <div className="c-cost-l" style={{ marginTop: 38 }}>
              Fee includes
            </div>
            {o.feeIncludes.length > 0 ? (
              <div className="c-feeinc">
                {o.feeIncludes.map((x) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
            ) : (
              <div className="c-cost-sub">Not stated — confirm with management</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bed({ b }: { b: CondoBedRow }) {
  const silent = b.typicalPrice === null;
  return (
    <div className="c-bed">
      <div className="c-bed-l">{b.label}</div>
      <div className={`c-bed-p${silent ? ' c-silent' : ''}`}>
        {silent ? 'not stated' : fullPrice(b.typicalPrice as number)}
      </div>
      {b.soldCount !== null && <div className="c-bed-s">{b.soldCount} sold · 12 mo</div>}
    </div>
  );
}

export function CondoBedrooms({ data }: { data: CondoData }) {
  if (data.bedrooms.length === 0) return null;
  return (
    <section className="c-block">
      <div className="c-wrap">
        <div className="c-sechead">
          <span className="c-eyebrow">By suite type</span>
          <h2>Pricing by bedroom</h2>
        </div>
        <div className="c-beds">
          {data.bedrooms.map((b) => (
            <Bed key={b.label} b={b} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CondoOverview({ data }: { data: CondoData }) {
  return (
    <section className="c-block c-alt">
      <div className="c-wrap">
        <div className="c-sechead">
          <span className="c-eyebrow">The read</span>
          <h2>Inside {data.name}</h2>
        </div>
        <div className="c-overview">
          {data.overview.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Listing({ l }: { l: CondoListing }) {
  return (
    <a className="c-lst" href={l.href}>
      <span className={`c-tenure ${l.tenure === 'sale' ? 'c-sale' : 'c-lease'}`}>
        {l.tenure === 'sale' ? 'For sale' : 'For lease'}
      </span>
      <div className="c-lst-t">{l.title}</div>
      <div className="c-lst-m">{l.meta}</div>
      <div className="c-lst-p">{l.price}</div>
    </a>
  );
}

export function CondoListings({ data }: { data: CondoData }) {
  return (
    <section className="c-block">
      <div className="c-wrap">
        <div className="c-sechead">
          <span className="c-eyebrow">Available now</span>
          <h2>What&apos;s in the building</h2>
        </div>
        {data.listings.length > 0 ? (
          <div className="c-listings">
            {data.listings.map((l, i) => (
              <Listing key={i} l={l} />
            ))}
          </div>
        ) : (
          <div className="c-empty">
            No active listings in {data.name} right now — register to be alerted when a unit comes up.
          </div>
        )}
      </div>
    </section>
  );
}

export function CondoAmenities({ data }: { data: CondoData }) {
  if (data.amenities.length === 0) return null;
  return (
    <section className="c-block c-alt">
      <div className="c-wrap">
        <div className="c-sechead">
          <span className="c-eyebrow">In the building</span>
          <h2>Amenities</h2>
        </div>
        <div className="c-amen">
          {data.amenities.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CondoRulesSection({ data }: { data: CondoData }) {
  const r = data.rules;
  const rows = [
    { ic: <IconPaw />, l: 'Pets', v: r.pets },
    { ic: <IconKeyR />, l: 'Rentals', v: r.rentals },
    { ic: <IconCar />, l: 'Parking', v: r.parking },
    { ic: <IconBuilding />, l: 'Locker', v: r.locker },
  ];
  return (
    <section className="c-block">
      <div className="c-wrap">
        <div className="c-sechead">
          <span className="c-eyebrow">Good to know</span>
          <h2>Building rules &amp; policies</h2>
        </div>
        <div className="c-rules">
          {rows.map((x) => (
            <div className="c-rule" key={x.l}>
              {x.ic}
              <div>
                <div className="c-rule-l">{x.l}</div>
                <div className={`c-rule-v${x.v === null ? ' c-silent' : ''}`}>
                  {x.v ?? 'not stated'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CondoFaqs({ data }: { data: CondoData }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="c-block c-alt">
      <div className="c-wrap">
        <div className="c-sechead">
          <span className="c-eyebrow">Common questions</span>
          <h2>About {data.name}</h2>
        </div>
        <div className="c-faq">
          {data.faqs.map((f, i) => (
            <div className="c-faq-item" key={i}>
              <div className="c-faq-q">{f.question}</div>
              <div className="c-faq-a">{f.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CondoNearbySection({ data }: { data: CondoData }) {
  return (
    <section className="c-block">
      <div className="c-wrap">
        <a className="c-parent" href={`/neighbourhoods/${data.neighbourhood.slug}`}>
          ← All of {data.neighbourhood.name}
        </a>
        {data.nearbyCondos.length > 0 && (
          <>
            <div className="c-sechead">
              <span className="c-eyebrow">Nearby</span>
              <h2>Other condos in {data.neighbourhood.name}</h2>
            </div>
            <div className="c-nearby">
              {data.nearbyCondos.map((n) => (
                <a className="c-near" href={`/condos/${n.slug}`} key={n.slug}>
                  <div className="c-near-n">{n.name}</div>
                  {n.meta && <div className="c-near-m">{n.meta}</div>}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function CondoDualCta({ data }: { data: CondoData }) {
  return (
    <section className="c-block">
      <div className="c-wrap">
        <div className="c-dual">
          <span className="c-eyebrow" style={{ color: 'var(--c-green)' }}>
            Your move at {data.name}
          </span>
          <div className="c-dualgrid" style={{ marginTop: 24 }}>
            <div className="c-dcard">
              <h3>{data.ctaBuyer.heading}</h3>
              <p>{data.ctaBuyer.body}</p>
              <a className="c-b2" href={data.ctaBuyer.href}>
                {data.ctaBuyer.buttonLabel} →
              </a>
            </div>
            <div className="c-dcard">
              <h3>{data.ctaSeller.heading}</h3>
              <p>{data.ctaSeller.body}</p>
              <a className="c-b1" href={data.ctaSeller.href}>
                {data.ctaSeller.buttonLabel} →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
