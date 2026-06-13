// Forest-v2 sold/leased table for the .sold-v2 shell. RESTYLE ONLY — identical
// data contract to SoldTable (SoldListItem[]), same columns including the VOW
// 6.3(c) inline Listing Brokerage column. Server component: render ONLY when the
// caller has already verified the session (the /sold page gates upstream and
// never fetches records for anon, so this never receives gated data).

import type { SoldListItem } from "@/lib/sold-data";

function formatMoney(n: number, isRent: boolean): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (isRent) return `$${Math.round(n).toLocaleString()}/mo`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function SoldTableForest({
  records,
  showStreet = false,
  emptyMessage,
}: {
  records: SoldListItem[];
  showStreet?: boolean;
  emptyMessage?: string;
}) {
  if (records.length === 0) {
    return (
      <div className="sv-records">
        <p className="sv-empty">
          {emptyMessage ?? "No matching transactions in the last 90 days."}
        </p>
      </div>
    );
  }

  return (
    <div className="sv-records">
      <div className="sv-rtable-scroll">
        <table className="sv-rtable">
          <thead>
            <tr>
              <th>Address</th>
              {showStreet && <th>Street</th>}
              <th>Type</th>
              <th className="sv-num">Beds</th>
              <th className="sv-num">Sold</th>
              <th className="sv-num">Asked</th>
              <th className="sv-num">Ratio</th>
              <th className="sv-num">DOM</th>
              <th className="sv-num">Date</th>
              <th>Listing Brokerage</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const isRent = r.transaction_type === "For Lease";
              const ratio = r.list_price > 0 ? (r.sold_price / r.list_price) * 100 : 0;
              return (
                <tr key={r.mls_number}>
                  <td className="sv-addr">{r.address}</td>
                  {showStreet && <td>{r.street_name}</td>}
                  <td style={{ textTransform: "capitalize" }}>{r.property_type}</td>
                  <td className="sv-num">{r.beds ?? "—"}</td>
                  <td className="sv-num sv-sold">{formatMoney(r.sold_price, isRent)}</td>
                  <td className="sv-num">{formatMoney(r.list_price, isRent)}</td>
                  <td className="sv-num">{ratio > 0 ? `${ratio.toFixed(0)}%` : "—"}</td>
                  <td className="sv-num">{r.days_on_market}</td>
                  <td className="sv-num">{formatDate(r.sold_date)}</td>
                  {/* VOW 6.3(c) — listing Brokerage in the same font/size as other cells */}
                  <td className="sv-brok">{r.list_office_name ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
