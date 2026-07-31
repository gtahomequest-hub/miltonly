// Server-rendered, INDEXABLE Milton-wide sold-aggregate layer for /sold.
// Pure presentation over k-anonymised aggregates (SoldAggregatesData) — no
// individual records, no client JS. Honest k-anon suppression is a design
// element (the .sv-silent chip), and every neighbourhood row links to its hub
// whether or not its sample clears k — the 22 internal links are the point.
import Link from "next/link";
import { config } from "@/lib/config";
import type { SoldAggregatesData } from "@/lib/soldAggregates";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const SILENT = "not published — sample too small";

export default function SoldAggregates({ data }: { data: SoldAggregatesData }) {
  const { overall, byType, byNeighbourhood, quarterly } = data;
  const maxQ = Math.max(1, ...quarterly.map((q) => q.count));
  const CITY = config.CITY_NAME;

  return (
    <section className="sv-agg" aria-label={`${CITY} sold market summary`}>
      <div className="sv-wrap">
        <div className="sv-agg-head">
          <span className="sv-eyebrow">{CITY} · Last 12 months</span>
          <h2 className="sv-agg-h">
            What homes actually <em>sold</em> for in {CITY}
          </h2>
          <p className="sv-agg-sub">
            Every figure below is a k-anonymised aggregate of real closed TREB MLS<sup>®</sup> sales —
            no individual transaction is identifiable. The exact per-home records are free with a
            verified email.
          </p>
        </div>

        {/* ── market snapshot ── */}
        <div className="sv-snap">
          <div className="sv-snap-tile sv-snap-hero">
            <div className="sv-snap-l">Typical sold price</div>
            <div className="sv-snap-v">{overall.medianPrice != null ? money(overall.medianPrice) : "—"}</div>
            {overall.bandLow != null && overall.bandHigh != null ? (
              <div className="sv-snap-band">
                Most sell between {money(overall.bandLow)} and {money(overall.bandHigh)}
              </div>
            ) : null}
          </div>
          <div className="sv-snap-tile">
            <div className="sv-snap-v">{overall.count.toLocaleString("en-CA")}</div>
            <div className="sv-snap-l">Homes sold (12 mo)</div>
          </div>
          <div className="sv-snap-tile">
            <div className="sv-snap-v">{overall.avgDom != null ? overall.avgDom : "—"}</div>
            <div className="sv-snap-l">Avg days on market</div>
          </div>
          <div className="sv-snap-tile">
            <div className="sv-snap-v">{overall.soldToAskPct != null ? `${overall.soldToAskPct}%` : "—"}</div>
            <div className="sv-snap-l">Sold-to-ask ratio</div>
          </div>
        </div>

        {/* ── by property type ── */}
        {byType.length > 0 && (
          <>
            <h3 className="sv-agg-sh">Typical price by home type</h3>
            <div className="sv-types">
              {byType.map((t) => (
                <div className="sv-type" key={t.slug}>
                  <div className="sv-type-l">{t.label}</div>
                  <div className="sv-type-v">
                    {t.medianPrice != null ? money(t.medianPrice) : <span className="sv-silent">sample too small</span>}
                  </div>
                  <div className="sv-type-n">{t.count.toLocaleString("en-CA")} sold · 12 mo</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── quarterly trend ── */}
        {quarterly.length > 1 && (
          <>
            <h3 className="sv-agg-sh">{CITY} price trend, last {quarterly.length} quarters</h3>
            <div className="sv-trend">
              {quarterly.map((q) => (
                <div className="sv-trend-row" key={q.label}>
                  <div className="sv-trend-q">{q.label}</div>
                  <div className="sv-trend-bar-track">
                    <div className="sv-trend-bar" style={{ width: `${Math.max(6, Math.round((q.count / maxQ) * 100))}%` }} />
                  </div>
                  <div className="sv-trend-v">
                    {q.medianPrice != null ? money(q.medianPrice) : <span className="sv-silent">held back</span>}
                    <span className="sv-trend-n"> · {q.count.toLocaleString("en-CA")} sold</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── by neighbourhood — the internal-link table ── */}
        {byNeighbourhood.length > 0 && (
          <>
            <h3 className="sv-agg-sh">Sold prices by {CITY} neighbourhood</h3>
            <p className="sv-agg-note">
              Typical sold price and 12-month volume for every {CITY} neighbourhood we publish. Where a
              sample is too small to publish a price safely, we hold the figure back — but the
              neighbourhood is still here, and still linked.
            </p>
            <div className="sv-nbtable-wrap">
              <table className="sv-nbtable">
                <thead>
                  <tr>
                    <th>Neighbourhood</th>
                    <th className="sv-num">Homes sold</th>
                    <th className="sv-num">Typical sold price</th>
                  </tr>
                </thead>
                <tbody>
                  {byNeighbourhood.map((nb) => (
                    <tr key={nb.slug}>
                      <td>
                        <Link href={`/neighbourhoods/${nb.slug}`} className="sv-nb-link">
                          {nb.name}
                          <span className="sv-nb-arrow"> →</span>
                        </Link>
                      </td>
                      <td className="sv-num sv-nb-count">{nb.count.toLocaleString("en-CA")}</td>
                      <td className="sv-num">
                        {nb.typicalPrice != null ? (
                          <span className="sv-nb-price">{money(nb.typicalPrice)}</span>
                        ) : (
                          <span className="sv-silent">{SILENT}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
