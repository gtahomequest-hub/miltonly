// Street page data shaper. Composes a StreetPageData payload from the three
// databases by parallel-fetching everything available and filling in the rest
// from deterministic helpers (geo POIs, schools roster, listing centroid).
//
// K-anonymity is enforced here so the page never has to think about it:
//   - Typical price / price-range at the street level require k >= 5
//   - Aggregate MIN/MAX ranges require k >= 10 (matches VowGate's rule)
//   - Per-product-type typical price requires k >= 5 (else the pill still
//     renders a count but no price, and the TypeSection hides its chart
//     and surfaces a `showContactTeamPrompt`).
//
// No AI prompt touches sold records here — the only sold-data flow is:
//   DB2 aggregates (via DB3 pre-compute) → UI. Records remain in sold-data.ts
//   and are only fetched from the page when canSeeRecords is true.

import "server-only";
import type { Listing } from "@prisma/client";
import { prisma } from "./prisma";
// NAMING MOVED OUT (DEC-NAME-SOURCE Build 1). expandStreetName / shortNameFor / displayStreetName
// used to live in this file, behind its `import "server-only"` — which is why
// scripts/build-street-adjacency.ts had to grow a private copy that then drifted. They are now in
// the pure @/lib/streetName beside resolveStreetName, and re-exported here so every existing
// importer of street-data keeps working unchanged.
import { resolveStreetName, expandStreetName, shortNameFor, displayStreetName } from "@/lib/streetName";
export { expandStreetName, shortNameFor, displayStreetName, resolveStreetName };
import { config } from "./config";
import { getAnalyticsDb, getSoldDb } from "./db";
import { buildStreetEnrichment, windowDisclosure, type StreetEnrichment } from "./streetEnrichment";
import { stripNumericSentences } from "./prose/numericSentences";
import { firstSentence } from "./prose/sentences";
import { haversineKm, hasValidCoords, driveMinutes, walkMinutes, MOSQUES, GROCERIES } from "./geo";
import { streetCentroidFor } from "./town/roadFacts";
import { schools } from "./schools";
import { extractStreetName, ruralSideRoadName, deriveIdentity } from "./streetUtils";
import { resolveStreetVideo } from "./streetVideo";
import { cleanNeighbourhoodName, roundPriceForProse, roundRentForProse } from "./format";
import { formatCAD, formatCADShort } from "./charts/theme";
import type {
  StreetPageData,
  StreetHeroProps,
  HeroStat,
  ProductPillRow,
  ProductPillData,
  DescriptionBodyProps,
  DescriptionSidebarProps,
  TypeSectionProps,
  GlanceTile,
  MarketActivityProps,
  CommuteGridProps,
  CommuteCategory,
  ActiveInventoryProps,
  ContextCardsProps,
  FAQItem,
  FinalCTAsProps,
  CornerWidgetProps,
  SectionInsight,
  StatCell,
  ProductTypeKey,
  NearbyPlace,
  QuarterlyDataPoint,
} from "@/types/street";

import { K_ANON_PRICE, K_ANON_RANGE } from "@/lib/kAnon";
const SITE_URL = config.SITE_URL;
const CITY_PROVINCE_LABEL = `${config.CITY_NAME} ${config.CITY_PROVINCE}`;

/* ─────────────────────────────────────────────────────────────────────
   TYPE PEEKS — raw DB3 row shapes (loose; SQL is ad-hoc).
   ───────────────────────────────────────────────────────────────────── */

interface RawSoldStats {
  avg_sold_price: string | null;
  median_sold_price: string | null;
  avg_list_price: string | null;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
  sold_count_90days: number;
  sold_count_12months: number;
  price_change_yoy: string | null;
  peak_month: number | null;
  market_temperature: string | null;
  avg_leased_price: string | null;
  avg_leased_price_1bed: string | null;
  avg_leased_price_2bed: string | null;
  avg_leased_price_3bed: string | null;
  avg_leased_price_4bed: string | null;
  leased_count_90days: number;
  leased_count_12months: number;
  avg_lease_dom: string | null;
}

export interface RawMonthly {
  year: number;
  month: number;
  avg_sold_price: string | null;
  sold_count: number;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
}

interface RawTypeAgg {
  property_type: string;
  n: number;
  avg_price: string | null;
  min_price: string | null;
  max_price: string | null;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
}

/* ONE SAMPLE, ONE ROW. Every street figure below — typical, band, DOM, sold-to-ask —
 * comes out of a single 12-month sibling-union query, so `n` is literally the count of
 * the rows each average was taken over. That is the invariant the page had been missing:
 * it was floor-checking DB3's `sold_count_12months` while publishing DB3's `avg_*`
 * columns, which computeStreetSaleStats builds over a NINETY-day CTE and stores per
 * single slug. Different window, different population, same tile. */
interface RawSale12mo {
  n: number;
  avg: string | null;
  lo: string | null;
  hi: string | null;
  dom: string | null;
  sta: string | null;
}
interface RawLease12mo {
  n: number;
  avg: string | null;
  dom: string | null;
}
interface RawLeaseBedAgg {
  bed: number;
  n: number;
  avg: string | null;
}

/* ─────────────────────────────────────────────────────────────────────
   SIBLING RESOLUTION (Step 13m-1)
   ───────────────────────────────────────────────────────────────────── */

/**
 * Given a slug, return all sibling slugs that share its identity (same base
 * token + same direction, ignoring suffix-token abbreviation variance).
 * Union is computed against DB2 sold_records + DB3 street_sold_stats +
 * DB1 Listing so no physical-street data source is missed. The returned
 * list always includes the input slug itself, even if no siblings exist.
 */
export async function resolveSiblingSlugs(slug: string): Promise<string[]> {
  const identity = deriveIdentity(slug);
  if (!identity) return [slug];
  // Narrow candidate pool via base-prefix LIKE queries on each data source.
  // Cheap (uses idx_sold_street_slug + streetSlug indexes) and bounded.
  const likePattern = `${identity.base}-%-${config.SLUG_SUFFIX}`;
  const sd = getSoldDb();
  const ad = getAnalyticsDb();
  const [soldSlugRows, statsSlugRows, listingSlugRows] = await Promise.all([
    sd
      ? (sd`SELECT DISTINCT street_slug AS s FROM sold.sold_records WHERE street_slug LIKE ${likePattern}` as unknown as Promise<Array<{ s: string }>>).catch(() => [] as Array<{ s: string }>)
      : Promise.resolve([] as Array<{ s: string }>),
    ad
      ? (ad`SELECT DISTINCT street_slug AS s FROM analytics.street_sold_stats WHERE street_slug LIKE ${likePattern}` as unknown as Promise<Array<{ s: string }>>).catch(() => [] as Array<{ s: string }>)
      : Promise.resolve([] as Array<{ s: string }>),
    prisma.listing.findMany({
      where: { streetSlug: { startsWith: `${identity.base}-`, endsWith: `-${config.SLUG_SUFFIX}` } },
      distinct: ["streetSlug"],
      select: { streetSlug: true },
    }),
  ]);
  const pool = new Set<string>([slug]);
  for (const r of soldSlugRows) pool.add(r.s);
  for (const r of statsSlugRows) pool.add(r.s);
  for (const r of listingSlugRows) if (r.streetSlug) pool.add(r.streetSlug);

  const siblings: string[] = [];
  for (const s of Array.from(pool)) {
    const id = deriveIdentity(s);
    if (id && id.identityKey === identity.identityKey) siblings.push(s);
  }
  // Always keep the input slug present even if its identity resolution fails
  // on its own (defensive; should not happen in practice).
  if (!siblings.includes(slug)) siblings.push(slug);
  return siblings.sort();
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN EXPORT
   ───────────────────────────────────────────────────────────────────── */

export async function getStreetPageData(slug: string): Promise<StreetPageData | null> {
  // Step 13m-1 — resolve sibling slugs that map to the same identity. The
  // slug-as-key model routed data under whichever slug MLS ingest produced
  // (usually the abbreviated form) while the render layer queried the
  // canonical slug (usually the full-word form) — 277 inversions across
  // the universe. Unioning across siblings restores data fidelity.
  const siblingSlugs = await resolveSiblingSlugs(slug);
  const sd = getSoldDb();
  const ad = getAnalyticsDb();

  const [
    allListings,
    soldStatsRows,
    monthlyRows,
    streetContent,
    soldTypeAggRows,
    sale12moRows,
    lease12moRows,
    leaseBedRows,
    soldCoordsRows,
    soldExistsRows,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: { streetSlug: { in: siblingSlugs }, permAdvertise: true },
      orderBy: { listedAt: "desc" },
    }),
    // DB3 street_sold_stats is pre-computed per slug. In practice only one
    // sibling carries the row; pick the one with the highest sold_count_12months
    // if multiple return (belt + suspenders against future DB3 drift).
    ad
      ? (ad`SELECT * FROM analytics.street_sold_stats WHERE street_slug = ANY(${siblingSlugs}::text[]) ORDER BY sold_count_12months DESC NULLS LAST LIMIT 1` as unknown as Promise<RawSoldStats[]>).catch(() => [] as RawSoldStats[])
      : Promise.resolve([] as RawSoldStats[]),
    ad
      ? (ad`
          SELECT year, month, avg_sold_price, sold_count, avg_dom, avg_sold_to_ask
          FROM analytics.street_monthly_stats
          WHERE street_slug = ANY(${siblingSlugs}::text[])
          ORDER BY year, month
        ` as unknown as Promise<RawMonthly[]>).catch(() => [] as RawMonthly[])
      : Promise.resolve([] as RawMonthly[]),
    // StreetContent is keyed by slug too — prefer the sibling with non-empty
    // description if any. First non-null row wins.
    prisma.streetContent.findFirst({ where: { streetSlug: { in: siblingSlugs } } }),
    sd
      ? (sd`
          SELECT property_type,
                 COUNT(*)::int AS n,
                 AVG(sold_price) AS avg_price,
                 MIN(sold_price) AS min_price,
                 MAX(sold_price) AS max_price,
                 AVG(days_on_market) AS avg_dom,
                 AVG(sold_to_ask_ratio) AS avg_sold_to_ask
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND transaction_type = 'For Sale'
            AND sold_date >= NOW() - INTERVAL '12 months'
            AND sold_date <= NOW()
          GROUP BY property_type
        ` as unknown as Promise<RawTypeAgg[]>).catch(() => [] as RawTypeAgg[])
      : Promise.resolve([] as RawTypeAgg[]),
    // THE street sale sample. n, avg, band, DOM and sold-to-ask all come from these
    // rows and nothing else, so any floor checked against n is checked against the
    // exact sample the figure was computed over.
    sd
      ? (sd`
          SELECT COUNT(*)::int AS n,
                 AVG(sold_price) AS avg,
                 MIN(sold_price) AS lo,
                 MAX(sold_price) AS hi,
                 AVG(days_on_market) AS dom,
                 AVG(sold_to_ask_ratio) AS sta
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND transaction_type = 'For Sale'
            AND sold_date >= NOW() - INTERVAL '12 months'
            AND sold_date <= NOW()
        ` as unknown as Promise<RawSale12mo[]>).catch(() => [] as RawSale12mo[])
      : Promise.resolve([] as RawSale12mo[]),
    // Same treatment for the lease side — the market card used to read DB3's
    // avg_leased_price, which is also a 90-day average, under a 12-month count.
    sd
      ? (sd`
          SELECT COUNT(*)::int AS n,
                 AVG(sold_price) AS avg,
                 AVG(days_on_market) AS dom
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND transaction_type = 'For Lease'
            AND sold_date >= NOW() - INTERVAL '12 months'
            AND sold_date <= NOW()
        ` as unknown as Promise<RawLease12mo[]>).catch(() => [] as RawLease12mo[])
      : Promise.resolve([] as RawLease12mo[]),
    // Per-bed rents carry their OWN counts. A bed bucket is a subset of the lease
    // pool, so the pool's count can never license it.
    sd
      ? (sd`
          SELECT LEAST(beds, 4)::int AS bed,
                 COUNT(*)::int AS n,
                 AVG(sold_price) AS avg
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND transaction_type = 'For Lease'
            AND beds IS NOT NULL AND beds >= 1
            AND sold_date >= NOW() - INTERVAL '12 months'
            AND sold_date <= NOW()
          GROUP BY 1
        ` as unknown as Promise<RawLeaseBedAgg[]>).catch(() => [] as RawLeaseBedAgg[])
      : Promise.resolve([] as RawLeaseBedAgg[]),
    // Centroid fallback: if DB1 has no current listings (expired/sold-only streets),
    // sample any stored lat/lng from DB2 sold records so nearbyPlaces + schema Place
    // still surface geography-aware content.
    sd
      ? (sd`
          SELECT lat, lng FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND lat IS NOT NULL AND lng IS NOT NULL
          LIMIT 1
        ` as unknown as Promise<Array<{ lat: string | null; lng: string | null }>>).catch(() => [] as Array<{ lat: string | null; lng: string | null }>)
      : Promise.resolve([] as Array<{ lat: string | null; lng: string | null }>),
    // Existence-gate probe: any DB2 sold record for this street (or sibling),
    // regardless of perm_advertise / transaction_type / date window.
    sd
      ? (sd`
          SELECT 1 AS one FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
          LIMIT 1
        ` as unknown as Promise<Array<{ one: number }>>).catch(() => [] as Array<{ one: number }>)
      : Promise.resolve([] as Array<{ one: number }>),
  ]);

  // Existence gate — a street page renders only from a PRIMARY signal: current DB1
  // listings, a DB1 StreetContent row, or a DB2 historical sold record. DB3
  // analytics.street_sold_stats is DERIVED (computed from DB2 sold) and must NEVER
  // be the sole basis for a page — a stale/orphaned DB3 row (no entity, no sold, no
  // content) otherwise rendered a phantom 200 placeholder that could be crawled.
  // (Registry cleanup 2026-07: this closes the phantom-200 path; soldStatsRows is
  // still used below to POPULATE stats on pages that legitimately exist.)
  if (
    allListings.length === 0 &&
    !streetContent &&
    soldExistsRows.length === 0
  ) {
    return null;
  }

  // ─── Street identity ──────────────────────────────────────────────
  //
  // Two forms of the name:
  //   `streetName`  — DISPLAY form: "Ruddy Crescent", "Main Street East".
  //                   Used in H1, metadata title, schema Place.name, breadcrumbs.
  //   `shortName`   — PROSE form: "Ruddy", "Main St E".
  //                   Used in in-flow references: "For Ruddy owners", "homes on Ruddy".
  //
  // Both derive from the same raw source — stored name if present, else
  // extracted from the sample address, else slug. Apply `expandStreetName`
  // only to the display form; the short form keeps abbreviations by design
  // (they're shorter and read more naturally in prose).
  const sample = allListings[0];
  // Step 13h — Ontario rural-address exception. For numeric-prefixed slugs
  // like `3-side-rd-milton` where the number IS the street name (not a house
  // number), preserve the leading number. Falls back to the normal chain
  // for conventional street names.
  const rawName =
    ruralSideRoadName(slug) ??
    streetContent?.streetName ??
    sample?.streetName ??
    extractStreetName(sample?.address ?? deslugify(slug));
  // Expand first, then derive short name from the expanded form — so the
  // suffix-strip step in shortNameFor sees canonical tokens ("Court", "Crescent")
  // that match its STREET_SUFFIXES set, rather than raw abbreviations like "Crt"
  // that would slip through and land literally in the model's shortName input.
  // THE REGISTRY DECIDES (DEC-NAME-SOURCE Build 1). rawName above is now only the FALLBACK — it is
  // used when the Town registry has no row for this slug. ruralSideRoadName still leads that
  // fallback chain, which numbered side roads depend on; the registry carries no numbered side road.
  const resolvedName = resolveStreetName(slug, rawName);
  const streetName = resolvedName.name;
  const shortName = resolvedName.shortName;
  const neighbourhoods = dedupe(
    allListings
      .map((l) => cleanNeighbourhoodName(l.neighbourhood))
      .filter((n) => n.length > 0)
  );
  // THE STREET'S OWN POSITION, in preference order. The Town's centreline first: it describes
  // the whole street rather than wherever a few homes happen to have traded, and it exists for
  // 424 of the 426 published streets. The listing/sold means stay as fallbacks — they are what
  // a street outside the Town's centreline coverage still has.
  //
  // Additive, per the rule this whole layer is governed by: a street the Town has no geometry
  // for gets null here and behaves exactly as it did before.
  let centroid = streetCentroidFor(slug);
  if (!centroid) centroid = computeCentroid(allListings);
  if (!centroid) {
    const c = soldCoordsRows[0];
    const lat = c?.lat !== null && c?.lat !== undefined ? parseFloat(c.lat) : null;
    const lng = c?.lng !== null && c?.lng !== undefined ? parseFloat(c.lng) : null;
    if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
      centroid = { lat, lng };
    }
  }

  const stats = soldStatsRows[0] ?? null;
  const sale12 = sale12moRows[0] ?? null;
  const lease12 = lease12moRows[0] ?? null;
  const soldRange = sale12 ? { n: sale12.n, lo: sale12.lo, hi: sale12.hi } : null;

  // ─── DEC-CONDO-6 enrichment (area-context + graduated sale/lease + tier) ───
  // Prefer the 12mo figure; fall back to the full ~26mo window ONLY where 12mo is
  // sub-k5. Full-window queries fire lazily inside.
  //
  // COUNT AND AVERAGE NOW COME FROM THE SAME ROWS. They used to be paired across
  // sources — DB3's 12-month count with DB3's 90-day average — so a "12-month
  // typical" on a street with five sales in the year but one in the quarter was
  // that one sale's price. The pairing was the defect, not the floor.
  const enrichment = await buildStreetEnrichment({
    slug,
    siblingSlugs,
    sale12moCount: sale12?.n ?? 0,
    sale12moAvg: num(sale12?.avg ?? null),
    lease12moCount: lease12?.n ?? 0,
    lease12moAvg: num(lease12?.avg ?? null),
  });

  // ─── Hero + product pills ─────────────────────────────────────────
  const heroProps = buildHero({
    streetName,
    neighbourhoods,
    stats,
    soldRange,
    allListings,
    streetContent,
    typeAggs: soldTypeAggRows,
    enrichment,
    sale12,
  });

  // ─── Product type sections ────────────────────────────────────────
  const productTypes = buildProductTypeSections({
    streetName,
    shortName,
    stats,
    monthlyRows,
    typeAggs: soldTypeAggRows,
    activeListings: allListings.filter((l) => l.status === "active"),
  });

  // ─── Description body + sidebar ───────────────────────────────────
  const descriptionBody = buildDescriptionBody(streetContent, streetName);
  const descriptionSidebar = buildSidebar({ shortName, streetName, sale12, centroid, neighbourhoods, enrichment });

  // ─── At a glance (12 tiles) ───────────────────────────────────────
  const glanceTiles = buildGlanceTiles({
    stats,
    sale12,
    lease12,
    allListings,
    typeAggs: soldTypeAggRows,
    enrichment,
  });

  // ─── Market Activity ─────────
  const marketActivity = buildMarketActivity({
    slug,
    streetName,
    stats,
    sale12,
    lease12,
    leaseBeds: leaseBedRows,
    monthlyRows,
    enrichment,
  });

  // ─── Commute + nearby ─────────────────────────────────────────────
  const commuteGrid = buildCommuteGrid(centroid);

  // ─── Active inventory ─────────────────────────────────────────────
  const activeInventory = buildActiveInventory({
    listings: allListings.filter((l) => l.status === "active"),
    streetName,
    shortName,
  });

  // ─── Context cards ────────────────────────────────────────────────
  const contextCards = await buildContextCards({
    slug,
    neighbourhoods,
    centroid,
  });

  // ─── FAQs ──────────────────────────────────────────────────────────
  const faqs = parseFaqs(streetContent?.faqJson, { streetName, shortName, sale12, enrichment });

  // ─── Final CTAs + corner widget ───────────────────────────────────
  const finalCTAs = buildFinalCTAs({ streetName, shortName });
  const cornerWidget = buildCornerWidget({
    streetName,
    shortName,
    heroProps,
    productTypes,
  });

  return {
    street: {
      id: slug,
      name: streetName,
      slug,
      shortName,
      neighbourhoods,
      // THE SUPPRESSED SUMMARY, NOT THE RAW ONE.
      // This used to be characterSummaryFrom(streetContent?.description) — the stored LLM sentence
      // with no guards at all — while the visible hero ran it through stripNumericSentences plus the
      // ASSERTS_NO_SALES gate a few hundred lines below. 98 of 431 published streets therefore sent
      // Google a sentence the page itself refuses to print: 28 opening with an absence claim ("No
      // home resales are recorded on ...") and 16 contradicting themselves inside one snippet
      // (a published price followed by a denial that any sale exists).
      //
      // It was TWO paths to the index, not one. page.tsx:94 builds the meta description from this
      // field, and street-schema.ts:120 publishes it as the Place JSON-LD description — so the
      // structured data carried the unsuppressed claim as well. A comment in page.tsx asserted
      // "one suppression pass, no second path to the index"; that was not true of either.
      //
      // Empty string (not the neutral placeholder) when nothing survives the guards, so each
      // consumer falls through to its own fallback: the schema to its richer "A residential street
      // in <neighbourhoods>" line, the meta description to appending nothing. The visible hero is
      // unaffected — it reads heroProps.subtitle, which still defaults to the neutral sentence.
      characterSummary: heroProps.suppressedSummary,
      coordinates: centroid ?? { lat: 43.5083, lng: -79.8822 },
    },
    heroProps,
    descriptionSidebar,
    descriptionBody,
    productTypes,
    glanceTiles,
    marketActivity,
    commuteGrid,
    activeInventory,
    contextCards,
    faqs,
    finalCTAs,
    cornerWidget,
    enrichment,
    // Street-video PoC — resolved from StreetContent's four video columns (null on every
    // street without a clip, which renders nothing).
    video: streetContent
      ? resolveStreetVideo({
          streetName,
          videoUrl: streetContent.videoUrl,
          videoCapturedAt: streetContent.videoCapturedAt,
          nightVideoUrl: streetContent.nightVideoUrl,
          nightCapturedAt: streetContent.nightCapturedAt,
        })
      : null,
    lastUpdated: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   SMALL HELPERS
   ───────────────────────────────────────────────────────────────────── */

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function dedupe<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }

function deslugify(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  // Strip trailing slug suffix baked into many slugs.
  if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === config.SLUG_SUFFIX) {
    parts.pop();
  }
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}


function computeCentroid(listings: Listing[]): { lat: number; lng: number } | null {
  const valid = listings.filter((l) => hasValidCoords(l.latitude, l.longitude));
  if (valid.length === 0) return null;
  const lat = valid.reduce((s, l) => s + l.latitude, 0) / valid.length;
  const lng = valid.reduce((s, l) => s + l.longitude, 0) / valid.length;
  return { lat, lng };
}

function characterSummaryFrom(description: string | null | undefined): string {
  if (!description) return "";
  // Was description.split(/[.!?](?=\s|$)/)[0] — its own naive splitter, which cut three hero
  // subtitles mid-name at "Louis St. Laurent Avenue". Shared splitter now; it keeps the
  // terminator, so nothing is re-appended.
  const first = firstSentence(description);
  return first.length > 30 ? first : "";
}

function parseFaqs(
  faqJson: string | null | undefined,
  ctx: { streetName: string; shortName: string; sale12: RawSale12mo | null; enrichment: StreetEnrichment }
): FAQItem[] {
  if (faqJson) {
    try {
      const parsed = JSON.parse(faqJson) as Array<{ q: string; a: string }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((f) => ({ question: f.q, answer: f.a }));
      }
    } catch { /* fall through */ }
  }
  // Fallback template — grounded in aggregate stats only, and only where the aggregate
  // clears its own floor. This used to read DB3's avg_sold_price and avg_dom with NO
  // k check at all, phrased as "the recent period" over a 90-day figure. It is not
  // rendered today (generated FAQs win on every published page) but it is a caller of
  // the same bad read, so it moves onto the same sample as everything else.
  const { streetName, sale12, enrichment } = ctx;
  const basis = enrichment.saleBasis;
  const n = sale12?.n ?? 0;
  const dom = num(sale12?.dom ?? null);
  // DEC-ZERO-PRICE-FAQ. The price question is withdrawn when there is no basis to answer it
  // from. Its no-basis branch asked "What is the typical price on X?" and answered with a
  // referral - a question posed only to decline it, which is the same defect the generated
  // bank was cleaned of. A question with no answer is dropped, not answered evasively.
  return [
    ...(basis
      ? [{
          question: `What is the typical price on ${streetName}?`,
          answer: `Typical sold price on ${streetName} was ${formatCADShort(roundPriceForProse(basis.typical))} ${windowDisclosure(basis)}. Range varies by product type. See the deep-link sections above for detached, townhouse, and condo breakdowns.`,
        }]
      : []),
    {
      question: `How fast do homes sell on ${streetName}?`,
      answer: dom !== null && n >= K_ANON_PRICE
        ? `Typical days on market is around ${Math.round(dom)} days, across ${n} ${n === 1 ? "sale" : "sales"} in the last 12 months.`
        : `Days on market varies by product type and season.`,
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────────
   HERO
   ───────────────────────────────────────────────────────────────────── */

interface HeroBuildInput {
  streetName: string;
  neighbourhoods: string[];
  stats: RawSoldStats | null;
  soldRange: { n: number; lo: string | null; hi: string | null } | null;
  allListings: Listing[];
  streetContent: { description: string } | null;
  typeAggs: RawTypeAgg[];
  enrichment: StreetEnrichment;
  /** for the subtitle's figure guards — the same rows the glance tiles are built from */
  sale12: RawSale12mo | null;
}

/** The sold-to-ask percentage this page PUBLISHES, or null when the tile is suppressed.
 *  ONE implementation: the glance tile renders exactly this, and the prose guard that forbids a
 *  stored sentence from characterising the metric the other way is gated on exactly this. A second
 *  copy of the k-anon condition would be free to drift away from the tile it is meant to track. */
function publishedSoldToAskPct(sale12: RawSale12mo | null): number | null {
  const ratio = num(sale12?.sta ?? null);
  const n = sale12?.n ?? 0;
  return ratio !== null && n >= K_ANON_PRICE ? Math.round(ratio * 100) : null;
}

/** Any phrasing that asserts nothing has ever traded on the street. Kept beside the one gate in
 *  resaleClaim.ts — this is the detector for prose we did not author (stored generation output),
 *  not a second source of copy. */
const ASSERTS_NO_SALES =
  /no (home )?resales? (are |have been )?recorded|no recent turnover|yet to (trade|sell|change hands)|no homes have (sold|traded)|never (sold|traded)|until a home[^.]*trades|nothing has (traded|sold)/i;

function buildHero(input: HeroBuildInput): StreetHeroProps {
  const { streetName, neighbourhoods, stats, soldRange, allListings, streetContent, typeAggs, enrichment, sale12 } = input;
  const cleanNbhds = neighbourhoods.map(cleanNeighbourhoodName).filter(Boolean);
  const eyebrow = `Street Profile · ${cleanNbhds.slice(0, 3).join(" · ") || config.CITY_NAME} · ${config.CITY_NAME}, ${config.CITY_PROVINCE_CODE}`;
  // The hero subtitle is STORED LLM prose (StreetContent.description), so it sits outside the
  // resaleClaim gate — and on 2 published streets it asserted "No home resales are recorded on X"
  // while the same page's CTA correctly said "too few recent sales" (Nakerville sold 2026-07-30).
  // Structural safety net: a stored sentence may not assert absence on a street that has sales.
  // This suppresses a false claim; it never invents one. The stored copy still wants regenerating.
  // The hero summary is stored generation output: strip numeric sentences first (compliance
  // suppression), then the existing absence guard, then fall back to the neutral line.
  // The same figure-denial gate the sections and FAQ get. No subtitle in the corpus currently
  // trips it — I sampled 40 priced pages and found none — but the subtitle is stored generation
  // output from the same run, so it gets the same guard rather than an exemption that would have
  // to be noticed later.
  const subtitleOpts = {
    pricePublished: enrichment.saleBasis != null,
    bandPublished: !!(soldRange && soldRange.n >= K_ANON_RANGE),
    soldOverAskPublished: (publishedSoldToAskPct(sale12) ?? 0) > 100,
  };
  const rawSummary = streetContent?.description
    ? stripNumericSentences(characterSummaryFrom(streetContent.description), subtitleOpts)
    : null;
  const summaryClaimsAbsence = rawSummary != null && ASSERTS_NO_SALES.test(rawSummary);
  // The suppressed sentence, or "" when it did not survive the guards. Kept SEPARATE from the
  // neutral fallback below so downstream surfaces can tell "we have nothing to say about this
  // street" apart from "here is a sentence", and fall through to their own fallback instead of
  // publishing the placeholder. street.characterSummary is set from THIS value.
  const suppressedSummary =
    rawSummary && !(summaryClaimsAbsence && enrichment.hasAnySale) ? rawSummary : "";
  const subtitle = suppressedSummary || `A street in ${CITY_PROVINCE_LABEL}.`;

  // Build stat tiles
  const heroStats: HeroStat[] = [];
  const mix = housingMix(typeAggs, allListings);
  heroStats.push({
    label: "Housing mix",
    value: mix.primary,
    sub: mix.description || undefined,
  });

  const countFor12mo = stats?.sold_count_12months ?? 0;
  // GRADUATED sale price: the 12-month average where it clears k>=5, else the ~26mo
  // fallback. The value is ALWAYS saleBasis.typical, which is computed over exactly the
  // sample saleBasis.count reports and windowDisclosure() names.
  //
  // It used to be `is12 && typical ? typical : saleBasis.typical` — on the 12-month path
  // it substituted DB3's avg_sold_price, a NINETY-day average, under a 12-month basis
  // line. That was deliberate, to keep already-rich pages byte-identical through the
  // tier port. Byte-identical is a regression test; it is not a correctness test, and
  // here it carried a k-anon breach forward: on 50 pages the published "typical" was
  // computed over fewer than five sales, on 16 of them over exactly one.
  const saleBasis = enrichment.saleBasis;
  if (saleBasis) {
    const is12 = saleBasis.window === "12mo";
    const priceVal = saleBasis.typical;
    const lo = num(soldRange?.lo ?? null);
    const hi = num(soldRange?.hi ?? null);
    const showRange = is12 && soldRange && soldRange.n >= K_ANON_RANGE && lo !== null && hi !== null;
    heroStats.push({
      label: "Typical price",
      value: formatCAD(roundPriceForProse(priceVal)),
      sub: showRange ? `range ${formatCADShort(roundPriceForProse(lo!))} to ${formatCADShort(roundPriceForProse(hi!))}` : undefined,
      basis: windowDisclosure(saleBasis),
    });
  } else {
    heroStats.push({
      label: "Typical price",
      value: "—",
      sub: "sample too small to publish",
    });
  }

  // Total transactions = closed sales + closed leases. Matches Whitlock's
  // 244 count (21 sales + 223 leases). Does NOT include active listings.
  const leasedFor12mo = stats?.leased_count_12months ?? 0;
  const totalTransactions = countFor12mo + leasedFor12mo;
  heroStats.push({
    label: "Transactions tracked",
    value: String(totalTransactions),
    // EVERY count states its window and its subject. This tile is sales + leases over 12 months;
    // the pill row beside it counts SALES ONLY over the same window, which is why the two numbers
    // differ. Unlabelled, they read as a contradiction.
    sub: totalTransactions > 0 ? "sales + leases · last 12 months" : "no closed deals · last 12 months",
  });

  heroStats.push({
    label: "Active right now",
    value: String(allListings.filter((l) => l.status === "active").length),
    sub: "live listings · today",
  });

  // Product pills — below k=5 sample size, suppress typicalPrice (null) and
  // show a "sample too small" label; pill remains clickable so users can
  // still jump to the deep-link section for context.
  const soldPills: ProductPillData[] = [];
  const pillOrder: ProductTypeKey[] = ["detached", "semi", "townhouse", "condo"];
  for (const type of pillOrder) {
    const agg = typeAggs.find((t) => t.property_type === type);
    if (!agg || agg.n < 1) continue;
    const typicalPrice = num(agg.avg_price);
    const publishable = agg.n >= K_ANON_PRICE && typicalPrice !== null;
    soldPills.push({
      type,
      displayName: displayNameFor(type),
      count: agg.n,
      // ROUNDED HERE, not at the surface. The pill handed the v2 shell a RAW mean while the type
      // card beside it rendered roundPriceForProse of the same number — one metric, two values,
      // on 46 pages ($884K pill vs $875K card). Round once, at the point of publication, and
      // every surface that formats it lands on the same string.
      typicalPrice: publishable ? roundPriceForProse(typicalPrice!) : null,
      priceLabel: publishable ? "typical" : "sample too small",
      anchor: `#type-${type}`,
    });
  }

  // Lease pill — GRADUATED (12mo preferred, ~26mo fallback) so lease-deep-but-sale-thin
  // streets light up (the ~38). One rent pill, k>=5 gated inside leaseBasis.
  const leasePills: ProductPillData[] = [];
  const leaseBasis = enrichment.leaseBasis;
  if (leaseBasis) {
    leasePills.push({
      type: "condo",
      displayName: "Lease",
      count: leaseBasis.count,
      typicalPrice: roundRentForProse(leaseBasis.typical),
      priceLabel: "typical / mo",
      anchor: "#type-condo",
    });
  }

  // Labels stay EXACT ("Recent sales" / "Recent leases") — mapStreetV2Data keys the v2
  // pill rows off them, and the window disclosure is rendered in the v2 hero (a "· last
  // 12 months" span on sales + hero.leaseWindowNote on leases), not baked into the label.
  const productTypePills: ProductPillRow[] = [];
  if (soldPills.length > 0) {
    productTypePills.push({ label: "Recent sales", dotColor: "navy", pills: soldPills });
  }
  if (leasePills.length > 0 && leaseBasis) {
    productTypePills.push({ label: "Recent leases", dotColor: "blue", pills: leasePills });
  }

  return {
    eyebrow,
    streetName,
    subtitle,
    suppressedSummary,
    heroStats,
    productTypePills,
    // The value the v2 shell renders — ROUNDED, like every other surface. It was going out raw
    // while the glance tile and the sidebar fact rendered roundPriceForProse of the same figure,
    // so 165 pages showed "$995K" in the hero and "$1M" two inches below it. The reader cannot
    // tell whether that is one number or two.
    rawTypicalPrice: saleBasis ? roundPriceForProse(saleBasis.typical) : null,
    rawTotalTransactions: totalTransactions,
    // Sales and leases kept SEPARATE alongside the combined figure. The meta description called
    // totalTransactions "recorded sales" on 296 pages whose own tile disagreed — see the comment
    // at the Transactions-tracked tile above for why the two numbers differ.
    rawSoldCount12mo: countFor12mo,
    rawLeasedCount12mo: leasedFor12mo,
  };
}

function housingMix(typeAggs: RawTypeAgg[], allListings: Listing[]): { primary: string; description: string } {
  const counts: Record<string, number> = {};
  for (const a of typeAggs) counts[a.property_type] = (counts[a.property_type] ?? 0) + a.n;
  // If no sold data, fall back to active listings.
  if (Object.keys(counts).length === 0) {
    for (const l of allListings) counts[l.propertyType] = (counts[l.propertyType] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { primary: "—", description: "" };
  if (entries.length >= 3) {
    return { primary: "Mixed", description: entries.slice(0, 3).map(([t]) => displayNameShort(t)).join(" · ").toLowerCase() };
  }
  return { primary: displayNameFor(entries[0][0] as ProductTypeKey), description: entries.map(([t]) => displayNameShort(t)).join(" · ").toLowerCase() };
}

function displayNameFor(type: string): string {
  switch (type) {
    case "detached": return "Detached";
    case "semi": return "Semi";
    case "townhouse": return "Townhouse";
    case "condo": return "Condo";
    case "link": return "Link";
    case "freehold-townhouse": return "Freehold Town";
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
function displayNameShort(type: string): string {
  if (type === "townhouse") return "town";
  return type;
}

/* ─────────────────────────────────────────────────────────────────────
   PRODUCT TYPE SECTIONS
   ───────────────────────────────────────────────────────────────────── */

function buildProductTypeSections(input: {
  streetName: string;
  shortName: string;
  stats: RawSoldStats | null;
  monthlyRows: RawMonthly[];
  typeAggs: RawTypeAgg[];
  activeListings: Listing[];
}): TypeSectionProps[] {
  const { streetName, shortName, typeAggs, activeListings, monthlyRows } = input;

  const types: ProductTypeKey[] = ["detached", "semi", "townhouse", "condo"];
  const sections: TypeSectionProps[] = [];

  for (const type of types) {
    const agg = typeAggs.find((t) => t.property_type === type);
    const activeForType = activeListings.filter((l) => l.propertyType === type);
    const hasData = (agg?.n ?? 0) > 0 || activeForType.length > 0;
    if (!hasData) continue;

    const n = agg?.n ?? 0;
    const typicalPrice = num(agg?.avg_price ?? null) ?? 0;
    const lo = num(agg?.min_price ?? null);
    const hi = num(agg?.max_price ?? null);
    const kOk = n >= K_ANON_PRICE;
    // (fix f) COLLAPSE, DON'T FILL — a type card renders ONLY for a type that clears k>=5 on
    // sold price. Sub-k types were rendering a card of dashes ("under publish threshold"); their
    // active listings still surface in the Active Inventory section. If NO type clears k, `sections`
    // stays empty and the "By the home" block is omitted entirely (StreetTypes returns null).
    if (!kOk) continue;

    const statsSold: StatCell[] = [];
    // kOk is guaranteed here (sub-k types were skipped above). Count carries its window (fix a).
    statsSold.push({ label: "Typical price", value: formatCADShort(roundPriceForProse(typicalPrice)), detail: `across ${n} sales · last 12 months` });
    // A band's endpoints ARE two individual sale prices — the cheapest and the dearest
    // home that traded. That is why a range takes K_ANON_RANGE, not the card's k>=5.
    // The card floor was licensing a band off as few as five sales here, while the
    // sidebar and glance bands beside it already required ten.
    if (lo !== null && hi !== null && n >= K_ANON_RANGE) {
      statsSold.push({ label: "Price band", value: `${formatCADShort(roundPriceForProse(lo))} to ${formatCADShort(roundPriceForProse(hi))}`, detail: `across ${n} sales · last 12 months` });
    }
    const dom = num(agg?.avg_dom ?? null);
    if (dom !== null) statsSold.push({ label: "Time on market", value: `${Math.round(dom)} days`, detail: `across ${n} sales · last 12 months` });
    const ratio = num(agg?.avg_sold_to_ask ?? null);
    if (ratio !== null) statsSold.push({ label: "Sold to ask", value: `${Math.round(ratio * 100)}%`, detail: `across ${n} sales · last 12 months` });

    // Active inventory stats for the type
    if (activeForType.length > 0) {
      const priceSum = activeForType.reduce((s, l) => s + l.price, 0);
      statsSold.push({ label: "Active listings", value: String(activeForType.length), detail: `avg list ${formatCADShort(roundPriceForProse(priceSum / activeForType.length))}` });
    }

    // Same per-point floor as the market card: a quarter below k is an individual
    // price on a line, whatever the street total says.
    const typeMonthly: QuarterlyDataPoint[] = kOk
      ? monthlyToQuarterly(monthlyRows).filter((q) => (q.count ?? 0) >= K_ANON_PRICE)
      : [];

    const chartSold = kOk && typeMonthly.length >= 3
      ? {
          headline: `Quarterly sold trend · ${displayNameFor(type)}`,
          note: `Based on closed ${displayNameFor(type).toLowerCase()} sales on ${streetName}.`,
          trendLabel: trendLabel(typeMonthly),
          data: typeMonthly,
        }
      : undefined;

    sections.push({
      type,
      displayName: displayNameFor(type),
      hasData: true,
      intro: n > 0
        ? `${displayNameFor(type)} inventory on ${streetName} has seen ${n} closed sales recently. Details below.`
        : `${displayNameFor(type)} inventory on ${streetName} is currently active but has thin recent sale history.`,
      streetName,
      streetShort: shortName,
      typicalPrice: kOk ? roundPriceForProse(typicalPrice) : 0,
      statsSold,
      chartSold,
      showContactTeamPrompt: !kOk && n > 0,
    });
  }

  return sections;
}

export function monthlyToQuarterly(rows: RawMonthly[]): QuarterlyDataPoint[] {
  // Aggregate 12 months into quarters (3 per year). Group by year + floor((month-1)/3).
  const buckets = new Map<string, { totalPrice: number; totalCount: number; label: string; sortKey: number }>();
  for (const r of rows) {
    const q = Math.floor((r.month - 1) / 3) + 1;
    const key = `${r.year}-Q${q}`;
    const label = `Q${q} '${String(r.year).slice(2)}`;
    // Workstream 2 / Step 5 (2026-05-28): preserve the (year, quarter)
    // numeric pair as a sortKey so the final sort is chronological. Prior
    // code used `a.quarter.localeCompare(b.quarter)` which sorted by
    // string and placed `Q1 '26` before `Q2 '25` — wrong direction for
    // any cross-year sequence. The validator's findTemporalPairings
    // already re-sorts chronologically internally, but the prompt input
    // was previously seeing the string-sorted order, forcing the model to
    // mentally re-sort and causing it to mis-attribute Q-over-Q deltas.
    const sortKey = r.year * 4 + q;
    const curr = buckets.get(key) ?? { totalPrice: 0, totalCount: 0, label, sortKey };
    const price = num(r.avg_sold_price) ?? 0;
    curr.totalPrice += price * r.sold_count;
    curr.totalCount += r.sold_count;
    buckets.set(key, curr);
  }
  const out: Array<QuarterlyDataPoint & { sortKey: number }> = [];
  Array.from(buckets.values()).forEach((v) => {
    if (v.totalCount === 0) return;
    out.push({ quarter: v.label, value: v.totalPrice / v.totalCount, count: v.totalCount, sortKey: v.sortKey });
  });
  // Sort chronologically (year × 4 + quarter), then slice the most recent 8.
  return out
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-8)
    .map(({ quarter, value, count }) => ({ quarter, value, count }));
}

function trendLabel(points: QuarterlyDataPoint[]): string {
  if (points.length < 2) return "—";
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first === 0) return "—";
  const pct = ((last - first) / first) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/* ─────────────────────────────────────────────────────────────────────
   DESCRIPTION
   ───────────────────────────────────────────────────────────────────── */

function buildDescriptionBody(
  streetContent: { description: string; streetName: string } | null,
  // The RESOLVED display name. streetContent.streetName is the stored copy and can be stale — it
  // said "Buckthorn" while the registry said BUCKTHORN GARDEN — so the heading took it from there
  // and rendered "About Buckthorn" under an H1 reading "Buckthorn Garden".
  displayName: string,
): DescriptionBodyProps {
  // Legacy fallback shape — populated when no Phase 4.1 StreetGeneration row
  // exists for this street. Maps the single-blob StreetContent.description
  // into one "about" section so the new DescriptionBody contract is satisfied.
  // The page-level resolveDescriptionBody swaps this for the full 8-section
  // generated payload when one is available.
  if (!streetContent?.description) {
    return { sections: [], faq: [] };
  }
  return {
    sections: [
      {
        id: "about",
        heading: `About ${displayName}`,
        paragraphs: streetContent.description.split(/\n\n+/).filter((p) => p.trim().length > 0),
      },
    ],
    faq: [],
  };
}

// Sidebar facts are TILES, not prose — and until now nothing audited them. Every
// figure here carries its own sample and window in the value, because the fact list
// has no basis slot and a bare "$1M · Typical price" is a claim with no provenance.
function buildSidebar(input: {
  shortName: string;
  streetName: string;
  sale12: RawSale12mo | null;
  centroid: { lat: number; lng: number } | null;
  neighbourhoods: string[];
  enrichment: StreetEnrichment;
}): DescriptionSidebarProps {
  const { shortName, streetName, sale12, centroid, neighbourhoods, enrichment } = input;

  const facts: Record<string, string> = {};
  const cleanNbhds = neighbourhoods.map(cleanNeighbourhoodName).filter(Boolean);
  facts["Neighbourhood"] = cleanNbhds.slice(0, 2).join(", ") || config.CITY_NAME;

  const n = sale12?.n ?? 0;
  const basis = enrichment.saleBasis;
  if (basis) {
    facts["Typical price"] = `${formatCADShort(roundPriceForProse(basis.typical))} · ${windowDisclosure(basis)}`;
  }
  // A range leaks its own endpoints, so it takes the higher floor — against the same n.
  if (n >= K_ANON_RANGE) {
    const lo = num(sale12!.lo);
    const hi = num(sale12!.hi);
    if (lo !== null && hi !== null) {
      facts["Price band"] = `${formatCADShort(roundPriceForProse(lo))} to ${formatCADShort(roundPriceForProse(hi))} · across ${n} sales in the last 12 months`;
    }
  }
  // WAS: `if (dom !== null)` over DB3's 90-day avg_dom — no floor of any kind. On 171
  // pages that printed one identified sale's days-on-market as the street's "typical".
  const dom = num(sale12?.dom ?? null);
  if (dom !== null && n >= K_ANON_PRICE) {
    facts["Typical days on market"] = `${Math.round(dom)} days · across ${n} sales in the last 12 months`;
  }
  if (n > 0) facts["Sales tracked"] = `${n} · last 12 months`;

  return {
    streetFacts: facts,
    // POI names survive (they are genuinely Milton locations); the minute figures do not,
    // until a per-street coordinate exists to derive them from.
    nearbyPlaces: nearbyPlacesFor(centroid)
      .slice(0, 6)
      .map((p) => (isStreetSpecificCoord(centroid) ? p : { ...p, distance: null })),
    sidebarCTA: {
      eyebrow: `For ${shortName} owners`,
      headline: `What is yours worth today?`,
      body: `A short conversation grounded in every sale we have tracked on ${streetName}.`,
      actionLabel: "Request a valuation",
      actionHref: "/sell",
      trustLine: "Complimentary · Response within one hour",
    },
  };
}

/** ADDRESS-POINTS HOOK — the one predicate behind every travel-time figure on a street page.
 *
 *  Every published street currently falls back to the Milton-centre centroid, because DB1 carries
 *  no usable per-street coordinate. The audit measured the consequence: all 407 full-shell pages
 *  render a BYTE-IDENTICAL distance set, so "Milton GO · 4 min drive" is asserted equally on a
 *  town-centre street and on an escarpment street 20 minutes out. A per-street claim we cannot
 *  support is suppressed until we can.
 *
 *  Self-restoring: when Address Points lands and real coordinates flow through, this returns true
 *  and every minute figure comes back with no other change. */
export function isStreetSpecificCoord(c: { lat: number; lng: number } | null): boolean {
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;
  if (c.lat === 0 || c.lng === 0) return false;                       // the DB1 feed gap
  return Math.abs(c.lat - 43.51) < 0.6 && Math.abs(c.lng + 79.88) < 0.6; // plausibly Milton
}

function nearbyPlacesFor(centroid: { lat: number; lng: number } | null): NearbyPlace[] {
  // Fallback to Milton centre when a street has no DB1 or DB2 coordinates.
  // Distances will reflect centre-of-town rather than the exact street, but the
  // nearby list still surfaces the right set of POIs and the schema ItemList
  // always emits — consistent with the "graceful degradation" rule.
  const centre = centroid ?? { lat: 43.5083, lng: -79.8822 };
  const out: NearbyPlace[] = [];
  // Nearest grocery
  const groceries = GROCERIES
    .map((g) => ({ g, km: haversineKm(centre.lat, centre.lng, g.lat, g.lng) }))
    .sort((a, b) => a.km - b.km);
  if (groceries[0]) out.push({ category: "Grocery", name: groceries[0].g.name, distance: `${driveMinutes(groceries[0].km)} min drive`, icon: "🛒" });
  // Nearest mosque
  const mosques = MOSQUES
    .map((m) => ({ m, km: haversineKm(centre.lat, centre.lng, m.lat, m.lng) }))
    .sort((a, b) => a.km - b.km);
  if (mosques[0]) out.push({ category: "Mosque", name: mosques[0].m.name, distance: `${driveMinutes(mosques[0].km)} min drive`, icon: "🕌", href: mosques[0].m.href });
  // Two nearest schools
  const nearestSchools = schools
    .slice(0, 14)
    .map((s, i) => ({ s, i, km: 1.5 + (i % 5) * 0.5 })) // synthetic — schools.ts has no coords
    .sort((a, b) => a.km - b.km)
    .slice(0, 2);
  for (const { s, km } of nearestSchools) {
    out.push({ category: s.level === "secondary" ? "Secondary" : "Elementary", name: s.name, distance: km < 1 ? `${walkMinutes(km)} min walk` : `${driveMinutes(km)} min drive`, icon: "🏫" });
  }
  // Milton GO
  const goKm = haversineKm(centre.lat, centre.lng, 43.5173, -79.8693);
  out.push({ category: "GO Station", name: "Milton GO", distance: `${driveMinutes(goKm)} min drive`, icon: "🚆" });
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
   AT A GLANCE
   ───────────────────────────────────────────────────────────────────── */


function buildGlanceTiles(input: {
  stats: RawSoldStats | null;
  sale12: RawSale12mo | null;
  lease12: RawLease12mo | null;
  allListings: Listing[];
  typeAggs: RawTypeAgg[];
  enrichment: StreetEnrichment;
}): GlanceTile[] {
  const { stats, sale12, lease12, allListings, typeAggs, enrichment } = input;
  const active = allListings.filter((l) => l.status === "active");
  const n = sale12?.n ?? 0;
  const soldRange = sale12 ? { n: sale12.n, lo: sale12.lo, hi: sale12.hi } : null;

  const tiles: GlanceTile[] = [];

  // RELABELLED: this tile counts SALES ONLY, while the hero tile of the same former label counted
  // sales + leases — the same words over two different numbers on one screen. Distinct subject,
  // distinct label, explicit window.
  tiles.push({ label: "Sales tracked", value: String(n), detail: "last 12 months" });

  // Same graduated basis as the hero, same value, same disclosure. No 90-day substitution.
  const gSale = enrichment.saleBasis;
  tiles.push({
    label: "Typical sold",
    value: gSale ? formatCADShort(roundPriceForProse(gSale.typical)) : "—",
    detail: gSale ? windowDisclosure(gSale) : "under publish threshold",
  });

  // WAS: DB3's 90-day avg_dom and avg_sold_to_ask, both captioned "last 12 months" and
  // neither floored. 236 pages published one of these off fewer than five sales. Now the
  // 12-month figures, floored against the count of the rows they average.
  const dom = num(sale12?.dom ?? null);
  tiles.push({
    label: "Typical DOM",
    value: dom !== null && n >= K_ANON_PRICE ? `${Math.round(dom)}d` : "—",
    detail: n >= K_ANON_PRICE ? `across ${n} sales · last 12 months` : "under publish threshold",
  });

  const staPct = publishedSoldToAskPct(sale12);
  tiles.push({
    label: "Sold to ask",
    value: staPct !== null ? `${staPct}%` : "—",
    detail: n >= K_ANON_PRICE ? `across ${n} sales · last 12 months` : "under publish threshold",
  });

  // Type split — 2 tiles
  const topTypes = [...typeAggs].sort((a, b) => b.n - a.n).slice(0, 2);
  for (const t of topTypes) {
    const avgPrice = num(t.avg_price);
    tiles.push({
      label: `${displayNameFor(t.property_type)} sold`,
      value: t.n >= K_ANON_PRICE && avgPrice ? formatCADShort(roundPriceForProse(avgPrice)) : String(t.n),
      detail: t.n >= K_ANON_PRICE ? `across ${t.n} sales · last 12 months` : `${t.n} ${t.n === 1 ? "sale" : "sales"} · last 12 months`,
    });
  }

  // Range floor / ceiling
  if (soldRange && soldRange.n >= K_ANON_RANGE) {
    const lo = num(soldRange.lo);
    const hi = num(soldRange.hi);
    if (lo !== null) tiles.push({ label: "Lowest sold", value: formatCADShort(roundPriceForProse(lo)), detail: `across ${soldRange.n} sales · last 12 months` });
    if (hi !== null) tiles.push({ label: "Highest sold", value: formatCADShort(roundPriceForProse(hi)), detail: `across ${soldRange.n} sales · last 12 months` });
  } else {
    tiles.push({ label: "Sale range", value: "—", detail: "under publish threshold" });
    tiles.push({ label: "Activity", value: `${stats?.sold_count_90days ?? 0}`, detail: "sales · last 90 days" });
  }

  tiles.push({ label: "Active right now", value: String(active.length), detail: "live listings · today" });

  // THE "TREND" TILE IS GONE. price_change_yoy compares a 365-day average against the
  // 365 days before it, and nothing anywhere counts the prior window — so there is no n
  // to floor it against. It was rendering on 277 pages, unfloored, on the same figure
  // that was pulled out of /api/sold-stats for exactly this reason. A figure whose
  // sample cannot be counted cannot be published.

  // Market temperature is classified from the 90-day sold-to-ask and DOM, so it takes
  // the 90-day count as its floor — and it is never defaulted. It used to fall back to
  // the literal "balanced" whenever the column was null, which printed a market verdict
  // for 165 streets with ZERO closed sales in the window.
  const temp = stats?.market_temperature ?? null;
  const c90 = stats?.sold_count_90days ?? 0;
  if (temp && c90 >= K_ANON_PRICE) {
    tiles.push({
      label: "Market state",
      value: temp.replace(/^\w/, (c) => c.toUpperCase()),
      detail: `across ${c90} closed sales · last 90 days`,
    });
  }

  // Peak month is the modal closing month over the year — a shape, not a price, but it
  // is still derived from the sale pool, so it waits for the same floor.
  const peak = stats?.peak_month;
  if (peak && n >= K_ANON_PRICE) {
    const monthName = new Date(2024, peak - 1, 1).toLocaleString("en-CA", { month: "short" });
    tiles.push({ label: "Busiest month", value: monthName, detail: `most closings · across ${n} sales` });
  } else {
    tiles.push({ label: "Leases", value: String(lease12?.n ?? 0), detail: "closed · last 12 months" });
  }

  // (fix f) COLLAPSE, DON'T FILL — drop tiles that would render as a bare "—" so the at-a-glance
  // grid never reads as a wall of dashes. Real values (incl. legitimate 0-counts) stay; suppressed
  // metrics simply don't take a tile. Cap at 12.
  return tiles.filter((t) => t.value !== "—").slice(0, 12);
}

/* ─────────────────────────────────────────────────────────────────────
   MARKET ACTIVITY
   ───────────────────────────────────────────────────────────────────── */

function buildMarketActivity(input: {
  slug: string;
  streetName: string;
  stats: RawSoldStats | null;
  sale12: RawSale12mo | null;
  lease12: RawLease12mo | null;
  leaseBeds: RawLeaseBedAgg[];
  monthlyRows: RawMonthly[];
  enrichment: StreetEnrichment;
}): MarketActivityProps {
  const { streetName, stats, sale12, lease12, leaseBeds, monthlyRows, enrichment } = input;
  const salesCount = stats?.sold_count_90days ?? 0; // 90-DAY count — labelled as such below (fix a)
  const n = sale12?.n ?? 0;
  const dom = num(sale12?.dom ?? null);
  const leaseN = lease12?.n ?? 0;
  const leaseDom = num(lease12?.dom ?? null);

  const quarterly = monthlyToQuarterly(monthlyRows);

  // Per-bed rents now carry their OWN counts. They used to come from DB3's
  // avg_leased_price_<N>bed — 90-day averages of a BED SUBSET, licensed by the pool's
  // 12-month count. A bucket is always smaller than the pool that vouched for it.
  const bedAgg = (b: number) => leaseBeds.find((x) => Number(x.bed) === b) ?? null;
  const anyLease = leaseBeds.some((b) => Number(b.n) >= K_ANON_PRICE);
  // WAS: roundPriceForProse — a HOUSE-price rounder whose smallest step is $10,000 — applied to a
  // monthly rent, which collapsed every rent to $0, which the code then suppressed as "—". The
  // hero lease pill published the same metric from the same basis at full precision. One metric,
  // one publishing and one not, on 139 pages. Rents now round to $25 and print in full, matching
  // the pill's `dollars()` exactly.
  const rentCell = (x: number | null) => {
    const r = x != null ? roundRentForProse(x) : 0;
    return r > 0 ? formatCAD(r) : "—";
  };
  // (fix c) Typical sold mirrors the graduated hero/glance basis — and now uses its value
  // rather than substituting the 90-day DB3 figure on the 12-month path.
  const gSale = enrichment.saleBasis;
  const gLease = enrichment.leaseBasis;
  const typicalSold = gSale ? formatCADShort(roundPriceForProse(gSale.typical)) : "—";

  return {
    salesSummary: {
      title: "Sales",
      body: salesCount > 0
        ? `Sale activity on ${streetName} in the last 90 days. Stats reflect closed transactions only.`
        : `No closed sales on record for ${streetName} in the last 90 days.`,
      stats: [
        // (fix a) window-label the count so it reads as complementary to the hero's 12-month basis.
        // EVERY label below names the window of the figure beside it — the card used to sit under
        // a "last 90 days" heading with two 90-day figures and one graduated one, undistinguished.
        { label: "Recent sales · last 90 days", value: String(salesCount) },
        { label: gSale ? `Typical sold · ${gSale.window === "12mo" ? "last 12 months" : "last ~2 years"}` : "Typical sold", value: typicalSold },
        { label: "Days on market · last 12 months", value: dom !== null && n >= K_ANON_PRICE ? String(Math.round(dom)) : "—" },
      ],
    },
    // The card renders whenever a rent is PUBLISHABLE, not only when the 12-month count is
    // non-zero. Five streets carried a lease pill off the graduated ~2-year basis while their
    // 12-month count was 0, so the card vanished and the hero published a rent the market
    // section silently omitted — the same one-metric-two-answers problem in a different shape.
    leasesSummary: (leaseN > 0 || gLease) ? {
      title: "Leases",
      body: `Rental activity on ${streetName} across recent months. Breakdown by bed count below.`,
      stats: [
        { label: "Recent leases · last 12 months", value: String(leaseN) },
        { label: gLease ? `Typical rent · ${gLease.window === "12mo" ? "last 12 months" : "last ~2 years"}` : "Typical rent", value: gLease ? rentCell(gLease.typical) : "—" },
        { label: "Days on market · last 12 months", value: leaseDom !== null && leaseN >= K_ANON_PRICE ? String(Math.round(leaseDom)) : "—" },
      ],
    } : undefined,
    // K-anonymity, PER PLOTTED POINT. The old gate checked the street's TOTAL count and
    // then plotted every quarter, so a street with 12 sales in a year could still put a
    // quarter of 1 on the line — and a point on a price chart is a price. The comment
    // above the old gate said exactly this ("each quarter reveals individual transaction
    // prices") and then guarded the wrong number. Quarters below k are dropped; a chart
    // needs at least 3 surviving points to be worth drawing.
    priceChart: (() => {
      const pts = quarterly.filter((q) => (q.count ?? 0) >= K_ANON_PRICE);
      if (pts.length < 3) return null;
      return {
        data: pts,
        caption: `Typical sold price across all product types on ${streetName}, plotted with transaction volume. Quarters with fewer than ${K_ANON_PRICE} closed sales are not plotted.`,
      };
    })(),
    rentByBeds: (() => {
      if (!anyLease) return undefined;
      const cell = (b: number, label: string) => {
        const a = bedAgg(b);
        const cnt = a ? Number(a.n) : 0;
        const avg = a ? num(a.avg) : null;
        return cnt >= K_ANON_PRICE && avg !== null
          ? { label, value: rentCell(avg), detail: `across ${cnt} leases · last 12 months` }
          : { label, value: "—", detail: "under publish threshold" };
      };
      const rows = [cell(1, "1 bed"), cell(2, "2 bed"), cell(3, "3 bed"), cell(4, "4+ bed")];
      // (fix f) collapse a per-bed grid that is entirely "—" — don't render scaffolding
      // with no cell to show.
      return rows.some((r) => r.value !== "—") ? rows : undefined;
    })(),
    streetName,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   COMMUTE
   ───────────────────────────────────────────────────────────────────── */

function buildCommuteGrid(centroid: { lat: number; lng: number } | null): CommuteGridProps {
  const fallbackCoords = { lat: 43.5183, lng: -79.8848 };
  const c = centroid ?? fallbackCoords;

  const goKm = haversineKm(c.lat, c.lng, 43.5173, -79.8693); // Milton GO
  const hospitalKm = haversineKm(c.lat, c.lng, 43.5158, -79.8861); // Milton District Hospital

  const categories: CommuteCategory[] = [
    {
      id: "transit",
      title: "Transit & highways",
      subtitle: "Milton GO, 401, and major routes",
      icon: "⇄",
      destinations: [
        { name: "Milton GO Station", primaryTime: `${driveMinutes(goKm)} min drive`, secondaryTime: `${walkMinutes(goKm)} min walk`, schemaType: "TrainStation" },
        { name: "Highway 401 on-ramp", primaryTime: "5 min drive", schemaType: "Place" },
        { name: "Union Station (GO)", primaryTime: "58 min transit", schemaType: "TrainStation" },
      ],
    },
    {
      id: "education",
      title: "Schools",
      subtitle: "Public and Catholic boards",
      icon: "✎",
      destinations: schools.slice(0, 5).map((s) => ({
        name: s.name,
        primaryTime: `${3 + (s.name.length % 6)} min drive`, // synthetic
        schemaType: "School" as const,
      })),
    },
    {
      id: "health",
      title: "Health",
      subtitle: "Hospital and nearby care",
      icon: "✚",
      destinations: [
        { name: "Milton District Hospital", primaryTime: `${driveMinutes(hospitalKm)} min drive`, schemaType: "Hospital" },
      ],
    },
    {
      id: "parks",
      title: "Parks & recreation",
      subtitle: "Trails, pools, and conservation areas",
      icon: "❖",
      destinations: [
        { name: "Kelso Conservation Area", primaryTime: "12 min drive", schemaType: "Park" },
        { name: "Rattlesnake Point Conservation", primaryTime: "20 min drive", schemaType: "Park" },
      ],
    },
    {
      id: "shopping",
      title: "Shopping & groceries",
      subtitle: "Plazas, grocers, and big-box",
      icon: "◎",
      destinations: GROCERIES.slice(0, 3).map((g) => ({
        name: g.name,
        primaryTime: `${driveMinutes(haversineKm(c.lat, c.lng, g.lat, g.lng))} min drive`,
        schemaType: "GroceryStore" as const,
      })),
    },
    {
      id: "worship",
      title: "Places of worship",
      subtitle: "Mosques, churches, gurdwaras",
      icon: "⌂",
      destinations: MOSQUES.slice(0, 3).map((m) => ({
        name: m.name,
        primaryTime: `${driveMinutes(haversineKm(c.lat, c.lng, m.lat, m.lng))} min drive`,
        schemaType: "PlaceOfWorship" as const,
        href: m.href,
      })),
    },
  ];

  // Same suppression as the Nearby list: destination names stay, travel times go until a
  // per-street coordinate can support them. See isStreetSpecificCoord.
  if (isStreetSpecificCoord(centroid)) return { categories };
  return {
    categories: categories.map((cat) => ({
      ...cat,
      destinations: cat.destinations.map((d) => ({ ...d, primaryTime: null, secondaryTime: null })),
    })),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   ACTIVE INVENTORY
   ───────────────────────────────────────────────────────────────────── */

function buildActiveInventory(input: {
  listings: Listing[];
  streetName: string;
  shortName: string;
}): ActiveInventoryProps {
  return {
    listings: input.listings.map((l) => ({
      mlsNumber: l.mlsNumber,
      address: l.address,
      price: l.price,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      parking: l.parking,
      propertyType: l.propertyType,
      daysOnMarket: l.daysOnMarket ?? null,
      photo: l.photos && l.photos.length > 0 ? l.photos[0] : undefined,
      href: `/listings/${l.mlsNumber}`,
    })),
    streetName: input.streetName,
    streetShort: input.shortName,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   CONTEXT CARDS
   ───────────────────────────────────────────────────────────────────── */

async function buildContextCards(input: {
  slug: string;
  neighbourhoods: string[];
  centroid: { lat: number; lng: number } | null;
}): Promise<ContextCardsProps> {
  const { slug, neighbourhoods } = input;

  const similar = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    _avg: { price: true },
    where: {
      neighbourhood: { in: neighbourhoods.length > 0 ? neighbourhoods : [config.CITY_NAME] },
      streetSlug: { not: slug },
      status: "active",
      permAdvertise: true,
    },
    orderBy: { _count: { streetSlug: "desc" } },
    take: 4,
  });

  const similarStreets = await Promise.all(
    similar.map(async (s) => {
      const sample = await prisma.listing.findFirst({
        where: { streetSlug: s.streetSlug },
        select: { streetName: true, address: true },
      });
      return {
        slug: s.streetSlug,
        name: resolveStreetName(s.streetSlug, sample?.streetName ?? extractStreetName(sample?.address ?? s.streetSlug)).name,
        avgPrice: Math.round(s._avg.price ?? 0),
        count: s._count,
      };
    })
  );

  // RESOLVE the up-link through the Neighbourhood REGISTRY, then require a PUBLISHED hub — the slug
  // was a slugified NAME-GUESS, never validated. That both 404'd (Walker's raw "1051 - Walker"
  // name-guessed to /neighbourhoods/1051---walker; "Brookville/Haltonville" kept its slash) AND
  // under-linked. Registry resolution maps every raw/name/slug variant to its canonical slug, so
  // Walker/Brookville now link CORRECTLY; a neighbourhood with no published hub, or one that can't
  // be resolved, emits NO link rather than a broken one.
  const [pubHubRows, nbhdRows] = await Promise.all([
    prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } }),
    prisma.neighbourhood.findMany({ select: { slug: true, name: true, rawStrings: true } }),
  ]);
  const publishedHubSlugs = new Set(pubHubRows.map((h) => h.neighbourhoodSlug));
  const hubSlugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const resolveMap = new Map<string, string>(); // normalized key -> canonical slug
  const nameBySlug = new Map<string, string>();
  for (const nb of nbhdRows) {
    nameBySlug.set(nb.slug, nb.name);
    for (const key of [nb.slug, nb.name, ...nb.rawStrings]) {
      const k = hubSlugify(key);
      if (k) resolveMap.set(k, nb.slug);
    }
  }
  const seenHub = new Set<string>();
  const neighbourhoodCards: Array<{ slug: string; name: string; summary: string }> = [];
  for (const raw of neighbourhoods.map(cleanNeighbourhoodName)) {
    if (!raw || raw.length === 0) continue;
    const resolved = resolveMap.get(hubSlugify(raw));
    if (!resolved || !publishedHubSlugs.has(resolved) || seenHub.has(resolved)) continue;
    seenHub.add(resolved);
    const name = nameBySlug.get(resolved) ?? raw;
    neighbourhoodCards.push({
      slug: resolved,
      name,
      summary: `Explore the ${name} area of ${config.CITY_NAME}, its streets and comparable housing stock.`,
    });
    if (neighbourhoodCards.length >= 2) break;
  }

  const schoolCards = schools
    .filter((s) => neighbourhoods.some((n) => s.neighbourhood.includes(n) || n.includes(s.neighbourhood)))
    .slice(0, 4)
    .map((s) => ({ slug: s.slug, name: s.name, board: s.boardName, level: s.level === "secondary" ? "Secondary" : "Elementary" }));

  // Physically-connected streets — precomputed in StreetAdjacency (shared OSM node), read
  // with one indexed lookup. connectedName is the denormalised link label. Empty when this
  // street didn't match an OSM way (renders nothing).
  const adjacency = await prisma.streetAdjacency.findMany({
    where: { streetSlug: slug },
    orderBy: { connectedName: "asc" },
    select: { connectedSlug: true, connectedName: true },
  });
  const connectedStreets = adjacency.map((a) => ({ slug: a.connectedSlug, name: a.connectedName }));

  return {
    similarStreets,
    connectedStreets,
    neighbourhoods: neighbourhoodCards,
    schools: schoolCards.length > 0 ? schoolCards : schools.slice(0, 4).map((s) => ({ slug: s.slug, name: s.name, board: s.boardName, level: s.level === "secondary" ? "Secondary" : "Elementary" })),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   FINAL CTAs + CORNER WIDGET
   ───────────────────────────────────────────────────────────────────── */

function buildFinalCTAs(input: { streetName: string; shortName: string }): FinalCTAsProps {
  return {
    sellerCTA: {
      eyebrow: "For owners",
      headline: `Selling on ${input.shortName}`,
      body: `A thoughtful conversation grounded in every sale we have tracked on ${input.streetName}.`,
      actionLabel: "Request a valuation",
      actionHref: "/sell",
    },
    buyerCTA: {
      eyebrow: "For buyers",
      headline: `Buying on ${input.shortName}`,
      body: `Private access to new and upcoming listings before they go public.`,
      actionLabel: "Set an alert",
      actionHref: "/listings",
      secondary: true,
    },
  };
}

function buildCornerWidget(input: {
  streetName: string;
  shortName: string;
  heroProps: StreetHeroProps;
  productTypes: TypeSectionProps[];
}): CornerWidgetProps {
  const { streetName, shortName, heroProps, productTypes } = input;
  // Compose the widget headline from whichever stats actually publish a value.
  // Filter out the single-character em-dash placeholders so the widget never
  // renders copy like "— · 4 transactions".
  const typicalStat = heroProps.heroStats.find((s) => s.label === "Typical price");
  const txStat = heroProps.heroStats.find((s) => s.label === "Transactions tracked");
  const typicalText =
    typeof typicalStat?.value === "string" && typicalStat.value !== "—"
      ? typicalStat.value
      : "";
  const txText = txStat?.value ? `${txStat.value} transactions` : "";
  const heroHeadline = [typicalText, txText].filter(Boolean).join(" · ");

  const sectionInsights: SectionInsight[] = [
    { id: "s1", text: `Where you land on ${shortName} shapes what you are buying.` },
    ...productTypes.map((p) => ({
      id: `type-${p.type}`,
      text: `${p.displayName}: ${p.typicalPrice ? formatCADShort(roundPriceForProse(p.typicalPrice)) + " typical" : "thin data"} · see details inline.`,
    })),
    { id: "s5", text: `The fine details that distinguish ${shortName}.` },
    { id: "s6", text: `What has actually been closing on ${shortName}, by the numbers.` },
    { id: "s7", text: `Commute reach from ${shortName}.` },
    { id: "s8", text: `Active inventory on ${streetName} right now.` },
    { id: "s9", text: `How ${streetName} compares to nearby streets and schools.` },
    { id: "s10", text: `Common questions about ${streetName}.` },
  ];

  return {
    streetName,
    streetShort: shortName,
    heroHeadline: heroHeadline || "Live street data",
    sectionInsights,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   URL / CANONICAL
   ───────────────────────────────────────────────────────────────────── */

export function canonicalUrlFor(slug: string): string {
  return `${SITE_URL}/streets/${slug}`;
}
