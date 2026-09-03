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
  ListingCard,
  ChartPoint,
} from './types';
import type { StreetVideoClip } from '@/lib/streetVideo';
import { compactPrice, fullPrice, shortPrice, dollars, barFraction } from './format';
import { CommuteIcon } from './icons';
import { StreetSoldRecords } from './SoldRecordsIsland';
import StreetAlertCTA from './StreetAlertCTA';
import { resaleClaim } from './resaleClaim';
import { OGL_MILTON_ATTRIBUTION } from '@/lib/town/roadFacts';

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
      {stat.basis && <div className="s-basis">{stat.basis}</div>}
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
        {silent ? p.priceLabel : `${dollars(p.typicalPrice as number)} ${p.priceLabel}`}
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
              Recent sales <span className="s-pillrow-win">· last 12 months</span>
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
              Recent leases{data.hero.leaseWindowNote && <span className="s-pillrow-win"> · {data.hero.leaseWindowNote}</span>}
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

/* ───── street video (PoC) ───── */

// Renders the resolved day/night clips. A null view, or a view whose clips are all null,
// renders NOTHING — no placeholder, no "video coming soon" (that's the whole PoC rule).
// <video> is controls + no autoplay + playsInline; the poster frame is the derived JPG.
export function StreetVideo({ data }: { data: StreetV2Data }) {
  const v = data.video;
  const clips = v ? ([v.day, v.night].filter(Boolean) as StreetVideoClip[]) : [];
  if (clips.length === 0) return null;
  return (
    <section className="s-block s-video">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">On the ground</span>
          {/* full display name here (data.name = "Lemieux Court"), not shortName — shortName
              strips the street-type suffix for in-prose use ("homes on Lemieux"). */}
          <h2>{data.name} on video</h2>
        </div>
        <div className="s-video-grid">
          {clips.map((c) => (
            <figure className="s-video-clip" key={c.src}>
              <video
                className="s-video-el"
                controls
                playsInline
                preload="metadata"
                poster={c.poster ?? undefined}
              >
                <source src={c.src} type="video/mp4" />
              </video>
              {c.caption && <figcaption className="s-video-cap">{c.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
    </section>
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
  // The sidebar seller CTA was the last ungated copy on the page: "grounded in every sale we have
  // tracked on X" rendered on 412 of 431 pages, contradicted the tiered CTA below it on 191, and
  // was flatly false on 26 streets with no resale on record. Same predicate as everything else.
  const claim = resaleClaim(data.name, data.hasAnySale);
  const subK5 = data.tier === 'identity-only' || data.tier === 'area-only';
  const ctaBody = subK5 || claim.claimsAbsence ? claim.sellerBody(data.name) : sidebar.cta.body;
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
              {/* distance is null until a per-street coordinate exists — name only, no figure */}
              {n.distance && <span className="s-near-d">{n.distance}</span>}
            </div>
          ))}
          {sidebar.nearby.every((n) => !n.distance) ? (
            <div className="s-near-note">In Milton. Travel times aren&rsquo;t street-specific yet.</div>
          ) : (
            // A DATA-SOURCE LINE WHERE THE DERIVED FACT IS THE CONTENT. These minutes are computed
            // from the Town's road centreline for this street to the Town's own school and park
            // geometry — a footer line is too far from the claim to serve as its attribution.
            <div className="s-near-note">
              Distances from this street&rsquo;s road centreline. {OGL_MILTON_ATTRIBUTION}
            </div>
          )}
        </div>
      )}
      <div className="s-side-cta">
        <span className="s-eyebrow">{sidebar.cta.eyebrow}</span>
        <h4>{sidebar.cta.headline}</h4>
        <p>{ctaBody}</p>
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
                  data below is current, the written profile follows shortly.
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
                        Own on {data.name}? Typical is <b>{shortPrice(data.ownerCtaPrice)}</b>.
                      </div>
                      <a href="/sell">Value my home</a>
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
  return (
    <div className="s-type" id={`type-${t.type}`}>
      <div className="s-type-head">
        <h3>{t.displayName}</h3>
      </div>
      <p className="s-type-intro">{t.intro}</p>
      <div className="s-type-stats">
        <TypeStatCell label="Typical price" value={t.typicalPrice} detail={t.typicalDetail} silentNote="under publish threshold" />
        <TypeStatCell label="Price band" value={t.priceBand} silentNote="—" />
        <TypeStatCell label="Time on market" value={t.dom} silentNote="—" />
        <TypeStatCell label="Sold to ask" value={t.soldToAsk} silentNote="—" />
        {t.active !== null && <TypeStatCell label="Active listings" value={t.active} detail={t.activeDetail} />}
      </div>
      {t.contactTeamPrompt && (
        <div className="s-contact-prompt">
          Too few recent {t.displayName.toLowerCase()} sales on record to publish a typical price without identifying a
          home.{' '}
          <a href="/sell">Ask the team for a private read →</a>
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
          <h2>What trades on {data.name}, by type</h2>
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

export function StreetMarket({ data }: { data: StreetV2Data }) {
  const m = data.market;
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">The market</span>
          <h2>Recent activity on {data.name}</h2>
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
        <StreetSoldRecords slug={data.slug} streetName={data.name} />
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
          <h2>Commute &amp; reach from {data.name}</h2>
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
                  {d.primaryTime && (
                    <span className="s-cd-t">
                      {d.primaryTime}
                      {d.secondaryTime ? ` · ${d.secondaryTime}` : ''}
                    </span>
                  )}
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
          <h2>Active listings on {data.name}</h2>
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
  if (c.connectedStreets.length + c.similarStreets.length + c.neighbourhoods.length + c.schools.length === 0) return null;
  return (
    <section className="s-block s-alt">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">In context</span>
          <h2>Around {data.name}</h2>
        </div>
        <div className="s-ctx">
          {/* Physically-connected streets (shared intersection) — the "what's the street
              behind it" links. Nothing renders when this street matched no OSM way. */}
          {c.connectedStreets.length > 0 && (
            <div className="s-ctx-col">
              <h4>Connected streets</h4>
              {c.connectedStreets.map((s) => (
                <a className="s-ctx-item" href={`/streets/${s.slug}`} key={s.slug}>
                  <div className="s-ctx-n">{s.name}</div>
                </a>
              ))}
            </div>
          )}
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
          <h2>About {data.name}</h2>
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
  // The buyer "Set an alert" button used to link to /listings and capture nothing (a
  // dead button). It is now StreetAlertCTA → the live lead pipeline. For dormant streets
  // the copy leads with the honest "no resales yet" framing (the loop this closes: when a
  // dormant street records its first sale, auto-promotion publishes it and the alert fires).
  const nbhd = data.areaContext?.neighbourhoodName ?? data.neighbourhoods[0] ?? 'Milton';
  const subK5 = data.tier === 'identity-only' || data.tier === 'area-only';
  // ONE gate, ONE wording — shared with the minimal shell via resaleClaim().
  const claim = resaleClaim(data.name, data.hasAnySale);
  // The absence claim is gated on hasAnySale ALONE, not on tier. A street can clear k>=5 on LEASES
  // and still have no resale on record (tier 'priced-lease'); those pages previously said nothing
  // at all, so the claim set and the zero-sale set disagreed in both directions.
  const alertFraming = subK5 || claim.claimsAbsence;
  const ctaBody = alertFraming ? claim.ctaBody : buyer.body;
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-final">
          <span className="s-eyebrow" style={{ color: 'var(--s-green)' }}>
            Your move on {data.name}
          </span>
          <div className="s-finalgrid" style={{ marginTop: 24 }}>
            <div className="s-fcard">
              <h3>{seller.headline}</h3>
              {/* The stock seller copy promises "grounded in every sale we have tracked" — on a
                  street the page is simultaneously arguing has too few sales to price, that reads
                  as boilerplate written for rich streets. Same population gate as the buyer copy. */}
              <p>{alertFraming ? claim.sellerBody(data.name) : seller.body}</p>
              <a className="s-b1" href={seller.actionHref}>
                {seller.actionLabel} →
              </a>
            </div>
            <StreetAlertCTA
              streetName={data.name}
              shortName={data.name}
              neighbourhood={nbhd}
              headline={alertFraming ? `Be first when ${data.name} trades` : buyer.headline}
              body={ctaBody}
              dormant={alertFraming}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───── area-context anchor (DEC-CONDO-6 street port) ───── */
// Renders ONLY for sub-k5 pages (tier !== 'priced-sale') — rich pages stay byte-identical.
// The neighbourhood typical is the hub's own figure (drift-free) and is labelled
// strictly area-grain. Two distinct copies, mirroring the condo tier: identity-only leans
// entirely on the area ("too few to price it on its own yet"); area/lease pages state the
// suppression ("we won't publish a price the record can't support").
export function StreetAreaContext({ data }: { data: StreetV2Data }) {
  if (data.tier === 'priced-sale') return null;
  const ac = data.areaContext;
  const identity = data.tier === 'identity-only';
  // TIER decides which framing this block uses; hasAnySale decides what the heading may CLAIM.
  // Keyed on tier alone, "New to the record" shipped on 113 pages, 90 of which had sales.
  const claim = resaleClaim(data.name, data.hasAnySale);
  return (
    <section className="s-block s-areacx">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">{identity ? claim.areaEyebrow : 'Neighbourhood context'}</span>
          <h2>{identity ? claim.areaHeading : `The market around ${data.name}`}</h2>
        </div>
        <div className="s-areacx-card">
          {ac && ac.typicalPrice != null ? (
            <>
              <div className="s-areacx-num">
                <b>$</b>
                {compactPrice(ac.typicalPrice)}
              </div>
              <div className="s-areacx-lbl">
                the typical home price across{' '}
                {ac.neighbourhoodSlug ? (
                  <a href={`/neighbourhoods/${ac.neighbourhoodSlug}`}>{ac.neighbourhoodName}</a>
                ) : (
                  ac.neighbourhoodName
                )}{' '}
               , the neighbourhood, not {data.name} specifically
              </div>
              {ac.basis && <div className="s-basis">{ac.basis}</div>}
              <p className="s-areacx-read">
                {identity
                  ? `Too few recent trades on ${data.name} to price it on its own yet, the ${ac.neighbourhoodName} market is your best guide to what you'd pay here, and this page fills in with ${data.name}'s own numbers as homes trade.`
                  : `${data.name} hasn't had enough recent sales to publish its own typical price, and we won't publish a price the record can't support. The ${ac.neighbourhoodName} typical above is the honest anchor until it does.`}
              </p>
            </>
          ) : (
            <p className="s-areacx-read">
              Neighbourhood pricing for {ac?.neighbourhoodName ?? 'this area'} isn&rsquo;t published yet, {data.name} will fill in with its own price history as homes trade.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
