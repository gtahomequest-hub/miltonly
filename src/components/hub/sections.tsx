// src/components/hub/sections.tsx
// THE REBUILT NEIGHBOURHOOD HUB, in the homepage's design language.
//
// The device is the same encyclopedia entry the homepage uses: a monospace index number in the
// left margin, a full-width hairline, the heading hard left with its standfirst beside it.
// Repeated exactly, section after section, so a reader moving from the homepage to a hub is
// reading one document rather than two products.
//
// THE TWO RULES THIS TEMPLATE IS BUILT AROUND
//
//   1. EVERY NUMBER SHOWS ITS BASIS WITHOUT BEING HUNTED FOR. Not in a tooltip, not in a
//      footnote, not on hover: under the figure, in the same block, always. A price with a
//      hidden sample is the defect this repo spends most of its guards catching, and the
//      layout is now the first guard rather than the last.
//   2. NOTHING STATIC SURVIVES. Every fact in the glance panel is derived and carries its
//      own basis; a fact whose source is empty is dropped, not softened into a sentence
//      that was true of all of Milton.
//
// STREETS LINK DOWN IN THREE RUNGS, video first: the filmed strip (01), the ladder of every
// published street, marking which are filmed and carrying each street page's own typical (02),
// and the A-to-Z index (03): the hub's own overflow page above the cap, the Milton-wide
// directory below it.
//
// SECTION NUMBERS ARE COMPUTED. A section that does not render (no clip, no school, no condo)
// leaves no gap in the count, so a reader never sees 01 followed by 03.
import type { HubData, HubStreetCard, HubSibling, HubFact } from './types';
import { compactPrice } from './format';
import { IconTag, IconHome, IconPeople, IconKey, IconInvest } from './icons';

/* ── the repeated device ───────────────────────────────────────────────── */

function SectionHead({
  index,
  title,
  standfirst,
  action,
}: {
  index: string;
  title: string;
  standfirst?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="hh-head">
      <span className="hh-index" aria-hidden="true">{index}</span>
      <div className="hh-headmain">
        <h2>{title}</h2>
        {standfirst ? <p>{standfirst}</p> : null}
      </div>
      {action ? <a className="hh-headaction" href={action.href}>{action.label}</a> : null}
    </div>
  );
}

/** The order sections render in, and which of them this hub has. Numbering is derived from it. */
const SECTION_ORDER = ['film', 'streets', 'about', 'market', 'schools', 'condos', 'questions', 'nearby', 'talk'] as const;
type SectionKey = (typeof SECTION_ORDER)[number];
function rendered(data: HubData, key: SectionKey): boolean {
  switch (key) {
    case 'film': return (data.videoStreets?.length ?? 0) > 0;
    case 'about': return data.overview.length > 0;
    case 'schools': return (data.schools?.length ?? 0) > 0;
    case 'condos': return data.condos.length > 0;
    case 'questions': return data.faqs.length > 0;
    case 'nearby': return data.siblings.length > 0;
    default: return true;
  }
}
function idx(data: HubData, key: SectionKey): string {
  const n = SECTION_ORDER.filter((k) => rendered(data, k)).indexOf(key) + 1;
  return String(n).padStart(2, '0');
}

export function HubBreadcrumb({ name }: { name: string }) {
  return (
    <nav className="hh-crumb" aria-label="Breadcrumb">
      <a href="/">Milton</a>
      <span aria-hidden="true">/</span>
      <a href="/neighbourhoods">Neighbourhoods</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

/* ── hero ──────────────────────────────────────────────────────────────── */

const FACT_ICONS: Record<string, React.ReactNode> = {
  typical: <IconTag />,
  pages: <IconHome />,
  video: <IconInvest />,
  schools: <IconPeople />,
  active: <IconKey />,
  stock: <IconHome />,
};

/** A figure, its label, and the sample it was computed over. The basis is not optional. */
function Fact({ f }: { f: HubFact }) {
  const body = (
    <>
      <span className="hh-fact-ic" aria-hidden="true">{FACT_ICONS[f.key] ?? <IconTag />}</span>
      <span className="hh-fact-v" data-fig={`hub-fact-${f.key}`} data-value={f.value}>{f.value}</span>
      <span className="hh-fact-l">{f.label}</span>
      <span className="hh-fact-b">{f.basis}</span>
    </>
  );
  return f.href ? (
    <a className="hh-fact" href={f.href}>{body}</a>
  ) : (
    <div className="hh-fact">{body}</div>
  );
}

export function HubHero({ data }: { data: HubData }) {
  return (
    <header className="hh-hero">
      <div className="hh-wrap">
        <HubBreadcrumb name={data.name} />
        <h1>{data.name}</h1>
        {data.character ? <p className="hh-lede">{data.character}</p> : null}

        {/* THE INTENT SQUARES. Both dead destinations were fixed on 2026-09-10: "/#mls"
            pointed at a homepage section that no longer exists, and "#streets" had no
            target id. hub-intents.mjs now resolves the route half and the fragment half
            of every one of these. */}
        <div className="hh-intents">
          {data.intents.map((it) => (
            <a className="hh-intent" href={it.href} key={it.key}>
              <span className="hh-intent-l">{it.label}</span>
              <span className="hh-intent-s">{it.sub}</span>
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ── the derived-fact panel ────────────────────────────────────────────── */

export function HubGlance({ data }: { data: HubData }) {
  const facts = data.atAGlance.facts;
  if (facts.length === 0) return null; // nothing derived, nothing shown
  return (
    <section className="hh-sec hh-glance">
      <div className="hh-wrap">
        <div className="hh-facts">
          {facts.map((f) => <Fact f={f} key={f.key} />)}
        </div>
      </div>
    </section>
  );
}

/* ── 01 · streets on film (rung one) ───────────────────────────────────── */

export function HubVideoStreets({ data }: { data: HubData }) {
  const v = data.videoStreets ?? [];
  if (v.length === 0) return null; // most hubs have no clip; the section simply is not there
  return (
    <section className="hh-sec hh-video" id="film">
      <div className="hh-wrap">
        <SectionHead
          index={idx(data, 'film')}
          title={`${data.name} on film`}
          standfirst={`${v.length === 1 ? 'One street' : `${v.length} streets`} here driven end to end. Watch the street before you book the showing: the parking, the setbacks, the tree cover, the light.`}
        />
        <ul className="hh-filmstrip">
          {v.map((s) => (
            <li key={s.slug}>
              <a href={`/streets/${s.slug}`}>
                <span className="hh-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.poster} alt={`${s.name}, Milton`} loading="lazy" width={320} height={180} />
                  {s.variant === 'night' ? <span className="hh-nightmark">Overnight</span> : null}
                </span>
                <span className="hh-framename">{s.name}</span>
                {s.capturedAt ? <span className="hh-framedate">Captured {s.capturedAt}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── 02 · the street ladder (rung two) ─────────────────────────────────── */

function LadderRow({ s, rank, max }: { s: HubStreetCard; rank: number; max: number }) {
  const n = s.soldCount ?? 0;
  return (
    <li>
      <a href={`/streets/${s.slug}`}>
        <span className="hh-ladrank" aria-hidden="true">{String(rank).padStart(2, '0')}</span>
        <span className="hh-ladname">
          {s.name}
          {s.hasVideo ? <span className="hh-ladfilm" title="filmed end to end">film</span> : null}
        </span>
        <span className="hh-ladbar" aria-hidden="true">
          <span style={{ width: `${Math.max(2, Math.round((n / max) * 100))}%` }} />
        </span>
        <span className="hh-ladsales" data-fig="hub-street-sold" data-slug={s.slug} data-value={n}>
          {n} <em>{n === 1 ? 'sale' : 'sales'}</em>
        </span>
        <span className="hh-ladprice" data-fig="hub-street-typical" data-slug={s.slug} data-value={s.typicalPriceRounded ?? ''}>
          {s.typicalPriceRounded !== null
            ? `$${compactPrice(s.typicalPriceRounded)}`
            : <em className="hh-ladsilent">sample too small to publish</em>}
        </span>
        {/* THE BASIS, ON THE ROW. Every price on this page states the sample and window it
            was computed over, in the same block as the figure. The silent row states the
            floor it sits under, the same sentence its street page prints. */}
        <span className="hh-ladbasis">{s.basis ?? 'fewer than five recorded sales, so no price is stated'}</span>
      </a>
    </li>
  );
}

export function HubStreets({ data }: { data: HubData }) {
  const n = data.streets.length;
  const max = Math.max(...data.streets.map((s) => s.soldCount ?? 0), 1);
  const filmed = data.streets.filter((s) => s.hasVideo).length;
  // RUNG THREE. The hub's own A-to-Z page exists only above the ladder cap (it would be a
  // duplicate of this list below it); under the cap the third rung is the Milton-wide directory.
  const action = data.hasStreetOverflow
    ? { href: `/neighbourhoods/${data.slug}/streets`, label: `${data.streetCount} streets, A to Z` }
    : { href: '/streets', label: 'Every Milton street, A to Z' };
  return (
    <section className="hh-sec hh-streets" id="streets">
      <div className="hh-wrap">
        <SectionHead
          index={idx(data, 'streets')}
          title={`Every street in ${data.name} with a page`}
          standfirst={
            n === 0
              ? `No street guide is published in ${data.name} yet. The neighbourhood figures above still hold; the street-level read is what is missing.`
              : `${n === 1 ? 'One street' : `All ${n} streets`}, ranked by sales in the last 12 months${filmed ? `, ${filmed} of them filmed` : ''}. Each price is the figure that street's own page publishes, over the same sample, and the sample is printed under it.`
          }
          action={action}
        />
        {n === 0 ? null : (
          <ol className="hh-ladder">
            {data.streets.map((s, i) => <LadderRow s={s} rank={i + 1} max={max} key={s.slug} />)}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ── 03 · what it is like ──────────────────────────────────────────────── */

export function HubOverview({ data }: { data: HubData }) {
  if (data.overview.length === 0) return null;
  return (
    <section className="hh-sec hh-overview" id="about">
      <div className="hh-wrap">
        <SectionHead index={idx(data, 'about')} title={`What ${data.name} is like`} />
        <div className="hh-prose">
          {data.overview.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
    </section>
  );
}

/* ── 04 · the market ───────────────────────────────────────────────────── */

export function HubMarket({ data }: { data: HubData }) {
  const hasCompare = data.marketCompare.length > 0;
  return (
    <section className="hh-sec hh-market" id="market">
      <div className="hh-wrap">
        <SectionHead
          index={idx(data, 'market')}
          title={`How ${data.name} trades`}
          standfirst={
            data.typicalBasis
              ? `The typical sale price here, ${data.typicalBasis}, beside Milton's over the same window.`
              : data.stats.sold12mo !== null && data.stats.sold12mo < 5
                ? `${data.stats.sold12mo === 0 ? 'No recorded sales' : `${data.stats.sold12mo} recorded ${data.stats.sold12mo === 1 ? 'sale' : 'sales'}`} in the last 12 months, below the floor of five at which a price is published.`
                : undefined
          }
        />
        {hasCompare ? (
          <div className="hh-compare">
            {data.marketCompare.map((r) => (
              <div className="hh-comparerow" key={r.metricLabel}>
                <span className="hh-comparel">
                  {r.metricLabel}
                  <span className="hh-compareb">{data.name}: {data.typicalBasis}. Milton: {data.miltonBasis ?? 'sample not stated'}.</span>
                </span>
                <span className="hh-comparev" data-fig="hub-compare-typical" data-value={r.neighbourhoodValue}>{r.neighbourhoodValue}</span>
                <span className="hh-comparem">Milton <b data-fig="hub-compare-milton" data-value={r.miltonValue}>{r.miltonValue}</b></span>
                <span className="hh-compared">{r.delta}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="hh-prose">
          {data.commentary.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <p className="hh-source">{data.commentary.source}</p>
      </div>
    </section>
  );
}

/* ── 05 · schools ──────────────────────────────────────────────────────── */

export function HubSchools({ data }: { data: HubData }) {
  const s = data.schools ?? [];
  if (s.length === 0) return null;
  return (
    <section className="hh-sec hh-schools" id="schools">
      <div className="hh-wrap">
        <SectionHead
          index={idx(data, 'schools')}
          title="Schools inside the boundary"
          standfirst="Schools whose position falls inside the Town of Milton's boundary for this neighbourhood. That is where the school stands, not which homes it takes: a catchment is the school board's fact, and we do not publish one."
          action={{ href: '/schools', label: 'All schools' }}
        />
        <ul className="hh-schoollist">
          {s.map((sc) => (
            <li key={sc.slug}>
              <a href={`/schools/${sc.slug}`}>
                <span className="hh-schoolname">{sc.name}</span>
                <span className="hh-schoolmeta">
                  {sc.board === 'public' ? 'Public' : 'Catholic'} · {sc.level === 'secondary' ? 'Secondary' : 'Elementary'}
                  {sc.fraserScore ? ` · Fraser ${sc.fraserScore}` : ''}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── 06 · condo buildings ──────────────────────────────────────────────── */

export function HubCondos({ data }: { data: HubData }) {
  if (data.condos.length === 0) return null;
  return (
    <section className="hh-sec hh-condos" id="condos">
      <div className="hh-wrap">
        <SectionHead
          index={idx(data, 'condos')}
          title={`Condo buildings in ${data.name}`}
          standfirst={`${data.condos.length} ${data.condos.length === 1 ? 'building' : 'buildings'} with a page of its own.`}
          action={{ href: '/condos', label: 'All buildings' }}
        />
        <ul className="hh-condolist">
          {data.condos.map((c) => (
            <li key={c.slug}>
              <a href={`/condos/${c.slug}`}>
                <span className="hh-condoname">{c.name}</span>
                {c.meta ? <span className="hh-condoaddr">{c.meta}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── 07 · questions ────────────────────────────────────────────────────── */

export function HubFaqs({ data }: { data: HubData }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="hh-sec hh-faqs" id="questions">
      <div className="hh-wrap">
        <SectionHead index={idx(data, 'questions')} title={`${data.name} questions`} />
        <div className="hh-faqlist">
          {data.faqs.map((f) => (
            <details key={f.question}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 08 · nearby ───────────────────────────────────────────────────────── */

function Sibling({ s }: { s: HubSibling }) {
  const sales = `${s.salesCount} ${s.salesCount === 1 ? 'sale' : 'sales'} in 12 months`;
  return (
    <a className="hh-sib" href={`/neighbourhoods/${s.slug}`}>
      <span className="hh-sibname">{s.name}</span>
      {s.distanceKm !== null ? <span className="hh-sibdist">{s.distanceKm.toFixed(1)} km away</span> : null}
      <span className="hh-sibprice" data-fig="hub-sibling-typical" data-slug={s.slug} data-value={s.typicalPriceRounded ?? ''}>
        {s.typicalPriceRounded !== null ? `$${compactPrice(s.typicalPriceRounded)} typical` : 'price not published'}
      </span>
      <span className="hh-sibbasis">
        {s.typicalPriceRounded !== null ? `across ${sales}` : `${sales}, below the floor of five`}
        {s.streetPages > 0 ? ` · ${s.streetPages} ${s.streetPages === 1 ? 'street page' : 'street pages'}` : ''}
      </span>
    </a>
  );
}

export function HubSiblings({ data }: { data: HubData }) {
  if (data.siblings.length === 0) return null;
  const byDistance = data.nearbyByDistance === true;
  return (
    <section className="hh-sec hh-siblings" id="nearby">
      <div className="hh-wrap">
        <SectionHead
          index={idx(data, 'nearby')}
          title={byDistance ? 'Nearest neighbourhoods' : 'Other rural neighbourhoods'}
          standfirst={
            byDistance
              ? `The four closest hubs, measured boundary centre to boundary centre on the Town of Milton's neighbourhood map. Each price is that neighbourhood's own published typical, suppressed below five sales.`
              : `The Town of Milton draws no boundary for ${data.name}, so no distance is stated. Each price is that neighbourhood's own published typical, suppressed below five sales.`
          }
          action={{ href: '/neighbourhoods', label: 'All neighbourhoods' }}
        />
        <div className="hh-sibgrid">
          {data.siblings.map((s) => <Sibling s={s} key={s.slug} />)}
        </div>
      </div>
    </section>
  );
}

/* ── 09 · the two CTAs ─────────────────────────────────────────────────── */

export function HubDualCta({ data }: { data: HubData }) {
  return (
    <section className="hh-sec hh-cta" id="talk">
      <div className="hh-wrap">
        <SectionHead index={idx(data, 'talk')} title={`Buying or selling in ${data.name}`} />
        <div className="hh-ctagrid">
          {[data.ctaBuyer, data.ctaSeller].map((c) => (
            <div className="hh-ctacard" key={c.heading}>
              <h3>{c.heading}</h3>
              <p>{c.body}</p>
              <a href={c.href}>{c.buttonLabel}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Retired with the 2026-09-10 rebuild: HubVip (the VIP strip duplicated the ladder's top rows
   with less information, and the ladder now marks VIP streets inline). */
