// Server-rendered Sold section for neighbourhood pages. Public stats +
// market score badge always rendered; table, price-by-type chart, and rent-by-beds
// chart gated behind VowGate for authed users only.

import { getSession } from "@/lib/auth";
import {
  getNeighbourhoodSaleStats,
  getNeighbourhoodLeaseStats,
  getNeighbourhoodSoldList,
} from "@/lib/sold-data";
import VowComplianceNotice from "@/components/sold/VowComplianceNotice";
import LockedStat from "@/components/sold/LockedStat";
import SoldTable from "@/components/sold/SoldTable";
import PriceByTypeChart from "@/components/sold/PriceByTypeChart";
import RentByBedsChart from "@/components/sold/RentByBedsChart";
import VowGate from "@/components/vow/VowGate";

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function NeighbourhoodSoldBlock({
  neighbourhood,
  displayName,
  currentPath,
}: {
  neighbourhood: string; // raw TREB name (the DB key)
  displayName: string;
  currentPath: string;
}) {
  const user = await getSession();
  const authed = !!user;
  const canSeeRecords = authed && !!user?.vowAcknowledgedAt;

  const [saleStats, leaseStats, saleRecords, leaseRecords] = await Promise.all([
    getNeighbourhoodSaleStats(neighbourhood).catch(() => null),
    getNeighbourhoodLeaseStats(neighbourhood).catch(() => null),
    canSeeRecords ? getNeighbourhoodSoldList(neighbourhood, "sale", 90, 20).catch(() => []) : Promise.resolve([]),
    canSeeRecords ? getNeighbourhoodSoldList(neighbourhood, "lease", 90, 20).catch(() => []) : Promise.resolve([]),
  ]);

  const saleCount = saleStats?.sold_count_90days ?? 0;
  const leaseCount = leaseStats?.leased_count_90days ?? 0;
  if (saleCount === 0 && leaseCount === 0) return null;

  const score = saleStats?.market_score;
  const scoreMeta = score !== null && score !== undefined
    ? score >= 75
      ? { label: "Strong sellers' area", tone: "bg-red-100 text-red-800" }
      : score >= 55
        ? { label: "Balanced market", tone: "bg-slate-100 text-slate-800" }
        : { label: "Buyers' leverage", tone: "bg-blue-100 text-blue-800" }
    : null;

  return (
    <section id="sold" className="bg-white px-5 sm:px-11 py-12 border-t border-[#e2e8f0]">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-2">
            TREB MLS<sup>®</sup> Sold Data
          </p>
          <h2 className="text-[22px] sm:text-[26px] font-extrabold text-[#07111f]">
            Recent sales in {displayName}
          </h2>
          <p className="text-[13px] text-[#64748b] mt-1">
            {saleCount} sale{saleCount === 1 ? "" : "s"} · {leaseCount} lease{leaseCount === 1 ? "" : "s"} closed in the last 90 days.
          </p>
        </div>

        {/* Public-safe stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-5">
          <LockedStat label="Sold (90d)" value={saleCount} authed={authed} alwaysPublic />
          <LockedStat label="Leased (90d)" value={leaseCount} authed={authed} alwaysPublic />
          <LockedStat label="Avg sold" value={formatMoney(saleStats?.avg_sold_detached ?? saleStats?.avg_sold_town ?? null)} authed={authed} />
          <LockedStat label="Avg DOM" value={saleStats?.avg_dom ? `${Math.round(saleStats.avg_dom)}d` : null} authed={authed} />
          <LockedStat label="Sold / ask" value={saleStats?.avg_sold_to_ask ? `${(saleStats.avg_sold_to_ask * 100).toFixed(0)}%` : null} authed={authed} />
        </div>

        {scoreMeta && (
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${scoreMeta.tone}`}>
              {scoreMeta.label}
            </span>
            <span className="text-[11px] text-[#94a3b8]">
              Market score {Math.round(score!)} / 100
            </span>
          </div>
        )}

        {/* Sales — table + price by type */}
        <VowGate neighbourhood={neighbourhood} currentPath={currentPath} label={displayName}>
          <div className="space-y-8">
            <div>
              <h3 className="text-[14px] font-bold text-[#07111f] mb-4">Recent sales</h3>
              <SoldTable records={saleRecords} showStreet />
            </div>
            {saleStats && (
              <div>
                <h3 className="text-[14px] font-bold text-[#07111f] mb-4">Average sold price by type</h3>
                <PriceByTypeChart
                  detached={saleStats.avg_sold_detached}
                  semi={saleStats.avg_sold_semi}
                  town={saleStats.avg_sold_town}
                  condo={saleStats.avg_sold_condo}
                />
              </div>
            )}
          </div>
        </VowGate>

        {/* Rentals subsection */}
        {(leaseCount > 0 || leaseStats) && (
          <>
            <div>
              <h3 className="text-[18px] font-extrabold text-[#07111f]">Rentals</h3>
              <p className="text-[12px] text-[#64748b] mt-1">Recent closed leases in {displayName}.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-5">
              <LockedStat label="Avg rent" value={formatMoney(leaseStats?.avg_leased_price ?? null)} authed={authed} />
              <LockedStat label="1-bed" value={formatMoney(leaseStats?.avg_leased_price_1bed ?? null)} authed={authed} />
              <LockedStat label="2-bed" value={formatMoney(leaseStats?.avg_leased_price_2bed ?? null)} authed={authed} />
              <LockedStat label="3-bed" value={formatMoney(leaseStats?.avg_leased_price_3bed ?? null)} authed={authed} />
              <LockedStat label="Avg DOM" value={leaseStats?.avg_lease_dom ? `${Math.round(leaseStats.avg_lease_dom)}d` : null} authed={authed} />
            </div>
            <VowGate neighbourhood={neighbourhood} currentPath={currentPath} label={displayName}>
              <div className="space-y-8">
                <SoldTable records={leaseRecords} showStreet emptyMessage="No rentals closed in the last 90 days." />
                {leaseStats && (
                  <RentByBedsChart
                    oneBed={leaseStats.avg_leased_price_1bed}
                    twoBed={leaseStats.avg_leased_price_2bed}
                    threeBed={leaseStats.avg_leased_price_3bed}
                    fourBed={leaseStats.avg_leased_price_4bed}
                  />
                )}
              </div>
            </VowGate>
          </>
        )}

        <VowComplianceNotice />

        {/* Link to dedicated street-level sold pages */}
        <div className="text-center">
          <p className="text-[11px] text-[#94a3b8]">
            Want street-level detail? Every published {displayName} street has a dedicated{" "}
            <a href="/sold" className="text-[#2563eb] font-semibold hover:underline">sold page</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
