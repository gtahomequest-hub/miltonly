// src/components/street/v2/sections.tsx
// Presentational sections for the forest-v2 street shell.
//
// THE VISITOR VIEW (MC-046 Stage 1, PropTx VOW Best Practices item 40). Nothing rendered here is
// derived from a sold, leased, expired or terminated record: the hero's typical and its pills,
// the glance grid, the sidebar's market facts, the owner CTA's figure, the type cards' sold rows,
// the market cards, the rent grid, the quarterly chart and the area-context block all left. The
// sold view for the street is the gated island (StreetSoldRecords, id="sold-records"), and the
// hero carries the one neutral line that points at it (SoldHistoryLine).
import type {
  StreetV2Data,
  StreetStat,
  TypeBlock,
  ListingCard,
} from './types';
import type { StreetVideoClip } from '@/lib/streetVideo';
import { shortPrice } from './format';
import { CommuteIcon } from './icons';
import Image from 'next/image';
import { StreetSoldRecords } from './SoldRecordsIsland';
import StreetAlertCTA from './StreetAlertCTA';
import StreetCapture from './StreetCapture';
import ListingBrokerage from '@/components/listings/ListingBrokerage';
import SoldHistoryLine from '@/components/vow/SoldHistoryLine';

/** Every link to /sell from a street page carries the street (MA-001 defect 4): the valuation
 *  form prefills its address from ?street=, and four of the five links dropped it. */
export const sellHrefFor = (streetName: string) => `/sell?street=${encodeURIComponent(streetName)}#valuation`;
import { OGL_MILTON_ATTRIBUTION } from '@/lib/town/roadFacts';

/* ───── hero ───── */

// IDX tiles only (MC-046): the active count and the housing mix of the live listings. A tile
// with no value is not rendered: there is no silent state left, because nothing here is
// suppressible.
function HeroStat({ stat }: { stat: StreetStat }) {
  const shown = stat.kind === 'text' ? stat.textValue : stat.value;
  if (shown == null || shown === '') return null;
  return (
    <div className="s-hs">
      <div className="s-n">{shown}</div>
      <div className="s-l">{stat.label}</div>
      {stat.sub && <div className="s-sub">{stat.sub}</div>}
    </div>
  );
}

/** "2026-09-17" in prose, the way the menu writes a date (figureFormat.formatDateProse). */
function formatUpdated(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
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

/** Where the hero's neutral line points: the page's own sold-records island when it renders
 *  one, otherwise sign-in with a return to this page. */
export type SoldLineTarget = { soldViewHref: string } | { returnPath: string };

export function StreetHero({ data, soldLine }: { data: StreetV2Data; soldLine: SoldLineTarget }) {
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
        {data.subtitle ? <p className="s-character">{data.subtitle}</p> : null}
        <div className="s-herostats">
          {data.hero.stats.map((s) => (
            <HeroStat key={s.label} stat={s} />
          ))}
        </div>
        {/* THE NEUTRAL LINE (MC-046 Stage 1), where the sale and lease pills and the "N closed
            sales in the last 12 months" gate line stood. Once per page, here and nowhere else.
            It carries no figure, no count and no status. */}
        <SoldHistoryLine subject={data.name} tone="dark" className="s-hero-sold" {...soldLine} />
        <p className="s-updated">Updated {formatUpdated(data.lastUpdated)}. Listings live.</p>
        {/* the one field on the first screen: valuation or watch, the street prefilled */}
        <StreetCapture
          streetName={data.name}
          neighbourhood={data.areaContext?.neighbourhoodName ?? data.neighbourhoods[0] ?? 'Milton'}
          sellHref={sellHrefFor(data.name)}
        />
      </div>
    </header>
  );
}

/* ───── street video ───── */

// Renders the resolved day/night clips. A null view, or a view whose clips are all null,
// renders NOTHING: no placeholder, no "video coming soon". <video> is controls + no autoplay
// + playsInline + preload none (the clips carry no audio stream, asserted at upload), the
// poster frame is the derived webp.
//
// Under each player, the coverage sentence (MC-015): what the clip is a pass along, its
// endpoints when they are recorded, and when it was filmed. A clip with no stated extent
// implies it covers the street, and most cover a fraction of one. Under the grid, the
// takedown address: one line, one mailbox, read by a person, on every page carrying footage.
export function StreetVideo({ data }: { data: StreetV2Data }) {
  const v = data.video;
  const clips = v ? ([v.day, v.night].filter(Boolean) as StreetVideoClip[]) : [];
  if (clips.length === 0 || !v) return null;
  const subject = encodeURIComponent(`Footage takedown: ${data.name}`);
  return (
    <section className="s-block s-video">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">On the ground</span>
          {/* full display name here (data.name = "Lemieux Court"), not shortName: shortName
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
                preload="none"
                poster={c.poster ?? undefined}
              >
                <source src={c.src} type="video/mp4" />
              </video>
              {c.caption && <figcaption className="s-video-cap">{c.caption}</figcaption>}
              {c.coverage && <p className="s-video-coverage">{c.coverage}</p>}
            </figure>
          ))}
        </div>
        <p className="s-video-takedown">
          Footage of your own property here? Write to{" "}
          <a href={`mailto:${v.takedownEmail}?subject=${subject}`}>{v.takedownEmail}</a> and the clip comes
          down. A person reads that mailbox.
        </p>
      </div>
    </section>
  );
}

/* ───── prose body + sidebar ───── */

function Sidebar({ data }: { data: StreetV2Data }) {
  const { sidebar } = data;
  // One seller body for every street (MC-046, R10). It used to switch on the sold record between
  // "grounded in every sale we have tracked", "Few recent sales" and "No resale on record": three
  // claims about the record, each a disclosure of which kind of street this is.
  return (
    <aside className="s-side">
      {sidebar.facts.length > 0 && (
        <div className="s-side-card">
          <h3>Street facts</h3>
          {sidebar.facts.map((f) => (
            <div className="s-fact" key={f.label}>
              <span className="s-fact-l">{f.label}</span>
              <span className="s-fact-v">{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {/* QUEUE item 5. The street's physical facts, from the Town centreline and OSM, each one
          the layer's value formatted and nothing else. A card of its own so a road fact never
          sits among the street facts above, and the attribution is on the card that makes the
          claim. The battery's geometry-facts check reads these rows by data-key. */}
      {sidebar.geometry && (
        <div className="s-side-card s-geo" data-identity={sidebar.geometry.identity}>
          <h3>Road facts</h3>
          {sidebar.geometry.facts.map((f) => (
            <div className="s-fact s-geo-fact" data-key={f.key} key={f.key}>
              <span className="s-fact-l">{f.label}</span>
              <span className="s-fact-v">{f.value}</span>
            </div>
          ))}
          <div className="s-near-note">{sidebar.geometry.attribution}</div>
        </div>
      )}
      {sidebar.nearby.length > 0 && (
        <div className="s-side-card">
          <h3>Nearby</h3>
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
        <h3>{sidebar.cta.headline}</h3>
        <p>{sidebar.cta.body}</p>
        <a className="s-b1" href={sidebar.cta.actionHref === '/sell' ? sellHrefFor(data.name) : sidebar.cta.actionHref}>
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
        {/* THE HEADING TREE (MH-005, MA-001 change 7). The prose sections were H3s under no H2 and
            the sidebar cards H4s under no H3; Lighthouse heading-order failed on every run. One
            H2 heads the block; the generated "About <street>" section, which said the same
            thing, keeps its paragraphs and drops its own heading. */}
        <div className="s-sechead">
          <span className="s-eyebrow">The profile</span>
          <h2>About {data.name}</h2>
        </div>
        <div className="s-desc-grid">
          <div className="s-prose">
            {data.placeholder || data.sections.length === 0 ? (
              <div className="s-placeholder">
                <h3>No written profile yet</h3>
                <p>
                  A written read of {data.name} is in preparation. The listings, the addresses and
                  the Town&rsquo;s facts on this page are live.
                </p>
              </div>
            ) : (
              data.sections.map((sec, i) => (
                <div className="s-prose-sec" key={sec.id} id={`s-${sec.id}`}>
                  {i === 0 && sec.id === 'about' ? null : <h3>{sec.heading}</h3>}
                  {sec.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                  {/* The owner inline CTA after the first section. It quoted the street typical
                      ("Typical is $X"); the figure left with MC-046 and the offer stays. */}
                  {i === 0 && (
                    <div className="s-inline-cta">
                      <div className="s-inline-h">Own on {data.name}?</div>
                      <a href={sellHrefFor(data.name)}>Value my home</a>
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

// A CARD PER TYPE LISTED NOW (MC-046). The sold rows (typical, band, time on market, sold to
// ask, "has seen N closed sales", the quarterly chart and its trend) left the visitor view. The
// card states the active count and the mean asking price of those listings, labelled asking.
function TypeCard({ t }: { t: TypeBlock }) {
  return (
    <div className="s-type" id={`type-${t.type}`}>
      <div className="s-type-head">
        <h3>{t.displayName}</h3>
      </div>
      <p className="s-type-intro">{t.intro}</p>
      <div className="s-type-stats">
        <div className="s-stat">
          <div className="s-stat-l">Active listings</div>
          <div className="s-stat-v">{t.active}</div>
          {t.activeDetail && <div className="s-stat-d">{t.activeDetail}</div>}
        </div>
      </div>
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
          <h2>Listed on {data.name} now, by type</h2>
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

/* ───── the gated sold records ───── */

// THE PORTAL'S SOLD VIEW FOR THE STREET. The Sales and Leases cards, the rent grid, the
// quarterly chart and the year-on-year sentence that shared this section left with MC-046; the
// island stays exactly as it was: it reads /api/streets/<slug>/sold-records per session and
// shows the records only to a verified, acknowledged reader. The hero's neutral line links here.
export function StreetSoldHistory({ data }: { data: StreetV2Data }) {
  return (
    <section className="s-block">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">Records</span>
          <h2>Sales records, {data.name}</h2>
        </div>
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

// THE PHOTO IS AN IMAGE, SIZED TO THE TILE (MH-005, MA-001 change 2). It was a CSS background
// on the raw `rs:fit:3840:3840` feed URL: every active listing's photo at up to 3,840 px,
// eager, one format, no srcset; Main Street weighed 16.3 MB at 390 px. The feed's resize
// parameter is inside a signed path, so it cannot be changed here, and the sync keeps only
// the largest size; the optimiser (next.config `images.remotePatterns`) resizes the source
// once per width and serves AVIF or WebP from the edge. `sizes` is the tile's real width:
// the full column on a phone, a 260px-minimum grid cell above it.
function ListingTile({ l, index }: { l: ListingCard; index: number }) {
  return (
    <a className="s-listing" href={l.href}>
      <div className="s-listing-ph">
        {l.photo ? (
          <Image
            src={l.photo}
            alt=""
            fill
            sizes="(max-width: 560px) calc(100vw - 64px), (max-width: 1180px) 50vw, 360px"
            quality={70}
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            className="s-listing-img"
          />
        ) : null}
      </div>
      <div className="s-listing-body">
        {/* The brokerage inside the price, at its size (TRREB item 27, MC-029). No day count on
            a tile: it is a VOW-only fact (src/lib/listings/vow.ts). */}
        <div className="s-listing-p" data-price>
          {shortPrice(l.price)}
          <ListingBrokerage name={l.listOfficeName} />
        </div>
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
          {data.activeListings.map((l, i) => (
            <ListingTile key={l.mlsNumber} l={l} index={i} />
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
              <h3>Connected streets</h3>
              {c.connectedStreets.map((s) => (
                <a className="s-ctx-item" href={`/streets/${s.slug}`} key={s.slug}>
                  <div className="s-ctx-n">{s.name}</div>
                </a>
              ))}
            </div>
          )}
          {c.similarStreets.length > 0 && (
            <div className="s-ctx-col">
              <h3>Similar streets</h3>
              {c.similarStreets.map((s) => (
                <a className="s-ctx-item" href={`/streets/${s.slug}`} key={s.slug}>
                  <div className="s-ctx-n">{s.name}</div>
                  <div className="s-ctx-m">
                    {s.count} active · avg asking {shortPrice(s.avgPrice)}
                  </div>
                </a>
              ))}
            </div>
          )}
          {c.neighbourhoods.length > 0 && (
            <div className="s-ctx-col">
              <h3>Neighbourhoods</h3>
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
              <h3>Schools</h3>
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
          <h2>Questions about {data.name}</h2>
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
  // dead button). It is StreetAlertCTA → the live lead pipeline.
  // ONE WORDING FOR EVERY STREET (MC-046, R10). The copy used to switch on the sold record
  // (resaleClaim): "No resales recorded on X yet", "Too few recent sales on X", "Be first when X
  // trades". Each was an existence claim about the sold record, and the switch itself disclosed
  // which kind of street this is. The seller and buyer copy is the same everywhere now.
  const nbhd = data.areaContext?.neighbourhoodName ?? data.neighbourhoods[0] ?? 'Milton';
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
              <p>{seller.body}</p>
              <a className="s-b1" href={seller.actionHref === '/sell' ? sellHrefFor(data.name) : seller.actionHref}>
                {seller.actionLabel} →
              </a>
            </div>
            <StreetAlertCTA
              streetName={data.name}
              shortName={data.name}
              neighbourhood={nbhd}
              headline={buyer.headline}
              body={buyer.body}
              dormant={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
