// src/components/street/v2/sections.tsx
// Presentational sections for the forest-v2 street shell. Every suppressible
// surface renders the .s-silent state when its value is null — never a number.
import type {
  StreetV2Data,
  StreetStat,
  ProductPill,
  TypeBlock,
  GlanceTile,
  MarketSummaryCard,
  SoldRecordsBlock,
  ListingCard,
  ChartPoint,
} from './types';
import { compactPrice, fullPrice, shortPrice, pct, band, barFraction } from './format';
import { CommuteIcon } from './icons';

const DEFAULT_SILENT = 'sample too small to publish';

/* ───── hero ───── */

function HeroStat({ stat }: { stat: StreetStat }) {
  const isSilent =
    stat.kind === 'text' ? stat.textValue == null : stat.value == null;
  if (isSilent) {
    return (
      <div className="s-hs">
        <div className="s-n s-silent">{stat.silentNote ?? DEFAULT_SILENT}</div>
        <div className="s-l">{stat.label}</div>
      </div>
    );
  }
  return (
    <div className="s-hs">
      <div className="s-n">
        {stat.kind === 'price' && (
          <>
            <b>$</b>
            {compactPrice(stat.value as number)}
          </>
        )}
        {stat.kind === 'count' && <>{stat.value}</>}
        {stat.kind === 'text' && <>{stat.textValue}</>}
      </div>
      <div className="s-l">{stat.label}</div>
      {stat.sub && <div className="s-sub">{stat.sub}</div>}
    </div>
  );
}

function Pill({ p }: { p: ProductPill }) {
  const silent = p.typicalPrice === null;
  return (
    <a className="s-pill" href={p.anchor}>
      <span className="s-pill-t">{p.displayName}</span>
      <span className="s-pill-c">{p.count}</span>
      <span className={`s-pill-p${silent ? ' s-silent' : ''}`}>
        {silent ? p.priceLabel : `${shortPrice(p.typicalPrice as number)} ${p.priceLabel}`}
      </span>
    </a>
  );
}

/** render the street name with its final word italic (matches the navy hero's H1 treatment) */
function ItalicLastWord({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return <em>{name}</em>;
  const head = words.slice(0, -1).join(' ');
  const last = words[words.length - 1];
  return (
    <>
      {head} <em>{last}</em>
    </>
  );
}

export function StreetHero({ data }: { data: StreetV2Data }) {
  return (
    <header className="s-hero">
      <div className="s-wrap">
        <div className="s-crumb">
          <a href="/">Miltonly</a>
          <span>/</span>
          <a href="/streets">Streets</a>
          <span>/</span>
          {data.name}
        </div>
        <span className="s-eyebrow">{data.eyebrow}</span>
        <h1>
          <ItalicLastWord name={data.name} />
        </h1>
        <p className="s-character">{data.subtitle}</p>
        <div className="s-herostats">
          {data.hero.stats.map((s) => (
            <HeroStat key={s.label} stat={s} />
          ))}
        </div>
        {data.hero.salePills.length > 0 && (
          <div className="s-pillrow">
            <span className="s-pillrow-l">
              <span className="s-dot" />
              Recent sales
            </span>
            {data.hero.salePills.map((p) => (
              <Pill key={p.type} p={p} />
            ))}
          </div>
        )}
        {data.hero.leasePills.length > 0 && (
          <div className="s-pillrow">
            <span className="s-pillrow-l">
              <span className="s-dot s-dot-blue" />
              Recent leases
            </span>
            {data.hero.leasePills.map((p) => (
              <Pill key={`lease-${p.type}`} p={p} />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* ───── at-a-glance ───── */

export function StreetGlance({ data }: { data: StreetV2Data }) {
  return (
    <div className="s-glance">
      <div className="s-wrap">
        <div className="s-card">
          {data.glance.map((t: GlanceTile) => {
            const silent = t.value === null;
            return (
              <div className="s-gi" key={t.label}>
                <div className="s-gi-l">{t.label}</div>
                <div className={`s-gi-v${silent ? ' s-silent' : ''}`}>
                  {silent ? t.silentNote ?? 'under publish threshold' : t.value}
                </div>
                {t.detail && <div className="s-gi-d">{t.detail}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───── prose body + sidebar ───── */

function Sidebar({ data }: { data: StreetV2Data }) {
  const { sidebar } = data;
  return (
    <aside className="s-side">
      {sidebar.facts.length > 0 && (
        <div className="s-side-card">
          <h4>Street facts</h4>
          {sidebar.facts.map((f) => (
            <div className="s-fact" key={f.label}>
              <span className="s-fact-l">{f.label}</span>
              <span className="s-fact-v">{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {sidebar.nearby.length > 0 && (
        <div className="s-side-card">
          <h4>Nearby</h4>
          {sidebar.nearby.map((n) => (
            <div className="s-near" key={n.name}>
              {n.icon && <span className="s-near-ic">{n.icon}</span>}
              <span className="s-near-n">{n.name}</span>
              <span className="s-near-d">{n.distance}</span>
            </div>
          ))}
        </div>
      )}
      <div className="s-side-cta">
        <span className="s-eyebrow">{sidebar.cta.eyebrow}</span>
        <h4>{sidebar.cta.headline}</h4>
        <p>{sidebar.cta.body}</p>
        <a className="s-b1" href={sidebar.cta.actionHref}>
          {sidebar.cta.actionLabel}
        </a>
        {sidebar.cta.trustLine && <div className="s-trust">{sidebar.cta.trustLine}</div>}
      </div>
    </aside>
  );
}

export function StreetBody({ data }: { data: StreetV2Data }) {
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-desc-grid">
          <div className="s-prose">
            {data.placeholder ? (
              <div className="s-placeholder">
                <h3>Profile in preparation</h3>
                <p>
                  We are still assembling the editorial read for {data.name}. The live market
                  data below is current — the written profile follows shortly.
                </p>
              </div>
            ) : (
              data.sections.map((sec, i) => (
                <div className="s-prose-sec" key={sec.id} id={`s-${sec.id}`}>
                  <h3>{sec.heading}</h3>
                  {sec.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                  {/* owner inline CTA after the first section, only when a typical price publishes */}
                  {i === 0 && data.ownerCtaPrice !== null && (
                    <div className="s-inline-cta">
                      <div className="s-inline-h">
                        Own on {data.shortName}? Typical is <b>{shortPrice(data.ownerCtaPrice)}</b>.
                      </div>
                      <a href="#valuation">Value my home</a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <Sidebar data={data} />
        </div>
      </div>
    </section>
  );
}

/* ───── per-type sections ───── */

function MiniBars({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <div className="s-bars">
      {data.map((d) => (
        <div className="s-bar" key={d.quarter} title={`${d.quarter}: ${fullPrice(Math.round(d.value))} · ${d.count} sold`}>
          <div className="s-bar-fill" style={{ height: `${barFraction(d.value, max) * 100}%` }} />
          <div className="s-bar-q">{d.quarter}</div>
        </div>
      ))}
    </div>
  );
}

function TypeStatCell({
  label,
  value,
  detail,
  silentNote,
}: {
  label: string;
  value: string | null;
  detail?: string;
  silentNote?: string;
}) {
  const silent = value === null;
  return (
    <div className="s-stat">
      <div className="s-stat-l">{label}</div>
      <div className={`s-stat-v${silent ? ' s-silent' : ''}`}>{silent ? silentNote ?? '—' : value}</div>
      {detail && <div className="s-stat-d">{detail}</div>}
    </div>
  );
}

function TypeCard({ t }: { t: TypeBlock }) {
  const publishable = t.typicalPrice !== null;
  return (
    <div className="s-type" id={`type-${t.type}`}>
      <div className="s-type-head">
        <h3>{t.displayName}</h3>
        <span className="s-type-n">{t.salesCount} recent sales</span>
      </div>
      <p className="s-type-intro">{t.intro}</p>
      <div className="s-type-stats">
        <TypeStatCell
          label="Typical price"
          value={publishable ? shortPrice(t.typicalPrice as number) : null}
          detail={publishable ? `across ${t.salesCount} sales` : undefined}
          silentNote="under publish threshold"
        />
        <TypeStatCell
          label="Price band"
          value={t.priceBand ? band(t.priceBand.low, t.priceBand.high) : null}
          silentNote="—"
        />
        <TypeStatCell label="Time on market" value={t.dom !== null ? `${Math.round(t.dom)} days` : null} silentNote="—" />
        <TypeStatCell label="Sold to ask" value={t.soldToAsk !== null ? pct(t.soldToAsk) : null} silentNote="—" />
        {t.activeCount !== null && (
          <TypeStatCell
            label="Active listings"
            value={String(t.activeCount)}
            detail={t.activeAvgList !== null ? `avg list ${shortPrice(t.activeAvgList)}` : undefined}
          />
        )}
      </div>
      {t.contactTeamPrompt && (
        <div className="s-contact-prompt">
          Only {t.salesCount} recent {t.displayName.toLowerCase()} sale{t.salesCount === 1 ? '' : 's'} on record — too
          few to publish a typical price without identifying a home.{' '}
          <a href="#valuation">Ask the team for a private read →</a>
        </div>
      )}
      {t.chart && (
        <div className="s-chart">
          <div className="s-chart-head">
            <span className="s-chart-h">{t.chart.headline}</span>
            <span className="s-chart-trend">{t.chart.trendLabel}</span>
          </div>
          <div className="s-chart-note">{t.chart.note}</div>
          <MiniBars data={t.chart.data} />
        </div>
      )}
    </div>
  );
}

export function StreetTypes({ data }: { data: StreetV2Data }) {
  if (data.productTypes.length === 0) return null;
  return (
    <section className="s-block s-alt">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">By the home</span>
          <h2>What trades on {data.shortName}, by type</h2>
        </div>
        <div className="s-types">
          {data.productTypes.map((t) => (
            <TypeCard key={t.type} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── market activity + gated sold records ───── */

function SummaryCard({ card }: { card: MarketSummaryCard }) {
  return (
    <div className="s-msum">
      <h3>{card.title}</h3>
      <p>{card.body}</p>
      <div className="s-msum-stats">
        {card.stats.map((st) => {
          const silent = st.value === null;
          return (
            <div className="s-stat" key={st.label} style={{ padding: 0 }}>
              <div className="s-stat-l">{st.label}</div>
              <div className={`s-stat-v${silent ? ' s-silent' : ''}`}>{silent ? '—' : st.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SoldRecords({ block }: { block: SoldRecordsBlock }) {
  return (
    <div className={`s-records${block.canSee ? '' : ' s-gated'}`}>
      <div className="s-records-cap">{block.caption}</div>
      <table className="s-rtable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Address</th>
            <th>Beds</th>
            <th>Sold</th>
            <th>vs Ask</th>
            <th>DOM</th>
            <th>Listing brokerage</th>
          </tr>
        </thead>
        <tbody>
          {block.records.map((r) => (
            <tr key={r.mlsNumber}>
              <td>{r.date.slice(0, 10)}</td>
              <td>{r.address}</td>
              <td>{r.beds ?? '—'}</td>
              <td>{shortPrice(r.soldPrice)}</td>
              <td>{pct(r.soldToAsk)}</td>
              <td>{r.dom}d</td>
              <td className="s-r-brok">{r.brokerage ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="s-gate">
        <div className="s-gate-k">TREB VOW · Registered access</div>
        <div className="s-gate-h">See every closed sale on {block.caption.replace(/^Recent closed sales,\s*/, '')}</div>
        <div className="s-gate-p">Free with a verified email — exact sold prices, days on market, and sold-to-ask ratios.</div>
        <a className="s-gate-btn" href={block.signinHref}>
          Sign in free to unlock →
        </a>
      </div>
    </div>
  );
}

export function StreetMarket({ data }: { data: StreetV2Data }) {
  const m = data.market;
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">The market</span>
          <h2>Recent activity on {data.shortName}</h2>
        </div>
        <div className="s-market-grid">
          <SummaryCard card={m.sales} />
          {m.leases && <SummaryCard card={m.leases} />}
        </div>
        {m.rentByBeds && (
          <div className="s-rentgrid">
            {m.rentByBeds.map((r) => {
              const silent = r.value === null;
              return (
                <div className="s-rent" key={r.label}>
                  <div className="s-rent-l">{r.label}</div>
                  <div className={`s-rent-v${silent ? ' s-silent' : ''}`}>{silent ? '—' : r.value}</div>
                  {r.detail && <div className="s-gi-d">{r.detail}</div>}
                </div>
              );
            })}
          </div>
        )}
        {m.priceChart && (
          <div className="s-market-chart">
            <div className="s-chart-head">
              <span className="s-chart-h">Quarterly sold price · all types</span>
            </div>
            <MiniBars data={m.priceChart.data} />
            <div className="s-chart-cap">{m.priceChart.caption}</div>
          </div>
        )}
        <SoldRecords block={data.soldRecords} />
      </div>
    </section>
  );
}

/* ───── commute ───── */

export function StreetCommute({ data }: { data: StreetV2Data }) {
  if (data.commute.length === 0) return null;
  return (
    <section className="s-block s-alt">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">Getting around</span>
          <h2>Commute &amp; reach from {data.shortName}</h2>
        </div>
        <div className="s-commute">
          {data.commute.map((c) => (
            <div className="s-cc" key={c.id}>
              <div className="s-cc-head">
                <span className="s-cc-ic">
                  <CommuteIcon k={c.icon} />
                </span>
                <div>
                  <div className="s-cc-t">{c.title}</div>
                  <div className="s-cc-s">{c.subtitle}</div>
                </div>
              </div>
              {c.destinations.map((d) => (
                <div className="s-cd" key={d.name}>
                  <span className="s-cd-n">{d.name}</span>
                  <span className="s-cd-t">
                    {d.primaryTime}
                    {d.secondaryTime ? ` · ${d.secondaryTime}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── active inventory ───── */

function ListingTile({ l }: { l: ListingCard }) {
  return (
    <a className="s-listing" href={l.href}>
      <div
        className="s-listing-ph"
        style={l.photo ? { backgroundImage: `url(${l.photo})` } : undefined}
      >
        {l.daysOnMarket !== null && <span className="s-listing-dom">{l.daysOnMarket}d on market</span>}
      </div>
      <div className="s-listing-body">
        <div className="s-listing-p">{shortPrice(l.price)}</div>
        <div className="s-listing-a">{l.address}</div>
        <div className="s-listing-m">
          <span>{l.bedrooms} bd</span>
          <span>{l.bathrooms} ba</span>
          <span>{l.parking} pk</span>
          <span>{l.propertyType}</span>
        </div>
      </div>
    </a>
  );
}

export function StreetInventory({ data }: { data: StreetV2Data }) {
  if (data.activeListings.length === 0) return null;
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">On the market</span>
          <h2>Active listings on {data.shortName}</h2>
        </div>
        <div className="s-inv">
          {data.activeListings.map((l) => (
            <ListingTile key={l.mlsNumber} l={l} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── context cards ───── */

export function StreetContext({ data }: { data: StreetV2Data }) {
  const c = data.context;
  if (c.similarStreets.length + c.neighbourhoods.length + c.schools.length === 0) return null;
  return (
    <section className="s-block s-alt">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">In context</span>
          <h2>Around {data.shortName}</h2>
        </div>
        <div className="s-ctx">
          {c.similarStreets.length > 0 && (
            <div className="s-ctx-col">
              <h4>Similar streets</h4>
              {c.similarStreets.map((s) => (
                <a className="s-ctx-item" href={`/streets/${s.slug}`} key={s.slug}>
                  <div className="s-ctx-n">{s.name}</div>
                  <div className="s-ctx-m">
                    {s.count} active · avg {shortPrice(s.avgPrice)}
                  </div>
                </a>
              ))}
            </div>
          )}
          {c.neighbourhoods.length > 0 && (
            <div className="s-ctx-col">
              <h4>Neighbourhoods</h4>
              {c.neighbourhoods.map((n) => (
                <a className="s-ctx-item" href={`/neighbourhoods/${n.slug}`} key={n.slug}>
                  <div className="s-ctx-n">{n.name}</div>
                  <div className="s-ctx-m">{n.summary}</div>
                </a>
              ))}
            </div>
          )}
          {c.schools.length > 0 && (
            <div className="s-ctx-col">
              <h4>Schools</h4>
              {c.schools.map((s) => (
                <a className="s-ctx-item" href={`/schools/${s.slug}`} key={s.slug}>
                  <div className="s-ctx-n">{s.name}</div>
                  <div className="s-ctx-m">
                    {s.board} · {s.level}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───── faq ───── */

export function StreetFaq({ data }: { data: StreetV2Data }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">Common questions</span>
          <h2>About {data.shortName}</h2>
        </div>
        <div className="s-faq">
          {data.faqs.map((f, i) => (
            <div className="s-faq-item" key={i}>
              <div className="s-faq-q">{f.question}</div>
              <div className="s-faq-a">{f.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── final CTAs ───── */

export function StreetFinalCtas({ data }: { data: StreetV2Data }) {
  const { seller, buyer } = data.finalCtas;
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-final">
          <span className="s-eyebrow" style={{ color: 'var(--s-green)' }}>
            Your move on {data.shortName}
          </span>
          <div className="s-finalgrid" style={{ marginTop: 24 }}>
            <div className="s-fcard">
              <h3>{seller.headline}</h3>
              <p>{seller.body}</p>
              <a className="s-b1" href={seller.actionHref}>
                {seller.actionLabel} →
              </a>
            </div>
            <div className="s-fcard">
              <h3>{buyer.headline}</h3>
              <p>{buyer.body}</p>
              <a className="s-b2" href={buyer.actionHref}>
                {buyer.actionLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
