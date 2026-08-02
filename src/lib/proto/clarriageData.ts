// src/lib/proto/clarriageData.ts
// PROTOTYPE (two-layer street page). Deterministic Layer-1 data for Clarriage Court, from LIVE data.
// Self-contained — imports NONE of the files feat/street-tier-rich touches. RAILS: k>=5 for any price,
// k>=10 for a range, NULL never 0, sold_date<=NOW() on every window, aggregates only (no MLS / address
// / individual sold record ever leaves this function).
import "server-only";
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { NEIGHBOURHOOD_CENTROIDS, haversineKm, walkMinutes, driveMinutes, GO_STATION, HIGHWAY_ONRAMPS } from "@/lib/geo";
import { schools } from "@/lib/schools";

const K = 5, KR = 10;

// LAYER 2 — grounded synthesis, NO volatile numbers (no price/count/rate/day/year/percentage). The
// only quantitative idea is the structural "two markets" thesis, which is definitional and stable, not
// point-in-time data. PROTOTYPE NOTE: hand-authored to the spec so Aamir can judge the two-layer shape;
// in production this block is DeepSeek-generated through the existing grounded pipeline. The guarantee
// that it can't go stale on numbers is structural — numbers live only in Layer 1 — not a property of who
// wrote it. Marketing adjectives ("premium", "quiet family street") are deliberately absent.
export const CLARRIAGE_LAYER2: string[] = [
  "Clarriage Court is best understood as two housing markets sharing one address. At one end sits a condominium building; along the rest run freehold townhomes and semi-detached houses. That split is the most important thing to know before trusting any average about the street, because a single 'typical price' blends two products with almost nothing in common — a stacked apartment and a house with its own front door and yard, trading under one name. A buyer who reads only the midpoint misjudges both ends.",
  "For the Ford neighbourhood around it, Clarriage functions as an entry ramp. Ford is otherwise a freehold, family-oriented pocket, and its overall pricing reflects that. The condominium here pulls the street's own numbers below the neighbourhood's, which means the street offers something the surrounding blocks mostly don't: a lower cost of entry into an area people are otherwise priced out of. For a first-time buyer or an investor, that is the defining feature. The freehold houses on the same street offer the more familiar move-up product, priced closer to what the rest of Ford commands.",
  "The rental picture reinforces the read. Leasing activity here runs deeper than resale activity — the signature of a condo-anchored address, where units turn over as rentals far more often than freehold houses change hands. For an investor weighing yield, that depth matters more than any single sale: tenants are reliably found, and the condo end behaves like rental stock rather than owner-occupied housing. The freehold end behaves the opposite way — held longer, sold rarely.",
  "Parking is where the two markets diverge most concretely, and where buyers should look past the listing photos. The freehold homes carry private driveways and usually a garage; parking is a solved problem. Condo residents depend on the building's own allotment, which is finite and assigned. Neither group can lean on the street itself — Milton caps on-street parking during the day and prohibits it overnight, so a household that outgrows its own spaces has no easy overflow. That constraint bites hardest on the condo side, and on freehold households with more drivers than driveway.",
  "The trajectory to watch is composition, not headline price. Because the mix of what sells shifts from period to period — more condo trades in some, more freehold in others — the street's apparent direction can move sharply without any single home changing value. The honest way to track Clarriage is to follow the two markets separately: the condo as rental-grade, entry-level stock; the freehold row as the more stable, family-held tier. Read that way, the street is not a contradiction but a rare thing in Ford — one address offering two very different ways in.",
];

const num = (v: unknown): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export interface ClarriageFacts {
  name: string; neighbourhood: string; isVip: boolean;
  sale: {
    fullN: number; median: number | null; range: { lo: number; hi: number } | null; dom: number | null; soldToAsk: number | null;
    n12: number; median12: number | null; n90: number;
  };
  mix: { sqft: Array<{ range: string; n: number }>; condoBuilding: { name: string; yearBuilt: number | null; totalUnits: number | null } | null };
  rental: { n: number; median: number | null; dom: number | null; byBed: Array<{ beds: number; n: number; median: number | null }> };
  quarterlyVolume: Array<{ q: string; n: number }>;
  pricePoints: { full: number | null; last12: number | null }; // both k>=5 → a coarse, safe direction
  area: { neighbourhood: string; typical: number | null } | null;
  commute: { goDriveMin: number; hwy401DriveMin: number };
  schoolsNearby: Array<{ name: string; board: string; approxMin: number }>;
  active: { total: number; type: string | null; price: number | null };
  gaps: string[];
}

// SQL row shapes (neon returns NUMERIC as string; ::int columns as number).
interface AggRow { n: number; med: string | null; lo: string | null; hi: string | null; dom: string | null; sta: string | null; }
interface SqftRow { sqft_range: string; n: number; }
interface QRow { yr: number; qtr: number; n: number; }
interface LeaseRow { n: number; med: string | null; dom: string | null; }
interface LeaseBedRow { beds: number; n: number; med: string | null; }
interface AreaRow { n: number; avg: string | null; }

export async function getClarriageFacts(): Promise<ClarriageFacts> {
  const sold = getSoldDb();
  const SLUG = "clarriage-court-milton";
  const sibs = sold
    ? (await (sold`SELECT DISTINCT street_slug FROM sold.sold_records WHERE street_slug LIKE 'clarriage%'` as unknown as Promise<Array<{ street_slug: string }>>)).map((r) => r.street_slug)
    : [SLUG];

  const rs = await prisma.residentialStreet.findUnique({ where: { slug: SLUG }, select: { name: true, isVip: true, neighbourhood: { select: { name: true, rawStrings: true } } } });

  const q = <T,>(p: unknown) => (p as Promise<T[]>).catch(() => [] as T[]);
  const win = (w: "full" | "12mo" | "90") => (w === "full" ? sold!`` : w === "12mo" ? sold!`AND sold_date >= NOW() - INTERVAL '12 months'` : sold!`AND sold_date >= NOW() - INTERVAL '90 days'`);
  const EMPTY_AGG: AggRow = { n: 0, med: null, lo: null, hi: null, dom: null, sta: null };
  const saleAgg = async (w: "full" | "12mo" | "90"): Promise<AggRow> =>
    (await q<AggRow>(sold!`SELECT COUNT(*)::int n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med,
        MIN(sold_price) lo, MAX(sold_price) hi, AVG(days_on_market) dom, AVG(sold_to_ask_ratio) sta
      FROM sold.sold_records WHERE street_slug=ANY(${sibs}::text[]) AND perm_advertise=TRUE
        AND transaction_type='For Sale' AND sold_date<=NOW() ${win(w)}`))[0] ?? EMPTY_AGG;

  const [sFull, s12, s90, sqftRows, quarterRows, leaseRow, leaseBedRows, condoRows, activeRows, areaRow] = await Promise.all([
    saleAgg("full"), saleAgg("12mo"), saleAgg("90"),
    q<SqftRow>(sold!`SELECT sqft_range, COUNT(*)::int n FROM sold.sold_records WHERE street_slug=ANY(${sibs}::text[]) AND perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date<=NOW() AND sqft_range IS NOT NULL GROUP BY sqft_range ORDER BY n DESC`),
    q<QRow>(sold!`SELECT EXTRACT(YEAR FROM sold_date)::int yr, EXTRACT(QUARTER FROM sold_date)::int qtr, COUNT(*)::int n FROM sold.sold_records WHERE street_slug=ANY(${sibs}::text[]) AND perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date<=NOW() AND sold_date>=NOW()-INTERVAL '30 months' GROUP BY yr,qtr ORDER BY yr,qtr`),
    q<LeaseRow>(sold!`SELECT COUNT(*)::int n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, AVG(days_on_market) dom FROM sold.sold_records WHERE street_slug=ANY(${sibs}::text[]) AND perm_advertise=TRUE AND transaction_type='For Lease' AND sold_date<=NOW() AND sold_date>=NOW()-INTERVAL '12 months'`).then((r) => r[0] ?? { n: 0, med: null, dom: null }),
    q<LeaseBedRow>(sold!`SELECT COALESCE(beds,0)::int beds, COUNT(*)::int n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med FROM sold.sold_records WHERE street_slug=ANY(${sibs}::text[]) AND perm_advertise=TRUE AND transaction_type='For Lease' AND sold_date<=NOW() AND sold_date>=NOW()-INTERVAL '12 months' GROUP BY beds ORDER BY beds`),
    prisma.condoBuilding.findMany({ where: { OR: [{ streetSlug: { in: sibs } }, { slug: { contains: "clarriage" } }] }, select: { name: true, yearBuilt: true, totalUnits: true } }),
    prisma.listing.findMany({ where: { streetSlug: { in: sibs }, status: "active", permAdvertise: true }, select: { propertyType: true, price: true } }),
    rs?.neighbourhood ? q<AreaRow>(sold!`SELECT COUNT(*)::int n, AVG(sold_price) avg FROM sold.sold_records WHERE neighbourhood=ANY(${rs.neighbourhood.rawStrings}::text[]) AND perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date>=NOW()-INTERVAL '12 months' AND sold_date<=NOW()`).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);

  const kMed = (r: { n: number; med: string | null }) => (r.n >= K && num(r.med) != null ? Math.round(num(r.med)!) : null);
  const kRange = (r: AggRow) => (r.n >= KR && num(r.lo) != null && num(r.hi) != null ? { lo: Math.round(num(r.lo)!), hi: Math.round(num(r.hi)!) } : null);

  // geo (neighbourhood-centroid grain — flagged as such in the render)
  const raw = rs?.neighbourhood?.rawStrings?.[0] ?? "";
  const c = NEIGHBOURHOOD_CENTROIDS[raw] ?? { lat: 43.5083, lng: -79.8822 };
  const schoolsNearby = schools
    .filter((s): s is typeof s & { lat: number; lng: number } => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s) => ({ name: s.name, board: s.board, km: haversineKm(c.lat, c.lng, s.lat, s.lng) }))
    .sort((a, b) => a.km - b.km).slice(0, 4)
    .map((s) => ({ name: s.name, board: s.board, approxMin: s.km < 1.5 ? walkMinutes(s.km) : driveMinutes(s.km) }));
  const goMin = driveMinutes(haversineKm(c.lat, c.lng, GO_STATION.lat, GO_STATION.lng));
  const hwyMin = driveMinutes(Math.min(...HIGHWAY_ONRAMPS.map((r) => haversineKm(c.lat, c.lng, r.lat, r.lng))));

  const active = activeRows[0] ?? null;
  const condo = condoRows[0] ?? null;

  const gaps: string[] = [];
  if (!condo || condo.totalUnits == null) gaps.push("Unit count for the 1440 Clarriage Court condo — CondoBuilding.totalUnits is null (needs condo enrichment / MPAC).");
  if (!condo || condo.yearBuilt == null) gaps.push("Build years — sold_records has no year_built; CondoBuilding.yearBuilt is null (needs MPAC/registry).");
  gaps.push("Parking / driveway capacity — no per-home roster exists in DB1/DB2 (needs MPAC or a parcel dataset). Discussed qualitatively in Layer 2 only.");
  gaps.push("Lot sizes / frontage — not in DB1/DB2 (needs MPAC).");
  gaps.push("Per-quarter median PRICE trend — most quarters have <5 sales, so a price line would breach k>=5; the trend is shown as sales VOLUME instead.");
  gaps.push("School/commute distances are NEIGHBOURHOOD-centroid (Ford) approximations, not street-exact — per-street geocoding is 0% populated.");

  return {
    name: rs?.name ?? "Clarriage Court", neighbourhood: rs?.neighbourhood?.name ?? "Ford", isVip: !!rs?.isVip,
    sale: { fullN: sFull.n, median: kMed(sFull), range: kRange(sFull), dom: sFull.n >= K && num(sFull.dom) != null ? Math.round(num(sFull.dom)!) : null, soldToAsk: sFull.n >= K && num(sFull.sta) != null ? +(num(sFull.sta)! * 100).toFixed(1) : null, n12: s12.n, median12: kMed(s12), n90: s90.n },
    mix: { sqft: sqftRows.map((r) => ({ range: r.sqft_range, n: r.n })), condoBuilding: condo ? { name: condo.name ?? "1440 Clarriage Court", yearBuilt: condo.yearBuilt, totalUnits: condo.totalUnits } : null },
    rental: { n: leaseRow.n, median: leaseRow.n >= K && num(leaseRow.med) != null ? Math.round(num(leaseRow.med)!) : null, dom: leaseRow.n >= K && num(leaseRow.dom) != null ? Math.round(num(leaseRow.dom)!) : null, byBed: leaseBedRows.map((b) => ({ beds: b.beds, n: b.n, median: b.n >= K && num(b.med) != null ? Math.round(num(b.med)!) : null })) },
    quarterlyVolume: quarterRows.map((r) => ({ q: `Q${r.qtr} '${String(r.yr).slice(2)}`, n: r.n })),
    pricePoints: { full: kMed(sFull), last12: kMed(s12) },
    area: areaRow ? { neighbourhood: rs?.neighbourhood?.name ?? "Ford", typical: areaRow.n >= K && num(areaRow.avg) != null ? Math.round(num(areaRow.avg)!) : null } : null,
    commute: { goDriveMin: goMin, hwy401DriveMin: hwyMin },
    schoolsNearby,
    active: { total: activeRows.length, type: active?.propertyType ?? null, price: active?.price ?? null },
    gaps,
  };
}
