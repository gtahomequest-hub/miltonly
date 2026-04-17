import type { Metadata } from "next";
import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { getSession } from "@/lib/auth";
import {
  getMiltonSoldTotals,
  getDistinctSoldNeighbourhoods,
  getRecentSoldList,
} from "@/lib/sold-data";
import VowComplianceNotice from "@/components/sold/VowComplianceNotice";
import SoldTable from "@/components/sold/SoldTable";
import VowGate from "@/components/vow/VowGate";

// Always server-render (live sold counts).
export const revalidate = 0;

type TypeFilter = "sale" | "lease";

const PROPERTY_TYPES = [
  { slug: "detached", label: "Detached" },
  { slug: "semi", label: "Semi" },
  { slug: "townhouse", label: "Townhouse" },
  { slug: "condo", label: "Condo" },
] as const;

interface PageProps {
  searchParams?: {
    nbhd?: string;
    ptype?: string;
    type?: string;
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const totals = await getMiltonSoldTotals().catch(() => ({ last30: 0, last90: 0 }));
  return genMeta({
    title: `Milton sold homes — ${totals.last90} recent real estate sales`,
    description: `Browse real sold prices and closed transactions in Milton Ontario. ${totals.last90} homes sold in the last 90 days. Free sold data for registered users.`,
    canonical: `https://miltonly.com/sold${searchParams?.nbhd ? `?nbhd=${encodeURIComponent(searchParams.nbhd)}` : ""}`,
    keywords: [
      "Milton sold homes",
      "Milton real estate sold prices",
      "recent sales Milton Ontario",
      "Milton house sold prices",
      "Milton MLS sold data",
    ],
  });
}

export default async function SoldHubPage({ searchParams }: PageProps) {
  const user = await getSession();
  const authed = !!user;

  const typeParam: TypeFilter = searchParams?.type === "lease" ? "lease" : "sale";
  const nbhdFilter = searchParams?.nbhd;
  const ptypeFilter = searchParams?.ptype;

  const [totals, neighbourhoods, records] = await Promise.all([
    getMiltonSoldTotals().catch(() => ({ last30: 0, last90: 0 })),
    getDistinctSoldNeighbourhoods().catch(() => [] as string[]),
    authed
      ? getRecentSoldList(typeParam, 90, 60, {
          neighbourhood: nbhdFilter,
          property_type: ptypeFilter,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const chipBase =
    "inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors";
  const chipActive = `${chipBase} bg-[#07111f] text-white border-[#07111f]`;
  const chipIdle = `${chipBase} bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8f9fb]`;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Hero */}
      <section className="bg-[#07111f] px-5 sm:px-11 py-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-3">
            Milton · Ontario · Real Estate
          </p>
          <h1 className="text-[32px] sm:text-[42px] font-extrabold text-[#f8f9fb] tracking-[-0.5px] leading-[1.05]">
            Milton sold homes
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[rgba(248,249,251,0.6)] mt-3 max-w-xl leading-relaxed">
            Real closed transactions from TREB MLS<sup>®</sup>. {totals.last90} homes sold on Milton
            streets in the last 90 days ({totals.last30} in the last 30).
          </p>
          {!authed && (
            <Link
              href={`/signin?redirect=${encodeURIComponent("/sold")}`}
              className="inline-block mt-5 bg-[#f59e0b] text-[#07111f] text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-[#fbbf24] transition-colors"
            >
              Sign in free to see exact sold prices →
            </Link>
          )}
        </div>
      </section>

      {/* Filter chips */}
      <section className="bg-white border-b border-[#e2e8f0] px-5 sm:px-11 py-5">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mr-2">
              Transaction
            </span>
            <Link href={`/sold${nbhdFilter ? `?nbhd=${encodeURIComponent(nbhdFilter)}` : ""}`} className={typeParam === "sale" ? chipActive : chipIdle}>
              Sold
            </Link>
            <Link href={`/sold?type=lease${nbhdFilter ? `&nbhd=${encodeURIComponent(nbhdFilter)}` : ""}`} className={typeParam === "lease" ? chipActive : chipIdle}>
              Leased
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mr-2">
              Property type
            </span>
            <Link href={`/sold?type=${typeParam}${nbhdFilter ? `&nbhd=${encodeURIComponent(nbhdFilter)}` : ""}`} className={!ptypeFilter ? chipActive : chipIdle}>
              All
            </Link>
            {PROPERTY_TYPES.map((t) => (
              <Link
                key={t.slug}
                href={`/sold?type=${typeParam}&ptype=${t.slug}${nbhdFilter ? `&nbhd=${encodeURIComponent(nbhdFilter)}` : ""}`}
                className={ptypeFilter === t.slug ? chipActive : chipIdle}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {neighbourhoods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide mr-2">
                Neighbourhood
              </span>
              <Link href={`/sold?type=${typeParam}${ptypeFilter ? `&ptype=${ptypeFilter}` : ""}`} className={!nbhdFilter ? chipActive : chipIdle}>
                All
              </Link>
              {neighbourhoods.slice(0, 10).map((n) => (
                <Link
                  key={n}
                  href={`/sold?type=${typeParam}&nbhd=${encodeURIComponent(n)}${ptypeFilter ? `&ptype=${ptypeFilter}` : ""}`}
                  className={nbhdFilter === n ? chipActive : chipIdle}
                >
                  {n}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="px-5 sm:px-11 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <VowGate currentPath="/sold">
            <>
              <p className="text-[13px] text-[#475569]">
                Showing {records.length} {typeParam === "sale" ? "sold" : "leased"} record{records.length === 1 ? "" : "s"} — last 90 days
                {nbhdFilter ? ` · ${nbhdFilter}` : ""}
                {ptypeFilter ? ` · ${PROPERTY_TYPES.find((t) => t.slug === ptypeFilter)?.label ?? ptypeFilter}` : ""}
              </p>
              <SoldTable records={records} showStreet emptyMessage="No records match these filters in the last 90 days." />
            </>
          </VowGate>

          <VowComplianceNotice />
        </div>
      </section>
    </div>
  );
}
