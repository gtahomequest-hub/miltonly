// Server-rendered Sold section for street pages. Shows Sales | Rentals
// toggle via ?soldView=sales|rentals query param. Always-public stats
// at the top; VowGate-wrapped table and chart below.

import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getStreetSaleStats,
  getStreetLeaseStats,
  getStreetSoldList,
  getStreetMonthlySales,
} from "@/lib/sold-data";
import VowComplianceNotice from "@/components/sold/VowComplianceNotice";
import MarketTemperatureBadge from "@/components/sold/MarketTemperatureBadge";
import LockedStat from "@/components/sold/LockedStat";
import SoldTable from "@/components/sold/SoldTable";
import PriceTrendChart from "@/components/sold/PriceTrendChart";
import RentByBedsChart from "@/components/sold/RentByBedsChart";
import VowGate from "@/components/vow/VowGate";

type View = "sales" | "rentals";

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function StreetSoldBlock({
  streetSlug,
  streetName,
  currentPath,
  view,
}: {
  streetSlug: string;
  streetName: string;
  currentPath: string;
  view: View;
}) {
  const user = await getSession();
  const authed = !!user;

  const [saleStats, leaseStats, saleRecords, leaseRecords, monthly] = await Promise.all([
    getStreetSaleStats(streetSlug).catch(() => null),
    getStreetLeaseStats(streetSlug).catch(() => null),
    authed && view === "sales"
      ? getStreetSoldList(streetSlug, "sale", 90, 20).catch(() => [])
      : Promise.resolve([]),
    authed && view === "rentals"
      ? getStreetSoldList(streetSlug, "lease", 90, 20).catch(() => [])
      : Promise.resolve([]),
    authed && view === "sales"
      ? getStreetMonthlySales(streetSlug).catch(() => [])
      : Promise.resolve([]),
  ]);

  // No data at all — skip the whole block rather than rendering an empty shell.
  const saleCount = saleStats?.sold_count_90days ?? 0;
  const leaseCount = leaseStats?.leased_count_90days ?? 0;
  if (saleCount === 0 && leaseCount === 0) return null;

  const salesHref = `${currentPath}?soldView=sales`;
  const rentalsHref = `${currentPath}?soldView=rentals`;

  const subTabBase = "px-4 py-2 text-[12px] font-bold rounded-full border transition-colors";
  const subTabActive = `${subTabBase} bg-[#07111f] text-white border-[#07111f]`;
  const subTabIdle = `${subTabBase} bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8f9fb]`;

  return (
    <section id="sold" className="bg-white px-5 sm:px-11 py-10 border-t border-[#e2e8f0]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em]">
            TREB MLS<sup>®</sup> Sold Data
          </span>
          <MarketTemperatureBadge temperature={saleStats?.market_temperature as "hot" | "warm" | "balanced" | "cool" | "cold" | null} />
        </div>
        <h2 className="text-[20px] sm:text-[24px] font-extrabold text-[#07111f]">
          What&apos;s sold + rented on {streetName}
        </h2>
        <p className="text-[13px] text-[#64748b] mt-1 mb-6">
          {saleCount} sale{saleCount === 1 ? "" : "s"} · {leaseCount} lease{leaseCount === 1 ? "" : "s"} closed in the last 90 days.
        </p>

        {/* Sub-tab toggle */}
        <div className="flex gap-2 mb-6">
          <Link href={salesHref} scroll={false} className={view === "sales" ? subTabActive : subTabIdle}>
            Sales ({saleCount})
          </Link>
          <Link href={rentalsHref} scroll={false} className={view === "rentals" ? subTabActive : subTabIdle}>
            Rentals ({leaseCount})
          </Link>
        </div>

        {view === "sales" ? (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8 bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-5">
              <LockedStat label="Sold (90d)" value={saleCount} authed={authed} alwaysPublic />
              <LockedStat label="Avg sold" value={formatMoney(saleStats?.avg_sold_price ?? null)} authed={authed} />
              <LockedStat label="Median sold" value={formatMoney(saleStats?.median_sold_price ?? null)} authed={authed} />
              <LockedStat label="Avg DOM" value={saleStats?.avg_dom ? `${Math.round(saleStats.avg_dom)}d` : null} authed={authed} />
              <LockedStat label="Sold / ask" value={saleStats?.avg_sold_to_ask ? `${(saleStats.avg_sold_to_ask * 100).toFixed(0)}%` : null} authed={authed} />
            </div>

            <VowGate street={streetSlug} currentPath={currentPath} label={streetName}>
              <div className="space-y-8">
                <div>
                  <h3 className="text-[14px] font-bold text-[#07111f] mb-4">Recent sales</h3>
                  <SoldTable records={saleRecords} />
                </div>
                {monthly.length > 1 && (
                  <div>
                    <h3 className="text-[14px] font-bold text-[#07111f] mb-4">24-month price trend</h3>
                    <PriceTrendChart data={monthly} />
                  </div>
                )}
              </div>
            </VowGate>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8 bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-5">
              <LockedStat label="Leased (90d)" value={leaseCount} authed={authed} alwaysPublic />
              <LockedStat label="Avg rent" value={formatMoney(leaseStats?.avg_leased_price ?? null)} authed={authed} />
              <LockedStat label="1-bed" value={formatMoney(leaseStats?.avg_leased_price_1bed ?? null)} authed={authed} />
              <LockedStat label="2-bed" value={formatMoney(leaseStats?.avg_leased_price_2bed ?? null)} authed={authed} />
              <LockedStat label="3-bed" value={formatMoney(leaseStats?.avg_leased_price_3bed ?? null)} authed={authed} />
            </div>

            <VowGate street={streetSlug} currentPath={currentPath} label={streetName}>
              <div className="space-y-8">
                <div>
                  <h3 className="text-[14px] font-bold text-[#07111f] mb-4">Recent rentals</h3>
                  <SoldTable records={leaseRecords} emptyMessage="No rentals closed in the last 90 days." />
                </div>
                {leaseStats && (
                  <div>
                    <h3 className="text-[14px] font-bold text-[#07111f] mb-4">Average rent by bed count</h3>
                    <RentByBedsChart
                      oneBed={leaseStats.avg_leased_price_1bed}
                      twoBed={leaseStats.avg_leased_price_2bed}
                      threeBed={leaseStats.avg_leased_price_3bed}
                      fourBed={leaseStats.avg_leased_price_4bed}
                    />
                  </div>
                )}
              </div>
            </VowGate>
          </>
        )}

        <div className="mt-6">
          <VowComplianceNotice />
        </div>
      </div>
    </section>
  );
}
