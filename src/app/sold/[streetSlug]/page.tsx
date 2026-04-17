import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getSession } from "@/lib/auth";
import { getStreetPageData } from "@/lib/street-data";
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

export const revalidate = 0;

interface Props { params: { streetSlug: string }; searchParams?: { view?: string } }

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStreetPageData(params.streetSlug).catch(() => null);
  const street = data?.streetName ?? params.streetSlug;
  const stats = await getStreetSaleStats(params.streetSlug).catch(() => null);
  const count = stats?.sold_count_90days ?? 0;
  return genMeta({
    title: `Sold homes on ${street} Milton — ${count} recent sales`,
    description: `Real sold prices and closed transactions on ${street} in Milton Ontario. ${count} homes sold in the last 90 days. Free to registered users.`,
    canonical: `https://miltonly.com/sold/${params.streetSlug}`,
  });
}

export default async function StreetSoldPage({ params, searchParams }: Props) {
  const streetData = await getStreetPageData(params.streetSlug).catch(() => null);
  if (!streetData) notFound();

  const user = await getSession();
  const authed = !!user;
  const canSeeRecords = authed && !!user?.vowAcknowledgedAt;
  const view = searchParams?.view === "rentals" ? "rentals" : "sales";

  const [saleStats, leaseStats, saleRecords, leaseRecords, monthly] = await Promise.all([
    getStreetSaleStats(params.streetSlug).catch(() => null),
    getStreetLeaseStats(params.streetSlug).catch(() => null),
    canSeeRecords ? getStreetSoldList(params.streetSlug, "sale", 90, 20).catch(() => []) : Promise.resolve([]),
    canSeeRecords ? getStreetSoldList(params.streetSlug, "lease", 90, 20).catch(() => []) : Promise.resolve([]),
    canSeeRecords ? getStreetMonthlySales(params.streetSlug).catch(() => []) : Promise.resolve([]),
  ]);

  const saleCount = saleStats?.sold_count_90days ?? 0;
  const leaseCount = leaseStats?.leased_count_90days ?? 0;

  const tabBase =
    "px-5 py-3 text-[13px] font-bold border-b-2 transition-colors";
  const tabActive = `${tabBase} border-[#2563eb] text-[#07111f]`;
  const tabIdle = `${tabBase} border-transparent text-[#94a3b8] hover:text-[#475569]`;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-[#f1f5f9] px-5 sm:px-11 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
          <Link href="/" className="hover:text-[#07111f]">Home</Link>
          <span>&rsaquo;</span>
          <Link href="/sold" className="hover:text-[#07111f]">Sold</Link>
          <span>&rsaquo;</span>
          <span className="text-[#475569] font-medium">{streetData.streetName}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-[#07111f] px-5 sm:px-11 py-10">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-3">
            {streetData.streetName} · Milton · Ontario
          </p>
          <h1 className="text-[32px] sm:text-[40px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
            Sold homes on {streetData.streetName}
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-3 max-w-xl leading-relaxed">
            {saleCount} sale{saleCount === 1 ? "" : "s"} · {leaseCount} lease{leaseCount === 1 ? "" : "s"} closed in the last 90 days.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <nav className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11">
        <div className="max-w-6xl mx-auto flex gap-4">
          <Link href={`/sold/${params.streetSlug}`} className={view === "sales" ? tabActive : tabIdle}>
            Sales ({saleCount})
          </Link>
          <Link href={`/sold/${params.streetSlug}?view=rentals`} className={view === "rentals" ? tabActive : tabIdle}>
            Rentals ({leaseCount})
          </Link>
        </div>
      </nav>

      {view === "sales" ? (
        <>
          {/* Public + locked stats row */}
          <section className="px-5 sm:px-11 py-8 bg-white border-b border-[#e2e8f0]">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-5">
                <MarketTemperatureBadge temperature={saleStats?.market_temperature as "hot" | "warm" | "balanced" | "cool" | "cold" | null} />
                <span className="text-[11px] text-[#94a3b8]">Last 90 days</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
                <LockedStat label="Sold (90d)" value={saleCount} authed={authed} alwaysPublic />
                <LockedStat label="Avg sold" value={formatMoney(saleStats?.avg_sold_price ?? null)} authed={authed} />
                <LockedStat label="Median sold" value={formatMoney(saleStats?.median_sold_price ?? null)} authed={authed} />
                <LockedStat label="Avg DOM" value={saleStats?.avg_dom ? `${Math.round(saleStats.avg_dom)}d` : null} authed={authed} />
                <LockedStat label="Sold / ask" value={saleStats?.avg_sold_to_ask ? `${(saleStats.avg_sold_to_ask * 100).toFixed(0)}%` : null} authed={authed} />
              </div>
            </div>
          </section>

          <section className="px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto space-y-6">
              <VowGate street={params.streetSlug} currentPath={`/sold/${params.streetSlug}`} label={streetData.streetName}>
                <>
                  <h2 className="text-[18px] font-extrabold text-[#07111f]">Recent sales</h2>
                  <SoldTable records={saleRecords} />
                  {monthly.length > 0 && (
                    <>
                      <h2 className="text-[18px] font-extrabold text-[#07111f] mt-8">24-month price trend</h2>
                      <PriceTrendChart data={monthly} />
                    </>
                  )}
                </>
              </VowGate>
              <VowComplianceNotice />
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Rentals stats */}
          <section className="px-5 sm:px-11 py-8 bg-white border-b border-[#e2e8f0]">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
                <LockedStat label="Leased (90d)" value={leaseCount} authed={authed} alwaysPublic />
                <LockedStat label="Avg rent" value={formatMoney(leaseStats?.avg_leased_price ?? null)} authed={authed} />
                <LockedStat label="1-bed" value={formatMoney(leaseStats?.avg_leased_price_1bed ?? null)} authed={authed} />
                <LockedStat label="2-bed" value={formatMoney(leaseStats?.avg_leased_price_2bed ?? null)} authed={authed} />
                <LockedStat label="3-bed" value={formatMoney(leaseStats?.avg_leased_price_3bed ?? null)} authed={authed} />
              </div>
            </div>
          </section>

          <section className="px-5 sm:px-11 py-10">
            <div className="max-w-6xl mx-auto space-y-6">
              <VowGate street={params.streetSlug} currentPath={`/sold/${params.streetSlug}?view=rentals`} label={streetData.streetName}>
                <>
                  <h2 className="text-[18px] font-extrabold text-[#07111f]">Recent rentals</h2>
                  <SoldTable records={leaseRecords} emptyMessage="No rentals closed in the last 90 days." />
                  {leaseStats && (
                    <>
                      <h2 className="text-[18px] font-extrabold text-[#07111f] mt-8">Average rent by bed count</h2>
                      <RentByBedsChart
                        oneBed={leaseStats.avg_leased_price_1bed}
                        twoBed={leaseStats.avg_leased_price_2bed}
                        threeBed={leaseStats.avg_leased_price_3bed}
                        fourBed={leaseStats.avg_leased_price_4bed}
                      />
                    </>
                  )}
                </>
              </VowGate>
              <VowComplianceNotice />
            </div>
          </section>
        </>
      )}

      {/* Nearby streets */}
      {streetData.nearbyStreets.length > 0 && (
        <section className="bg-white border-t border-[#e2e8f0] px-5 sm:px-11 py-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-[16px] font-extrabold text-[#07111f] mb-4">Nearby streets</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {streetData.nearbyStreets.map((s) => (
                <Link key={s.slug} href={`/sold/${s.slug}`} className="bg-[#f8f9fb] rounded-xl border border-[#e2e8f0] p-4 hover:bg-white hover:shadow-sm transition-all">
                  <p className="text-[13px] font-bold text-[#07111f]">{s.name}</p>
                  <p className="text-[11px] text-[#94a3b8] mt-1">See recent sales →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
