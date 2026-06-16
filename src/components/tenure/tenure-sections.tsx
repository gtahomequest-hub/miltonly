// src/components/tenure/tenure-sections.tsx
//
// TENURE-LOCAL section variants. These reuse the EXACT .hub-v2 / h-* class
// system (hub-theme.css) and the hub format helpers + icons VERBATIM, so the
// tenure hub is visually identical to the neighbourhood hubs — but the section
// HEADERS carry tenure copy instead of the neighbourhood strings baked into
// src/components/hub/sections.tsx (which we deliberately do NOT edit, to keep
// the 16 live neighbourhood hubs byte-identical — the SoldTable lesson).
//
// Sections authored here: Hero, Glance, Overview, Market, Faqs, DualCta. The
// geo-only sections (Streets, VIP, Condos, Siblings) are intentionally omitted —
// no /neighbourhoods/<slug>/streets 404, no geo headers.

import type { HubData } from "../hub/types";
import { fullPrice } from "../hub/format";
import { IconHome, IconPeople, IconTag, IconKey, IconInvest, IntentIcon } from "../hub/icons";

function Stat({ value, label, accentDollar }: { value: number | null; label: string; accentDollar?: boolean }) {
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
        {accentDollar ? compact(value) : value.toLocaleString("en-CA")}
      </div>
      <div className="h-l">{label}</div>
    </div>
  );
}
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

export function TenureHero({ data, eyebrow }: { data: HubData; eyebrow: string }) {
  const { stats } = data;
  return (
    <header className="h-hero">
      <div className="h-wrap">
        <div className="h-crumb">
          <a href="/">Miltonly</a>
          <span>/</span>
          <a href="/listings">Buy</a>
          <span>/</span>
          Freehold
        </div>
        <div className="h-hero-grid">
          <div className="h-hero-left">
            <span className="h-eyebrow">{eyebrow}</span>
            <h1>{data.name}</h1>
            <p className="h-character">{data.character}</p>
            <div className="h-herostats">
              <Stat value={stats.typicalPrice} label="typical sold · 12 mo" accentDollar />
              <Stat value={stats.sold12mo} label="sold · last 12 months" />
              <Stat value={stats.onMarket} label="on the market" />
            </div>
          </div>
          <div className="h-intents">
            {data.intents.map((it) => (
              <a className="h-intent" href={it.href} key={it.key}>
                <span className="h-intent-ic">
                  <IntentIcon k={it.key} />
                </span>
                <span className="h-intent-l">{it.label}</span>
                <span className="h-intent-s">{it.sub}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export function TenureGlance({ data }: { data: HubData }) {
  const g = data.atAGlance;
  const items = [
    { ic: <IconTag />, l: "Price range", v: g.priceRange, silent: g.priceRange === null },
    { ic: <IconHome />, l: "Home types", v: g.dominantType, silent: false },
    { ic: <IconPeople />, l: "Best suits", v: g.suits.join(", "), silent: false },
    { ic: <IconKey />, l: "Monthly fee", v: g.commute, silent: false },
    { ic: <IconInvest />, l: "vs Condo", v: g.schools, silent: false },
  ];
  return (
    <div className="h-glance">
      <div className="h-wrap">
        <div className="h-card">
          {items.map((it) => (
            <div className="h-gi" key={it.l}>
              <div className="h-gi-ic">{it.ic}</div>
              <div className="h-gi-l">{it.l}</div>
              <div className={`h-gi-v${it.silent ? " h-silent" : ""}`}>{it.v ?? "not stated"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TenureOverview({ data }: { data: HubData }) {
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">The read</span>
          <h2>Freehold in Milton, explained</h2>
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

export function TenureMarket({ data }: { data: HubData }) {
  return (
    <section className="h-block h-alt">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">The market</span>
          <h2>How freehold trades in Milton</h2>
        </div>
        {data.marketCompare.length > 0 && (
          <div className="h-compare">
            {data.marketCompare.map((c) => (
              <div className="h-cmp" key={c.metricLabel}>
                <div className="h-cmp-l">{c.metricLabel}</div>
                <div className="h-cmp-v">{c.neighbourhoodValue}</div>
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

export function TenureFaqs({ data }: { data: HubData }) {
  if (data.faqs.length === 0) return null;
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-sechead">
          <span className="h-eyebrow">Common questions</span>
          <h2>Freehold questions</h2>
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

export function TenureDualCta({ data }: { data: HubData }) {
  return (
    <section className="h-block">
      <div className="h-wrap">
        <div className="h-dual">
          <span className="h-eyebrow" style={{ color: "var(--h-green)" }}>
            Your move
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

// fullPrice re-exported for any consumer convenience (kept tree-shake-safe).
export { fullPrice };
