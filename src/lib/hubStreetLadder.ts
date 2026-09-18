// src/lib/hubStreetLadder.ts
// The hub's street ladder, carrying THE STREET PAGE'S OWN NUMBERS.
//
// THE RULE THIS IMPLEMENTS: a street's typical price on its hub must be the same figure, over
// the same sample, in the same window, as the one on the street's own page. Not "a typical
// computed the same way" but the same number. Before this, the ladder published a sold count
// and a hardcoded `null` price, so the two surfaces could not disagree only because one of
// them said nothing.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS A BATCH REIMPLEMENTATION AND NOT A LOOP OVER buildStreetEnrichment()
//
// The street page derives its typical through `graduate()` in src/lib/streetEnrichment.ts:
//
//   12-month COUNT(*) >= 5 and a priced row             -> typical = round(12mo median), "12mo"
//   else full-record priced COUNT(*) >= 5                -> typical = round(all-time median), "full"
//   else                                                 -> no typical at all
//
// DEC-TYPICAL-MEDIAN (MC-027): the typical is the K-gated median, here as everywhere. A median
// cannot be pooled from per-slug sums, so each slug's priced rows travel as a sorted array
// (array_agg) and the sibling pooling merges the arrays before taking the midpoint. One row
// per slug still leaves the database; the arrays are the prices the average used to sum.
//
// and it resolves SIBLING SLUGS first, because a street with a directional or abbreviated
// variant is one street: `main-street-east-milton` and `main-st-milton` share an identity and
// their sales are pooled. Reproducing that per street costs three sibling-resolution queries
// plus up to two aggregates; for a 48-street ladder, over 200 round trips for one page.
//
// So the aggregates are taken ONCE, grouped by `street_slug` across the whole table, and the
// sibling pooling is done in memory on the identity key. Two queries per hub request, whatever
// the ladder length. The arithmetic is the same arithmetic: the midpoint of the merged sorted
// price arrays is what PERCENTILE_CONT(0.5) over the pooled rows returns.
//
// THE PARTS THAT MUST NOT DRIFT, and what protects them:
//   · the identity is `deriveIdentity()` itself, the function `resolveSiblingSlugs` keys on.
//     Not a re-derivation: the same call, so a suffix or direction rule cannot drift.
//   · the k floor (5), the graduation order, and the rounding (`roundPriceForProse`) are
//     mirrored from streetEnrichment.ts and street-data.ts. A comment cannot stop that drifting,
//     so the battery asserts the OUTCOME end to end: `hub-page.mjs` reads the typical and the
//     basis the ladder renders and the typical and the basis the street page renders, and
//     fails if they differ. That is the property we care about, and it holds whatever either
//     implementation does.
//
// If you change `graduate()`, this file does not need to match it line for line. It needs to
// keep producing the same answer, and the gate will tell you the moment it stops.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { getSoldDb } from "@/lib/db";
import { roundPriceForProse } from "@/lib/format";
import { deriveIdentity } from "@/lib/streetUtils";

const K_TYPICAL = 5; // the price floor, mirrored from streetEnrichment.ts. Never dropped.

export interface LadderStreet {
  slug: string;
  name: string;
  /** 12-month sale count over the pooled identity. Always published: a count is not a price. */
  soldCount12mo: number;
  /** k-gated typical, rounded exactly as the street page rounds it. null = below the floor. */
  typical: number | null;
  /** the disclosure the figure must always travel with, e.g. "across 7 sales in the last 12 months" */
  basis: string | null;
  isVip: boolean;
  hasVideo: boolean;
}

interface Agg {
  /** rows, the count the street page floors on (COUNT(*)) */
  n: number;
  /** the priced rows themselves, sorted, the sample the median is taken over */
  prices: number[];
}

/** The identity a street page pools over. The same function resolveSiblingSlugs keys on. */
function identityKey(slug: string): string {
  return deriveIdentity(slug)?.identityKey ?? slug;
}

function addTo(map: Map<string, Agg>, key: string, n: number, prices: number[]): void {
  const cur = map.get(key);
  if (cur) {
    cur.n += n;
    cur.prices = cur.prices.concat(prices);
  } else {
    map.set(key, { n, prices: prices.slice() });
  }
}

/** PERCENTILE_CONT(0.5) over a list: the midpoint, interpolated between the two middle values
 *  of an even sample, exactly as Postgres computes it. null on an empty list. */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = values.slice().sort((a, b) => a - b);
  const mid = (v.length - 1) / 2;
  const lo = Math.floor(mid), hi = Math.ceil(mid);
  return lo === hi ? v[lo] : (v[lo] + v[hi]) / 2;
}

interface Row {
  s: string;
  n: number;
  prices: unknown;
}

const toPrices = (x: unknown): number[] =>
  (Array.isArray(x) ? x : []).map((p) => Number(p)).filter((p) => Number.isFinite(p) && p > 0);

/**
 * Pooled sale aggregates for every street in the table, keyed by identity.
 *
 * SUM and COUNT rather than AVG, because averages cannot be combined across sibling slugs
 * without their weights. `n` is COUNT(*), which is what the street page floors on; `np` is
 * COUNT(sold_price), which is what its AVG divides by. Both are kept so a row without a price
 * counts toward the floor and not toward the mean, exactly as it does on the street page.
 */
async function pooledAggregates(): Promise<{ twelve: Map<string, Agg>; full: Map<string, Agg> }> {
  const sd = getSoldDb();
  const twelve = new Map<string, Agg>();
  const full = new Map<string, Agg>();
  if (!sd) return { twelve, full };

  const [rows12, rowsFull] = await Promise.all([
    sd`SELECT street_slug AS s, COUNT(*)::int AS n,
              array_agg(sold_price ORDER BY sold_price) FILTER (WHERE sold_price IS NOT NULL) AS prices
       FROM sold.sold_records
       WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
         AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
         AND street_slug IS NOT NULL
       GROUP BY 1` as unknown as Promise<Row[]>,
    // The "full" window is the whole record, matching fullWindowAgg: no lower bound, and
    // priced rows only. That filter is the street page's, mirrored here.
    sd`SELECT street_slug AS s, COUNT(*)::int AS n,
              array_agg(sold_price ORDER BY sold_price) AS prices
       FROM sold.sold_records
       WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
         AND sold_date <= NOW() AND sold_price IS NOT NULL
         AND street_slug IS NOT NULL
       GROUP BY 1` as unknown as Promise<Row[]>,
  ]);

  for (const r of rows12) addTo(twelve, identityKey(r.s), Number(r.n), toPrices(r.prices));
  for (const r of rowsFull) addTo(full, identityKey(r.s), Number(r.n), toPrices(r.prices));
  return { twelve, full };
}

/** The disclosure every published price travels with. Mirrors windowDisclosure(). */
function disclose(count: number, window: "12mo" | "full"): string {
  const noun = count === 1 ? "sale" : "sales";
  return window === "12mo"
    ? `across ${count} ${noun} in the last 12 months`
    : `across ${count} ${noun} in the last ~2 years`;
}

/**
 * Decorate a hub's streets with the street page's own typical.
 *
 * The caller supplies the streets. This module never decides which streets a hub shows, only
 * what each one's figures are.
 */
export async function buildLadder(
  streets: Array<{ slug: string; name: string; soldCount12mo: number; isVip: boolean }>,
  videoSlugs: Set<string>,
): Promise<LadderStreet[]> {
  const { twelve, full } = await pooledAggregates();

  return streets.map((s) => {
    const key = identityKey(s.slug);
    const a12 = twelve.get(key);
    const aFull = full.get(key);

    let typical: number | null = null;
    let basis: string | null = null;

    const m12 = a12 && a12.n >= K_TYPICAL ? medianOf(a12.prices) : null;
    const mFull = aFull && aFull.n >= K_TYPICAL ? medianOf(aFull.prices) : null;
    if (m12 !== null) {
      typical = roundPriceForProse(Math.round(m12));
      basis = disclose(a12!.n, "12mo");
    } else if (mFull !== null) {
      typical = roundPriceForProse(Math.round(mFull));
      basis = disclose(aFull!.n, "full");
    }

    return {
      slug: s.slug,
      name: s.name,
      // The pooled 12-month count, the same COUNT(*) the street page's "sales" figure reads,
      // so the number beside the price is the sample behind it. Zero when the record has none.
      soldCount12mo: a12?.n ?? 0,
      typical,
      basis,
      isVip: s.isVip,
      hasVideo: videoSlugs.has(s.slug),
    };
  });
}
