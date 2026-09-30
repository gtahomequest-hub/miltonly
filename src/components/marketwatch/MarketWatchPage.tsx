// src/components/marketwatch/MarketWatchPage.tsx
// MARKET WATCH AFTER MC-046 STAGE 1 (R6). Every edition was sold statistics: the weekly sold count,
// typicals, by-form and by-neighbourhood figures, the summary sentence and the generated
// interpretation, all derived from VOW records (PropTx VOW Best Practices item 40). None of it is
// shown any more, to anyone, until Stage 2 builds a gated view.
//
// The page body is its heading and the neutral line. It takes no edition content: the caller must
// not read MarketEdition.sectionsJson, the summary or the interpretation to render it.
import "./market-watch.css";
import SoldHistoryLine from "@/components/vow/SoldHistoryLine";

/** "7 September 2026" from a Monday's ISO date; null for anything that is not one. */
export function weekOfLabel(weekOf: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) return null;
  const d = new Date(`${weekOf}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function MarketWatchPage({ weekOf }: { weekOf?: string }) {
  const label = weekOf ? weekOfLabel(weekOf) : null;
  return (
    <div className="market-watch">
      <header className="mw-mast">
        <div className="mw-wrap">
          <div className="mw-crumb">
            <a href="/">Miltonly</a>
            <span>/</span>
            <a href="/market-watch">Market Watch</a>
            {label && (
              <>
                <span>/</span>
                {weekOf}
              </>
            )}
          </div>
          <h1>{label ? `Milton Market Watch, week of ${label}` : "Milton Market Watch"}</h1>
          <SoldHistoryLine subject="Milton" soldViewHref="/sold" tone="dark" className="mw-lede" />
        </div>
      </header>
    </div>
  );
}
