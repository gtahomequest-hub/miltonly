// src/lib/streetEnrichment.ts
// DEC-CONDO-6 → STREET TIER. Turns sub-k5 "barren" street pages into rich ones
// WITHOUT ever dropping the k>=5 price floor (sub-k5 sale prices are a TRREB VOW
// violation). Three data folds, all VOW-safe:
//   1. AREA-CONTEXT — the street's neighbourhood typical price, computed with the
//      hub's OWN saleAggQuery + assembleAggregates so it is byte-identical to the
//      hub page one click away (no parallel query that could drift). Labelled
//      neighbourhood-grain, never street.
//   2. GRADUATED WINDOW (the radius doctrine on the TIME axis) — prefer the 12-month
//      figure wherever it clears k>=5 (every currently-rich page stays byte-identical,
//      most current + most accurate); fall back to the full ~26-month licensing
//      ceiling ONLY where 12mo is sub-k5. Same graduation for lease. sold_date<=NOW()
//      on every window. This lights ~118 more sale + ~38 lease pages without touching
//      rich ones.
//   3. TIER — mirrors condo K_IDENTITY=3: below 3 sale AND 3 lease trades the page is
//      identity-only (identity + area-context + alerts CTA, nothing transaction-derived).
//
// Prices never enter JS below k: the graduated fallback query is COUNT+AVG gated at
// k>=5 in JS before the average is kept; below k the average is discarded (null).
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { saleAggQuery, assembleAggregates } from "@/lib/ai/buildHubInput";

const K_TYPICAL = 5;   // price floor — NEVER dropped
const K_IDENTITY = 3;  // below this on BOTH sides → identity-only

export type PriceWindow = "12mo" | "full";

export interface PriceBasis {
  typical: number;   // rounded typical (avg) price/rent — only ever set when count>=k
  count: number;     // sample size backing it (for the mandatory window disclosure)
  window: PriceWindow;
}
export interface StreetAreaContext {
  neighbourhoodName: string;
  neighbourhoodSlug: string | null;
  typicalPrice: number | null; // hub-identical neighbourhood typical (k-anon; null when sub-k)
  /** sales backing that typical — the sample count its disclosure must state. Null when the
   *  typical itself is suppressed (nothing published, nothing to disclose). */
  sampleCount: number | null;
}
export type StreetTier = "priced-sale" | "priced-lease" | "area-only" | "identity-only";

export interface StreetEnrichment {
  areaContext: StreetAreaContext | null;
  saleBasis: PriceBasis | null;   // graduated; null = no publishable sale price
  leaseBasis: PriceBasis | null;  // graduated; null = no publishable lease price
  tier: StreetTier;
  // raw counts kept for the gate/disclosure (12mo vs full, both sides)
  counts: { sale12mo: number; saleFull: number; lease12mo: number; leaseFull: number };
  // TRUE when the street has >=1 resale anywhere in the licensed window. Gates the
  // "No resales recorded … yet" copy so it renders ONLY on genuinely zero-sale streets —
  // the copy was written for the ~zero population and must carry that gate with it.
  hasAnySale: boolean;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

// Full-window (rolling ~26mo licensing ceiling) COUNT + AVG for one transaction type.
// Only queried when the 12mo figure is sub-k5 — rich pages incur no extra query.
async function fullWindowAgg(siblingSlugs: string[], tx: "For Sale" | "For Lease"): Promise<{ count: number; avg: number | null }> {
  const sd = getSoldDb();
  if (!sd) return { count: 0, avg: null };
  const rows = await (sd`
    SELECT COUNT(*)::int AS n, AVG(sold_price) AS avg
    FROM sold.sold_records
    WHERE street_slug = ANY(${siblingSlugs}::text[])
      AND perm_advertise = TRUE
      AND transaction_type = ${tx}
      AND sold_date <= NOW()
      AND sold_price IS NOT NULL
  ` as unknown as Promise<Array<{ n: number; avg: string | null }>>).catch(() => [] as Array<{ n: number; avg: string | null }>);
  return { count: rows[0]?.n ?? 0, avg: num(rows[0]?.avg ?? null) };
}

// Does the record hold ANY resale for this street, ever? No date guard (a firm sale closing next
// week still counts as recorded) and no price guard (a row without a price is still a transaction).
// This is the sole predicate behind the "No resales recorded … yet" claim — see resaleClaim.ts.
async function anySaleOnRecord(siblingSlugs: string[]): Promise<boolean> {
  const sd = getSoldDb();
  if (!sd) return false;
  const rows = await (sd`
    SELECT 1 AS hit
    FROM sold.sold_records
    WHERE street_slug = ANY(${siblingSlugs}::text[])
      AND perm_advertise = TRUE
      AND transaction_type = 'For Sale'
    LIMIT 1
  ` as unknown as Promise<Array<{ hit: number }>>).catch(() => [] as Array<{ hit: number }>);
  return rows.length > 0;
}

// Graduate one side: prefer 12mo when it clears k>=5, else fall back to the full window.
async function graduate(
  siblingSlugs: string[],
  tx: "For Sale" | "For Lease",
  count12mo: number,
  avg12mo: number | null,
): Promise<{ basis: PriceBasis | null; fullCount: number }> {
  if (count12mo >= K_TYPICAL && avg12mo !== null) {
    return { basis: { typical: Math.round(avg12mo), count: count12mo, window: "12mo" }, fullCount: count12mo };
  }
  const full = await fullWindowAgg(siblingSlugs, tx);
  if (full.count >= K_TYPICAL && full.avg !== null) {
    return { basis: { typical: Math.round(full.avg), count: full.count, window: "full" }, fullCount: full.count };
  }
  return { basis: null, fullCount: full.count };
}

export async function buildStreetEnrichment(params: {
  slug: string;
  siblingSlugs: string[];
  sale12moCount: number;
  sale12moAvg: number | null;
  lease12moCount: number;
  lease12moAvg: number | null;
}): Promise<StreetEnrichment> {
  const { slug, siblingSlugs, sale12moCount, sale12moAvg, lease12moCount, lease12moAvg } = params;

  // ── area-context (hub-identical) ──
  let areaContext: StreetAreaContext | null = null;
  const rs = await prisma.residentialStreet
    .findUnique({ where: { slug }, select: { neighbourhood: { select: { slug: true, name: true, rawStrings: true } } } })
    .catch(() => null);
  const nbhd = rs?.neighbourhood ?? null;
  if (nbhd) {
    // SAME functions the hub page uses → typicalPrice byte-identical to the hub.
    const sale = await saleAggQuery(nbhd.rawStrings).catch(() => []);
    const agg = assembleAggregates(sale[0] ?? null, 0);
    const typicalPrice = agg.typicalPrice;
    areaContext = {
      neighbourhoodName: nbhd.name,
      neighbourhoodSlug: nbhd.slug,
      typicalPrice,
      // the same aggregate that produced the typical also carries its sample size — carry it through
      // so the disclosure can state a real count instead of the countless "across sales" literal
      sampleCount: typicalPrice != null ? agg.salesCount : null,
    };
  }

  // ── graduated sale + lease ──
  const [saleG, leaseG] = await Promise.all([
    graduate(siblingSlugs, "For Sale", sale12moCount, sale12moAvg),
    graduate(siblingSlugs, "For Lease", lease12moCount, lease12moAvg),
  ]);

  const bestSale = Math.max(sale12moCount, saleG.fullCount);
  const bestLease = Math.max(lease12moCount, leaseG.fullCount);
  const identityOnly = bestSale < K_IDENTITY && bestLease < K_IDENTITY;

  // ── hasAnySale: EXISTENCE, not closure ────────────────────────────────────────────────────────
  // bestSale is built from windows that both carry `sold_date <= NOW()`. That guard is a PRICE rule
  // — never publish a figure off a deal that hasn't closed — and it is the wrong test for the
  // binary claim "no resales recorded on this street". 215 For Sale records in the table are firm
  // with a future closing date; on 6 published streets they were the ONLY sale, so the page claimed
  // the record was empty when a sale was closing days later. Ask the record directly, and only when
  // we are actually about to make the absence claim (bestSale === 0), so priced pages pay nothing.
  const hasAnySale = bestSale > 0 ? true : await anySaleOnRecord(siblingSlugs);

  const tier: StreetTier = saleG.basis
    ? "priced-sale"
    : leaseG.basis
      ? "priced-lease"
      : identityOnly
        ? "identity-only"
        : "area-only";

  return {
    areaContext,
    saleBasis: saleG.basis,
    leaseBasis: leaseG.basis,
    tier,
    counts: { sale12mo: sale12moCount, saleFull: saleG.fullCount, lease12mo: lease12moCount, leaseFull: leaseG.fullCount },
    hasAnySale,
  };
}

/** The mandatory window+sample disclosure that must accompany EVERY published price. */
export function windowDisclosure(b: PriceBasis): string {
  const noun = b.count === 1 ? "sale" : "sales";
  return b.window === "12mo"
    ? `across ${b.count} ${noun} in the last 12 months`
    : `across ${b.count} ${noun} in the last ~2 years`;
}
export function leaseDisclosure(b: PriceBasis): string {
  const noun = b.count === 1 ? "lease" : "leases";
  return b.window === "12mo"
    ? `across ${b.count} ${noun} in the last 12 months`
    : `across ${b.count} ${noun} in the last ~2 years`;
}
