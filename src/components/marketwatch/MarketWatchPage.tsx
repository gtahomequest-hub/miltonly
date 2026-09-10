// src/components/marketwatch/MarketWatchPage.tsx
// Dumb renderer. Every figure arrives k-gated; this file decides only how a
// number and an ABSENCE look, never whether either may be shown.
//
// The one rule the layout enforces: a suppressed figure renders as a full-width
// row that says why. It is never a dash, never a zero, never a missing row.
import "./market-watch.css";
import type { EditionSections } from "@/lib/marketWatch/edition";
import { formatMoney } from "@/lib/mortgage-math";

function Row({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="mw-row">
      <div className="mw-label">{label}</div>
      <div style={{ textAlign: "right" }}>
        <div className="mw-val">{value}</div>
        {meta ? <div className="mw-val-sm">{meta}</div> : null}
      </div>
    </div>
  );
}

function Suppressed({ children }: { children: React.ReactNode }) {
  return <div className="mw-suppressed">{children}</div>;
}

export default function MarketWatchPage({
  s,
  summarySentence,
  interpretation,
  isCurrent,
  archive,
}: {
  s: EditionSections;
  summarySentence: string;
  interpretation: string | null;
  isCurrent: boolean;
  archive: Array<{ weekOf: string; label: string }>;
}) {
  const delta = s.sales.count - s.previous.count;
  const deltaText =
    delta === 0
      ? "level with the week before"
      : delta > 0
        ? `${delta} more than the week before`
        : `${Math.abs(delta)} fewer than the week before`;

  const maxForm = Math.max(1, ...s.forms.rows.map((r) => r.count));

  return (
    <div className="market-watch">
      <header className="mw-mast">
        <div className="mw-wrap">
          <div className="mw-crumb">
            <a href="/">Miltonly</a>
            <span>/</span>
            <a href="/market-watch">Market Watch</a>
            {!isCurrent && (
              <>
                <span>/</span>
                {s.weekOf}
              </>
            )}
          </div>
          <div className="mw-kicker">Market Watch{isCurrent ? " · current edition" : " · archived edition"}</div>
          <h1>Milton, the {s.weekLabel}</h1>
          <p className="mw-lede">{summarySentence}</p>
          <div className="mw-window">
            Window {s.windowStartIso.slice(0, 10)} to {s.windowEndIso.slice(0, 10)}, Monday to Sunday, America/Toronto.
            Completed sales only, bounded at the day this edition was written.
          </div>
          {/* A corrected edition says so, at the top, before any figure. The
              note is present only on an edition that was rewritten after
              publication; every other edition renders nothing here. */}
          {s.correctionNote ? (
            <div className="mw-correction">
              <span className="mw-correction-tag">Correction</span>
              <span className="mw-correction-text">{s.correctionNote}</span>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── flow ── */}
      <section className="mw-block">
        <div className="mw-wrap">
          <h2 className="mw-h2">Flow</h2>
          <div className="mw-sub">Counts for the week. Changes are stated as counts, not percentages.</div>
          <Row label="Homes sold" value={String(s.sales.count)} meta={deltaText} />
          <Row label="New listings" value={String(s.newListings)} />
          <p className="mw-note">
            A percentage change on a base this size would move several points on one extra sale, so this
            edition does not print one. Lease activity is not reported: the lease records carry no close
            date and are stamped on ingest, which produces weekly swings that describe the feed rather
            than the market.
          </p>
        </div>
      </section>

      {/* ── price ── */}
      <section className="mw-block">
        <div className="mw-wrap">
          <h2 className="mw-h2">What sold for</h2>
          <div className="mw-sub">The week&apos;s own figures, each gated on the week&apos;s own sale count.</div>
          {s.sales.typicalPrice !== null ? (
            <Row label="Typical sold price" value={formatMoney(s.sales.typicalPrice)} meta={`across ${s.sales.count} sales`} />
          ) : (
            <Suppressed>
              Too few homes sold this week to publish a typical price. The figure is withheld rather than
              estimated, and withheld does not mean zero: {s.sales.count} {s.sales.count === 1 ? "home" : "homes"} sold.
            </Suppressed>
          )}
          {s.sales.bandLow !== null && s.sales.bandHigh !== null ? (
            <Row
              label="Middle half"
              value={`${formatMoney(s.sales.bandLow)} to ${formatMoney(s.sales.bandHigh)}`}
              meta="quarter trimmed from each end"
            />
          ) : (
            <Suppressed>
              A price band needs more sales behind it than a midpoint does, because a range publishes its own
              endpoints and an endpoint is a house. This week is below that floor.
            </Suppressed>
          )}
          {s.sales.avgDom !== null && <Row label="Days on market" value={String(s.sales.avgDom)} meta="average" />}
          {s.sales.soldToAskPct !== null && <Row label="Sold to ask" value={`${s.sales.soldToAskPct}%`} meta="average" />}

          {s.context12mo.typicalPrice !== null && (
            <p className="mw-note">
              For context over a longer window: <strong>{formatMoney(s.context12mo.typicalPrice)}</strong> is
              the typical Milton sold price across {s.context12mo.count} sales over the trailing 12 months
              {s.context12mo.avgDom !== null ? `, at ${s.context12mo.avgDom} days on market` : ""}. That is a
              different window from every figure above it and is labelled so it cannot be read as one number.
            </p>
          )}
        </div>
      </section>

      {/* ── by form ── */}
      <section className="mw-block">
        <div className="mw-wrap">
          <h2 className="mw-h2">By housing form</h2>
          <div className="mw-sub">
            {s.forms.label}. A week is too small a sample to split four ways, so the form figures use a wider
            window and each form is gated on its own count.
          </div>
          {s.forms.rows.map((f) => (
            <div className="mw-form" key={f.slug}>
              <div className="mw-form-top">
                <span className="mw-form-name">{f.label}</span>
                <span className="mw-count">
                  {f.typicalPrice !== null ? formatMoney(f.typicalPrice) : "not published"}
                </span>
              </div>
              <div className="mw-bar" style={{ width: `${Math.max(2, (f.count / maxForm) * 100)}%` }} />
              <div className="mw-form-meta">
                {f.count} {f.count === 1 ? "sale" : "sales"}
                {f.bandLow !== null && f.bandHigh !== null
                  ? ` · middle half ${formatMoney(f.bandLow)} to ${formatMoney(f.bandHigh)}`
                  : " · too few sales for a band"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── where ── */}
      <section className="mw-block">
        <div className="mw-wrap">
          <h2 className="mw-h2">Where it happened</h2>
          <div className="mw-sub">Sale counts for the week. The price beside each is the 12-month figure.</div>
          {s.neighbourhoods.length === 0 ? (
            <Suppressed>No sales with a neighbourhood recorded this week.</Suppressed>
          ) : (
            <ul className="mw-list">
              {s.neighbourhoods.map((n) => (
                <li className="mw-item" key={n.name}>
                  <span className="mw-item-name">
                    {n.slug ? <a href={`/neighbourhoods/${n.slug}`}>{n.name}</a> : n.name}
                  </span>
                  <span className="mw-item-meta">
                    {n.weekCount} this week
                    {n.typical12mo !== null ? ` · ${formatMoney(n.typical12mo)} over 12 months` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mw-note">
            No weekly price is published per neighbourhood at any sale count. A Milton neighbourhood sees
            one or two sales in a week, and a price computed on that describes two households rather than a
            market. The 12-month figure shown beside each name is the same statistic that neighbourhood&apos;s
            own page renders, computed the same way, so the two cannot disagree.
          </p>
        </div>
      </section>

      {/* ── streets ── */}
      {s.streets.length > 0 && (
        <section className="mw-block">
          <div className="mw-wrap">
            <h2 className="mw-h2">Streets that moved</h2>
            <div className="mw-sub">Streets with a sale this week that already have a page.</div>
            <ul className="mw-list">
              {s.streets.map((st) => (
                <li className="mw-item" key={st.slug}>
                  <span className="mw-item-name">
                    <a href={`/streets/${st.slug}`}>{st.name}</a>
                  </span>
                  <span className="mw-item-meta">
                    {st.count} {st.count === 1 ? "sale" : "sales"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mw-note">
              A count only. A single street in a single week is a population of one or two houses, so no
              price appears here at any sale count.
            </p>
          </div>
        </section>
      )}

      {/* ── interpretation ── */}
      {interpretation && (
        <section className="mw-block">
          <div className="mw-wrap">
            <h2 className="mw-h2">Reading the week</h2>
            <div className="mw-sub">Written from the figures above and nothing else.</div>
            <p className="mw-interp">{interpretation}</p>
          </div>
        </section>
      )}

      {/* ── archive ── */}
      {archive.length > 0 && (
        <section className="mw-block mw-archive">
          <div className="mw-wrap">
            <h2 className="mw-h2">Earlier editions</h2>
            <ul className="mw-list">
              {archive.map((a) => (
                <li className="mw-item" key={a.weekOf}>
                  <span className="mw-item-name">
                    <a href={`/market-watch/${a.weekOf}`}>{a.label}</a>
                  </span>
                  <span className="mw-item-meta">{a.weekOf}</span>
                </li>
              ))}
            </ul>
            <p className="mw-note">
              An edition is fixed once published. Sales reported to the board after its window closed appear
              in a later edition rather than changing a published one.
            </p>
          </div>
        </section>
      )}

      <section className="mw-cta">
        <div className="mw-wrap">
          <div className="mw-kicker">Your next move</div>
          <h2>See the market at street level</h2>
          <p>
            Every figure on this page breaks down further: by neighbourhood, then by street, then by
            address. The pages below carry the same numbers computed the same way.
          </p>
          <div className="mw-btns">
            <a className="mw-b1" href="/sell#valuation">
              Get a valuation
            </a>
            <a className="mw-b2" href="/listings">
              Homes for sale
            </a>
            <a className="mw-b2" href="/sold">
              All sold data
            </a>
            <a className="mw-b2" href="/guides">
              Guides
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
