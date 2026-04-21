import Link from "next/link";
import { Container, SerifHeading, Eyebrow, Body } from "@/components/ui";
import { PriceTrendChart } from "./charts/PriceTrendChart";
import type { MarketActivityProps, SoldTableRow } from "@/types/street";
import { formatCADShort } from "@/lib/charts/theme";

export function MarketActivity(props: MarketActivityProps) {
  const {
    salesSummary,
    leasesSummary,
    priceChart,
    rentByBeds,
    soldTable,
    canSeeRecords,
    currentPath,
    streetName,
    streetSlug,
  } = props;

  const signinHref = `/signin?redirect=${encodeURIComponent(currentPath)}&intent=sold&street=${encodeURIComponent(streetSlug)}`;

  return (
    <section id="s6" className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
      <Container>
        <Eyebrow color="blue" size="lg" className="block mb-3">Market activity</Eyebrow>
        <SerifHeading level={2}>
          What has <em>actually been trading</em>
        </SerifHeading>
        <Body variant="lead" className="mt-4 max-w-3xl">
          Closed transactions from the Toronto Regional Real Estate Board. The picture below covers
          recent closed activity across all product types on {streetName}.
        </Body>

        <div className="market-intro">
          <SummaryCard summary={salesSummary} />
          {leasesSummary && <SummaryCard summary={leasesSummary} />}
        </div>

        {priceChart && (
          <div className="chart-wrap">
            <h5>Quarterly sold trend</h5>
            <p className="caption">{priceChart.caption}</p>
            <div className="chart-canvas-container">
              <PriceTrendChart data={priceChart.data} />
            </div>
          </div>
        )}

        {rentByBeds && rentByBeds.length > 0 && (
          <div className="rent-by-beds">
            {rentByBeds.map((t, i) => (
              <div key={i} className="rent-tile">
                <span className="k">{t.label}</span>
                <span className="v">{t.value}</span>
                {t.detail && <span className="sub">{t.detail}</span>}
              </div>
            ))}
          </div>
        )}

        <SoldTableBlock
          rows={soldTable}
          canSeeRecords={canSeeRecords}
          signinHref={signinHref}
          streetName={streetName}
        />
      </Container>
    </section>
  );
}

function SummaryCard({ summary }: { summary: MarketActivityProps["salesSummary"] }) {
  return (
    <div className="market-summary">
      <h4>{summary.title}</h4>
      <p>{summary.body}</p>
      <div className="market-summary-stats">
        {summary.stats.map((s, i) => (
          <div key={i}>
            <span className="k">{s.label}</span>
            <div className="v">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoldTableBlock({
  rows,
  canSeeRecords,
  signinHref,
  streetName,
}: {
  rows: SoldTableRow[];
  canSeeRecords: boolean;
  signinHref: string;
  streetName: string;
}) {
  const gated = !canSeeRecords;

  return (
    <div className={`gated-wrap ${gated ? "is-gated" : ""}`}>
      <table className="data-table">
        <caption>Recent closed sales, {streetName}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Address</th>
            <th scope="col">Beds</th>
            <th scope="col">Sold</th>
            <th scope="col">vs Ask</th>
            <th scope="col">DOM</th>
            <th scope="col">Listing brokerage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 32 }}>No recent sales on record.</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.mls_number}>
                <td>{r.sold_date.slice(0, 10)}</td>
                <td>{r.address}</td>
                <td>{r.beds ?? "—"}</td>
                <td>{formatCADShort(r.sold_price)}</td>
                <td>{(r.sold_to_ask_ratio * 100).toFixed(0)}%</td>
                <td>{r.days_on_market}d</td>
                <td style={{ color: "var(--ink-faint)", fontSize: 12 }}>{r.list_office_name ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {gated && rows.length >= 3 && (
        <div className="gate-overlay">
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--gold)", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
            TREB VOW · Registered access
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
            See every closed sale on {streetName}
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>
            Free with a verified email. Exact sold prices, DOM, and sold-to-ask ratios.
          </div>
          <Link href={signinHref} style={{ display: "inline-block", background: "var(--gold)", color: "var(--navy-deep)", padding: "12px 24px", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13, letterSpacing: "0.02em", textDecoration: "none" }}>
            Sign in free to unlock →
          </Link>
        </div>
      )}
    </div>
  );
}

