import { Container, SerifHeading, Body, MonoLabel } from "@/components/ui";
import { InlineCTASection } from "./InlineCTASection";
import { MiniChart } from "./charts/MiniChart";
import type { TypeSectionProps, StatCell } from "@/types/street";

export function TypeSection(props: TypeSectionProps) {
  const {
    type,
    displayName,
    hasData,
    intro,
    streetName,
    streetShort,
    typicalPrice,
    statsSold,
    statsLeased,
    chartSold,
    chartLeased,
    noDataMessage,
    showContactTeamPrompt,
  } = props;

  if (!hasData) return null;

  const hasSold = statsSold.length > 0 || !!chartSold;
  const hasLeased = !!(statsLeased && statsLeased.length) || !!chartLeased;

  const variant =
    type === "detached" ? "detached"
    : type === "semi" ? "semi"
    : type === "condo" ? "condo"
    : "townhouse";

  return (
    <section
      id={`type-${type}`}
      className="type-section-anchor border-b"
      style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}
    >
      <Container>
        <MonoLabel color="blue" size="lg" className="block mb-3">
          {displayName} on {streetName}
        </MonoLabel>
        <SerifHeading level={2}>
          <em>{displayName}</em> trade patterns
        </SerifHeading>
        <Body variant="lead" className="mt-4 max-w-3xl">{intro}</Body>

        {/* Sold subsection */}
        {hasSold && (
          <>
            <div className="type-subsection-head">Sold</div>
            {statsSold.length > 0 && <StatsRow cells={statsSold} />}
            {chartSold && !showContactTeamPrompt ? (
              <div className="mini-chart-wrap">
                <div className="mini-chart-header">
                  <div className="mini-chart-headline">{chartSold.headline}</div>
                  <div className="mini-chart-trend">
                    <span className="pct">{chartSold.trendLabel}</span>
                    year over year
                  </div>
                </div>
                <div className="mini-chart-canvas">
                  <MiniChart data={chartSold.data} variant="sold" />
                </div>
                <div className="mini-chart-note">{chartSold.note}</div>
              </div>
            ) : showContactTeamPrompt ? (
              <div className="no-data-card">
                Market data for {displayName.toLowerCase()} on {streetName} is limited,
                with fewer than five closed transactions in the window.
                Contact our team for a private read on this segment.
              </div>
            ) : noDataMessage ? (
              <div className="no-data-card">{noDataMessage}</div>
            ) : null}
          </>
        )}

        {/* Leased subsection */}
        {hasLeased && (
          <>
            <div className="type-subsection-head">Leased</div>
            {statsLeased && statsLeased.length > 0 && <StatsRow cells={statsLeased} />}
            {chartLeased && (
              <div className="mini-chart-wrap">
                <div className="mini-chart-header">
                  <div className="mini-chart-headline">{chartLeased.headline}</div>
                  <div className="mini-chart-trend">
                    <span className="pct">{chartLeased.trendLabel}</span>
                    year over year
                  </div>
                </div>
                <div className="mini-chart-canvas">
                  <MiniChart data={chartLeased.data} variant="leased" />
                </div>
                <div className="mini-chart-note">{chartLeased.note}</div>
              </div>
            )}
          </>
        )}

        {/* Inline CTA specific to type — skip when typical price is suppressed
            by k-anonymity (showContactTeamPrompt). The contact-team note above
            already explains the gap, so appending a "$0" CTA would be worse
            than silence. */}
        {typicalPrice > 0 && !showContactTeamPrompt && (
          <InlineCTASection
            variant={variant}
            streetShort={streetShort}
            typicalPrice={typicalPrice}
          />
        )}
      </Container>
    </section>
  );
}

function StatsRow({ cells }: { cells: StatCell[] }) {
  return (
    <div className="type-summary-grid">
      {cells.map((c, i) => (
        <div key={i} className="type-summary-cell">
          <span className="k">{c.label}</span>
          <span className="v">{c.value}</span>
          {c.detail && <span className="sub">{c.detail}</span>}
        </div>
      ))}
    </div>
  );
}
