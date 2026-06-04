// src/components/hub/sections.tsx
import type {
  HubData,
  HubStreetCard,
  HubSibling,
} from './types';
import { fullPrice, compactPrice } from './format';
import {
  IconHome,
  IconPeople,
  IconTrain,
  IconSchool,
  IconTag,
} from './icons';

export function HubBreadcrumb({ name }: { name: string }) {
  return (
    <div className="h-hero">
      <div className="h-wrap">
        <div className="h-crumb">
          <a href="/">Miltonly</a>
          <span>/</span>
          <a href="/neighbourhoods">Neighbourhoods</a>
          <span>/</span>
          {name}
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accentDollar,
}: {
  value: number | null;
  label: string;
  accentDollar?: boolean;
}) {
  if (value === null) {
    return (
      <div className="h-hs">
        <div className="h-n h-silent">not stated</div>
        <div className="h-l">{label}</div>
      </div>
    );
  }
  return (
    <div className="h-hs">
      <div className="h-n">
        {accentDollar && <b>$</b>}
        {accentDollar ? compactPrice(value) : value}
      </div>
      <div className="h-l">{label}</div>
    </div>
  );
}

export function HubHero({ data }: { data: HubData }) {
  const { stats } = data;
  return (
    <header className="h-hero">
      <div className="h-wrap">
        <span className="h-eyebrow">
          {data.profile === 'rural' ? 'Rural Milton' : 'Milton neighbourhood'}
        </span>
        <h1>{data.name}</h1>
        <p className="h-character">{data.character}</p>
        <div className="h-herostats">
          <Stat value={stats.typicalPrice} label="typical home" accentDollar />
          <Stat value={stats.sold12mo} label="sold · last 12 months" />
          <Stat value={stats.onMarket} label="on the market" />
          <Stat value={stats.dom} label="median days on market" />
        </div>
      </div>
    </header>
  );
}

export function HubGlance({ data }: { data: HubData }) {
  const g = data.atAGlance;
  const items = [
    { ic: <IconTag />, l: 'Price range', v: g.priceRange, silent: g.priceRange === null },
    { ic: <IconHome />, l: 'Home types', v: g.dominantType },
    { ic: <IconPeople />, l: 'Best suits', v: g.suits.join(', ') },
    { ic: <IconTrain />, l: 'Commute', v: g.commute },
    { ic: <IconSchool />, l: 'Schools', v: g.schools },
  ];
  return (
    <div className="h-glance">
      <div className="h-wrap">
        <div className="h-card">
          {items.map((it) => (
            <div className="h-gi" key={it.l}>
              <div className="h-gi-ic">{it.ic}</div>
              <div className="h-gi-l">{it.l}</div>
              <div className={`h-gi-v${it.silent ? ' h-silent' : ''}`}>
                {it.v ?? 'not stated — thin activity'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HubOverview({ data }: { data: HubData }) {
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">The read</span>
          <h2>Inside {data.name}</h2>
        </div>
        <div className="h-overview">
          {data.overview.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HubMarket({ data }: { data: HubData }) {
  return (
    <section className="h-block h-alt">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">The market</span>
          <h2>How {data.name} trades</h2>
        </div>
        {data.marketCompare.length > 0 && (
          <div className="h-compare">
            {data.marketCompare.map((c) => (
              <div className="h-cmp" key={c.metricLabel}>
                <div className="h-cmp-l">{c.metricLabel}</div>
                <div className="h-cmp-v">{c.neighbourhoodValue}</div>
                <div className="h-cmp-vs">Milton: {c.miltonValue}</div>
                {c.delta && <div className="h-cmp-d">{c.delta}</div>}
              </div>
            ))}
          </div>
        )}
        <div className="h-commentary">
          {data.commentary.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="h-src">{data.commentary.source}</div>
        </div>
      </div>
    </section>
  );
}

function StreetCard({ s }: { s: HubStreetCard }) {
  const silent = s.typicalPriceRounded === null;
  const meta =
    s.soldCount !== null && !silent
      ? `${s.soldCount} sold · typically ${fullPrice(s.typicalPriceRounded as number)}`
      : s.soldCount !== null
        ? `${s.soldCount} sold`
        : 'thin activity — see street guide';
  return (
    <a className="h-st" href={`/streets/${s.slug}`}>
      {s.signal && <span className="h-st-sig">{s.signal}</span>}
      <div className="h-st-n">{s.name}</div>
      <div className={`h-st-m${silent && s.soldCount === null ? ' h-silent' : ''}`}>{meta}</div>
    </a>
  );
}

export function HubStreets({ data }: { data: HubData }) {
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-row-between">
          <div className="h-sechead" style={{ marginBottom: 0 }}>
            <span className="h-eyebrow">Street by street</span>
            <h2>Streets in {data.name}</h2>
          </div>
          <a className="h-more" href={`/neighbourhoods/${data.slug}/streets`}>
            View all streets →
          </a>
        </div>
        <div className="h-streets" style={{ marginTop: 28 }}>
          {data.streets.map((s) => (
            <StreetCard key={s.slug} s={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HubVip({ data }: { data: HubData }) {
  if (data.profile === 'rural' || data.vipStreets.length === 0) return null;
  return (
    <section className="h-block h-alt">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">Most active</span>
          <h2>Standout streets in {data.name}</h2>
        </div>
        <div className="h-vipgrid">
          {data.vipStreets.map((v) => (
            <a className="h-vip" href={`/streets/${v.slug}`} key={v.slug}>
              <div className="h-vip-n">{v.name}</div>
              <div className="h-vip-m">{v.soldCount} sold · full street guide</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HubCondos({ data }: { data: HubData }) {
  if (data.condos.length === 0) return null;
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">Condos &amp; towers</span>
          <h2>Condo buildings in {data.name}</h2>
        </div>
        <div className="h-condos">
          {data.condos.map((c) => (
            <a className="h-condo" href={`/condos/${c.slug}`} key={c.slug}>
              <IconHome />
              <div>
                <div className="h-condo-n">{c.name}</div>
                {c.meta && <div className="h-condo-m">{c.meta}</div>}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HubFaqs({ data }: { data: HubData }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="h-block h-alt">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">Common questions</span>
          <h2>About living in {data.name}</h2>
        </div>
        <div className="h-faq">
          {data.faqs.map((f, i) => (
            <div className="h-faq-item" key={i}>
              <div className="h-faq-q">{f.question}</div>
              <div className="h-faq-a">{f.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sibling({ s }: { s: HubSibling }) {
  const silent = s.typicalPriceRounded === null;
  return (
    <a className="h-sib" href={`/neighbourhoods/${s.slug}`}>
      <div className="h-sib-n">{s.name}</div>
      <div className="h-sib-c">{s.character}</div>
      <div className={`h-sib-p${silent ? ' h-silent' : ''}`}>
        {silent ? 'price not stated' : `typically ${fullPrice(s.typicalPriceRounded as number)}`}
      </div>
    </a>
  );
}

export function HubSiblings({ data }: { data: HubData }) {
  if (data.siblings.length === 0) return null;
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">Nearby</span>
          <h2>Explore other Milton neighbourhoods</h2>
        </div>
        <div className="h-sibgrid">
          {data.siblings.map((s) => (
            <Sibling key={s.slug} s={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HubDualCta({ data }: { data: HubData }) {
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-dual">
          <span className="h-eyebrow" style={{ color: 'var(--h-green)' }}>
            Your move in {data.name}
          </span>
          <div className="h-dualgrid" style={{ marginTop: 24 }}>
            <div className="h-dcard">
              <h3>{data.ctaBuyer.heading}</h3>
              <p>{data.ctaBuyer.body}</p>
              <a className="h-b2" href={data.ctaBuyer.href}>
                {data.ctaBuyer.buttonLabel} →
              </a>
            </div>
            <div className="h-dcard">
              <h3>{data.ctaSeller.heading}</h3>
              <p>{data.ctaSeller.body}</p>
              <a className="h-b1" href={data.ctaSeller.href}>
                {data.ctaSeller.buttonLabel} →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
