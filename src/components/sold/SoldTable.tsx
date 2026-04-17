// Server-rendered table of sold/leased records. Call only from server
// contexts where the viewer is already authed — VowGate handles the
// auth/anon split upstream. This component does NOT gate itself; it
// assumes the caller has verified the session.

import type { SoldListItem } from "@/lib/sold-data";

function formatMoney(n: number, isRent: boolean): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (isRent) {
    return `$${Math.round(n).toLocaleString()}/mo`;
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function SoldTable({
  records,
  showStreet = false,
  emptyMessage,
}: {
  records: SoldListItem[];
  /** Include the street column — useful on neighbourhood or hub pages. */
  showStreet?: boolean;
  emptyMessage?: string;
}) {
  if (records.length === 0) {
    return (
      <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-10 text-center">
        <p className="text-[13px] text-[#64748b]">
          {emptyMessage ?? "No matching transactions in the last 90 days."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-5 sm:mx-0">
      <table className="w-full text-[13px] text-left">
        <thead className="bg-[#07111f] text-[11px] text-[rgba(248,249,251,0.75)] uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3">Address</th>
            {showStreet && <th className="px-4 py-3">Street</th>}
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Beds</th>
            <th className="px-4 py-3 text-right">Sold</th>
            <th className="px-4 py-3 text-right">Asked</th>
            <th className="px-4 py-3 text-right">Ratio</th>
            <th className="px-4 py-3 text-right">DOM</th>
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0] bg-white">
          {records.map((r) => {
            const isRent = r.transaction_type === "For Lease";
            const ratio = r.list_price > 0 ? (r.sold_price / r.list_price) * 100 : 0;
            return (
              <tr key={r.mls_number} className="hover:bg-[#f8f9fb]">
                <td className="px-4 py-3 font-medium text-[#07111f]">{r.address}</td>
                {showStreet && <td className="px-4 py-3 text-[#475569]">{r.street_name}</td>}
                <td className="px-4 py-3 capitalize text-[#475569]">{r.property_type}</td>
                <td className="px-4 py-3 text-right text-[#475569]">{r.beds ?? "—"}</td>
                <td className="px-4 py-3 text-right font-bold text-[#07111f]">{formatMoney(r.sold_price, isRent)}</td>
                <td className="px-4 py-3 text-right text-[#475569]">{formatMoney(r.list_price, isRent)}</td>
                <td className="px-4 py-3 text-right font-semibold text-[#07111f]">
                  {ratio > 0 ? `${ratio.toFixed(0)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-[#475569]">{r.days_on_market}</td>
                <td className="px-4 py-3 text-right text-[#475569]">{formatDate(r.sold_date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
