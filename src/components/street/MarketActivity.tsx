import { Container, SerifHeading, Eyebrow, Body } from "@/components/ui";
import { PriceTrendChart } from "./charts/PriceTrendChart";
import type { MarketActivityProps } from "@/types/street";

export function MarketActivity(props: MarketActivityProps & { children?: React.ReactNode }) {
  const {
    salesSummary,
    leasesSummary,
    priceChart,
    rentByBeds,
    streetName,
    children,
  } = props;

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

        {children}
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


