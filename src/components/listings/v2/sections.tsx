// src/components/listings/v2/sections.tsx
// Server-presentational sections for the forest-v2 listings shell. The hero
// search is a plain GET form (no JS needed — same server-query model as the
// filter rail). Everything below the grid composes in alternating forest bands.

import Link from 'next/link';
import { config } from '@/lib/config';
import type { ListingsV2Data } from './types';
import { fullPrice, shortPrice } from './format';
import { SearchIcon, SchoolIcon } from './icons';

/* ───── hero ───── */

export function ListingsHero({ data, basePath }: { data: ListingsV2Data; basePath: string }) {
  const { query, totalCount } = data;
  const mode = query.status;
  const h1 =
    mode === 'rent' ? (
      <>
        Homes for rent in <em>Milton</em>
      </>
    ) : mode === 'sold' ? (
      <>
        Recently sold in <em>Milton</em>
      </>
    ) : (
      <>
        Homes for sale in <em>Milton</em>
      </>
    );

  return (
    <header className="lv-hero">
      <div className="lv-wrap">
        <div className="lv-crumb">
          <Link href="/">Miltonly</Link>
          <span>/</span>
          {mode === 'rent' ? 'Rent' : mode === 'sold' ? 'Sold' : 'Buy'}
        </div>

        <nav className="lv-modes" aria-label="Listing mode">
          <Link className={`lv-mode${mode === 'active' ? ' lv-on' : ''}`} href={basePath}>
            For Sale
          </Link>
          <Link className={`lv-mode${mode === 'rent' ? ' lv-on' : ''}`} href={`${basePath}?status=rent`}>
            For Rent
          </Link>
          <Link className={`lv-mode${mode === 'sold' ? ' lv-on' : ''}`} href={`${basePath}?status=sold`}>
            Sold
          </Link>
        </nav>

        <h1>{h1}</h1>
        <p className="lv-countline">
          <span className="lv-livedot" aria-hidden />
          <b>{totalCount.toLocaleString()} homes</b> · live TREB MLS® data, updated daily
        </p>

        {/* keyword search — plain GET form, server re-queries on submit */}
        <form className="lv-search" action={basePath} method="get">
          {mode !== 'active' && <input type="hidden" name="status" value={mode} />}
          <SearchIcon />
          <input
            type="text"
            name="q"
            defaultValue={query.q ?? ''}
            placeholder="Search a street, neighbourhood, or MLS® number…"
            aria-label="Search listings"
          />
          <button type="submit">Search</button>
        </form>
      </div>
    </header>
  );
}

/* ───── market stats overlap band ───── */

export function StatsBand({ data }: { data: ListingsV2Data }) {
  const s = data.stats;
  const tiles = [
    { l: 'Avg asking price', v: shortPrice(s.avgPrice), s: 'across active listings' },
    { l: 'Avg days on market', v: s.avgDom > 0 ? `${s.avgDom}` : '—', s: 'before a deal firms up' },
    { l: 'New this week', v: `${s.newThisWeek}`, s: 'fresh listings, last 7 days' },
    { l: 'Active right now', v: s.activeCount.toLocaleString(), s: 'homes on the market' },
  ];
  return (
    <div className="lv-statsband">
      <div className="lv-wrap">
        <div className="lv-card">
          {tiles.map((t) => (
            <div className="lv-stat" key={t.l}>
              <div className="lv-stat-l">{t.l}</div>
              <div className="lv-stat-v">{t.v}</div>
              <div className="lv-stat-s">{t.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───── browse by neighbourhood (deep band) ───── */

export function HoodBand({ data }: { data: ListingsV2Data }) {
  if (data.hoods.length === 0) return null;
  return (
    <section className="lv-block lv-hoodband">
      <div className="lv-wrap">
        <div className="lv-sechead">
          <span className="lv-eyebrow" style={{ color: 'var(--lv-green)' }}>
            Where to look
          </span>
          <h2>Browse Milton by neighbourhood</h2>
          <p className="lv-sub">
            Every pocket trades differently. Tap a neighbourhood to filter the results above to just that area.
          </p>
        </div>
        <div className="lv-hoodgrid">
          {data.hoods.map((h) => (
            <Link key={h.name} className="lv-hoodcard" href={`/listings?neighbourhood=${encodeURIComponent(h.name)}`}>
              <span className="lv-hood-n">{h.name}</span>
              <span className="lv-hood-c">
                {h.count} active listing{h.count === 1 ? '' : 's'}
              </span>
              {h.avgPrice != null && <span className="lv-hood-p">{shortPrice(h.avgPrice)} average ask</span>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── top streets ───── */

export function StreetsStrip({ data }: { data: ListingsV2Data }) {
  if (data.streets.length === 0) return null;
  return (
    <section className="lv-block">
      <div className="lv-wrap">
        <div className="lv-sechead">
          <span className="lv-eyebrow">Street intelligence</span>
          <h2>Active streets right now</h2>
        </div>
        <div className="lv-streets">
          {data.streets.map((s) => (
            <Link key={s.slug} className="lv-streetpill" href={`/streets/${s.slug}`}>
              {s.name}
              <span>{s.count} active</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── schools ───── */

export function SchoolsStrip({ data }: { data: ListingsV2Data }) {
  if (data.schools.length === 0) return null;
  return (
    <section className="lv-block lv-alt">
      <div className="lv-wrap">
        <div className="lv-sechead">
          <span className="lv-eyebrow">School zones</span>
          <h2>Find homes near top-rated schools</h2>
        </div>
        <div className="lv-schoolgrid">
          {data.schools.map((s) => (
            <Link key={s.slug} className="lv-school" href={`/schools/${s.slug}`}>
              <SchoolIcon />
              <span>
                <span className="lv-school-n">{s.name}</span>
                <span className="lv-school-m" style={{ display: 'block' }}>
                  {s.board} · {s.neighbourhood}
                </span>
                {s.fraser && (
                  <span className="lv-school-f" style={{ display: 'block' }}>
                    Fraser {s.fraser}/10
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── alert CTA band ───── */

export function AlertBand() {
  return (
    <section className="lv-block">
      <div className="lv-wrap">
        <div className="lv-alert">
          <div>
            <h3>
              New listings, <em>before</em> the portals
            </h3>
            <p>
              Save a search and we&apos;ll email you the moment a new Milton home matches your filters — often before
              it surfaces anywhere else. Free, and one click to stop.
            </p>
          </div>
          <div className="lv-alert-act">
            <Link className="lv-b1" href="/signin?redirect=/listings">
              Create a free account
            </Link>
            <span className="lv-trust">No spam · {config.realtor.name} only emails matches</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───── FAQ ───── */

export function FaqSection({ data }: { data: ListingsV2Data }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="lv-block lv-alt">
      <div className="lv-wrap">
        <div className="lv-sechead">
          <span className="lv-eyebrow">Good to know</span>
          <h2>Milton market questions, answered</h2>
        </div>
        <div className="lv-faq">
          {data.faqs.map((f) => (
            <div className="lv-faq-item" key={f.question}>
              <h3 className="lv-faq-q">{f.question}</h3>
              <p className="lv-faq-a">{f.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── compliance attribution ───── */

export function Attribution({ avgPrice }: { avgPrice: number }) {
  return (
    <p className="lv-attr">
      Data provided by TREB via {config.SITE_NAME}. MLS® listings updated daily. Average asking price{' '}
      {fullPrice(avgPrice)}. Information is deemed reliable but not guaranteed.
    </p>
  );
}
