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
import { config } from "./config";
import { getAnalyticsDb, getSoldDb } from "./db";
import { haversineKm, hasValidCoords, driveMinutes, walkMinutes, MOSQUES, GROCERIES } from "./geo";
import { schools } from "./schools";
import { extractStreetName, ruralSideRoadName, deriveIdentity } from "./streetUtils";
import { cleanNeighbourhoodName, roundPriceForProse } from "./format";
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

const K_ANON_PRICE = 5;
const K_ANON_RANGE = 10;
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
    soldRange12moRows,
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
          GROUP BY property_type
        ` as unknown as Promise<RawTypeAgg[]>).catch(() => [] as RawTypeAgg[])
      : Promise.resolve([] as RawTypeAgg[]),
    sd
      ? (sd`
          SELECT COUNT(*)::int AS n,
                 MIN(sold_price) AS lo,
                 MAX(sold_price) AS hi
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblingSlugs}::text[])
            AND perm_advertise = TRUE
            AND transaction_type = 'For Sale'
            AND sold_date >= NOW() - INTERVAL '12 months'
        ` as unknown as Promise<Array<{ n: number; lo: string | null; hi: string | null }>>).catch(() => [] as Array<{ n: number; lo: string | null; hi: string | null }>)
      : Promise.resolve([] as Array<{ n: number; lo: string | null; hi: string | null }>),
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

  // Existence gate — slug is unknown only if it has no presence in any DB:
  // no current DB1 listings, no DB3 pre-computed aggregates, no DB1 StreetContent,
  // and no DB2 historical sold record.
  if (
    allListings.length === 0 &&
    soldStatsRows.length === 0 &&
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
  const streetName = expandStreetName(rawName);
  const shortName = shortNameFor(streetName);
  const neighbourhoods = dedupe(
    allListings
      .map((l) => cleanNeighbourhoodName(l.neighbourhood))
      .filter((n) => n.length > 0)
  );
  let centroid = computeCentroid(allListings);
  if (!centroid) {
    const c = soldCoordsRows[0];
    const lat = c?.lat !== null && c?.lat !== undefined ? parseFloat(c.lat) : null;
    const lng = c?.lng !== null && c?.lng !== undefined ? parseFloat(c.lng) : null;
    if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
      centroid = { lat, lng };
    }
  }

  const stats = soldStatsRows[0] ?? null;
  const soldRange = soldRange12moRows[0] ?? null;

  // ─── Hero + product pills ─────────────────────────────────────────
  const heroProps = buildHero({
    streetName,
    neighbourhoods,
    stats,
    soldRange,
    allListings,
    streetContent,
    typeAggs: soldTypeAggRows,
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
  const descriptionBody = buildDescriptionBody(streetContent);
  const descriptionSidebar = buildSidebar({ shortName, streetName, stats, centroid, neighbourhoods, soldRange });

  // ─── At a glance (12 tiles) ───────────────────────────────────────
  const glanceTiles = buildGlanceTiles({
    stats,
    allListings,
    typeAggs: soldTypeAggRows,
    soldRange,
  });

  // ─── Market Activity (soldTable filled later by the page) ─────────
  const marketActivity = buildMarketActivity({
    slug,
    streetName,
    stats,
    monthlyRows,
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
  const faqs = parseFaqs(streetContent?.faqJson, { streetName, shortName, stats });

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
      characterSummary: characterSummaryFrom(streetContent?.description),
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

/** Token-level expansion map for street-type abbreviations and compass
 *  directions. Applied only to the display form of the street name — the
 *  short form (used in prose) keeps abbreviations. */
const STREET_ABBREVIATIONS: Record<string, string> = {
  ave: "Avenue",
  st: "Street",
  rd: "Road",
  dr: "Drive",
  ct: "Court",
  // Step 11d: real-world DB1 streetName values use "Crt" for Court.
  // Slug forms include both -crt-milton and -court-milton. Both abbreviation
  // variants map to "Court" — the canonical full-word form.
  crt: "Court",
  cres: "Crescent",
  blvd: "Boulevard",
  ln: "Lane",
  pl: "Place",
  tr: "Trail",
  trl: "Trail",
  cir: "Circle",
  hts: "Heights",
  gt: "Gate",
  cmn: "Common",
  pk: "Park",
  // Step 11d: parkway variants (pkwy/pky) absent from universe audit but
  // mapped here for completeness across GTA datasets.
  pkwy: "Parkway",
  pky: "Parkway",
  rdg: "Ridge",
  gr: "Grove",
  gv: "Grove",
  cl: "Close",
  wk: "Walk",
  hl: "Hill",
  ter: "Terrace",
  terr: "Terrace",
  vw: "View",
  hwy: "Highway",
  // compass directions
  e: "East",
  w: "West",
  n: "North",
  s: "South",
  ne: "Northeast",
  nw: "Northwest",
  se: "Southeast",
  sw: "Southwest",
};

/** Strip trailing " Milton" if present — shared by both display and short-name
 *  derivations so stored DB names and slug-derived names are normalized
 *  identically. */
function stripTrailingCity(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens[tokens.length - 1].toLowerCase() === config.CITY_NAME.toLowerCase()) {
    return tokens.slice(0, -1).join(" ");
  }
  return name;
}

/** Expand street-type abbreviations ("Cres" → "Crescent") and compass
 *  abbreviations ("E" → "East") for DISPLAY contexts: H1, page title,
 *  breadcrumbs, schema.org Place.name. Strips trailing " Milton" so the
 *  city suffix never double-renders.
 *
 *  Step 13h — after expansion, collapse adjacent duplicates so names like
 *  "Asleton Blvd Boulevard" (where raw MLS fields concatenated a suffix
 *  abbreviation AND its full-word form) render as "Asleton Boulevard".
 *
 *  Step 13h — Ontario rural-address exception. When the raw name begins
 *  with a bare numeric token followed by "Side", "Sideroad", or "Line",
 *  preserve the number as part of the street name ("3 Side Road", not
 *  just "Side Road"). For conventional street names where the leading
 *  number is a house number, the caller is responsible for stripping it
 *  BEFORE calling expandStreetName. This function preserves whatever
 *  numeric tokens it receives. */
export function expandStreetName(name: string): string {
  const cleaned = stripTrailingCity(name);
  const expanded = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const key = token.toLowerCase().replace(/\.$/, "");
      return STREET_ABBREVIATIONS[key] ?? token;
    });
  // Collapse adjacent duplicate tokens (case-insensitive). Catches the
  // doubled-suffix artifact from upstream data-ingestion paths that
  // concatenate StreetName + StreetSuffix without de-duplication.
  const deduped: string[] = [];
  for (const tok of expanded) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === tok.toLowerCase()) continue;
    deduped.push(tok);
  }
  return deduped.join(" ");
}

const STREET_SUFFIXES = new Set([
  "avenue", "street", "road", "drive", "court", "crescent", "boulevard",
  "lane", "way", "place", "trail", "line", "circle", "terrace",
  "heights", "gate", "common", "park", "ridge", "grove", "close", "walk", "hill",
  // abbreviations (with trailing period stripped before match)
  "ave", "st", "rd", "dr", "ct", "cres", "blvd", "ln", "pl", "tr", "cir",
  "hts", "gt", "cmn", "pk", "rdg", "gr", "cl", "wk", "hl", "ter", "terr",
]);

export function shortNameFor(name: string): string {
  let tokens = stripTrailingCity(name).split(/\s+/).filter(Boolean);
  // Strip a street-type suffix (e.g. "Crescent", "Ave", "Cres.").
  if (tokens.length > 1) {
    const tail = tokens[tokens.length - 1].toLowerCase().replace(/\.$/, "");
    if (STREET_SUFFIXES.has(tail)) tokens = tokens.slice(0, -1);
  }
  return tokens.join(" ") || name;
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
  const firstSentence = description.split(/[.!?](?=\s|$)/)[0].trim();
  return firstSentence.length > 30 ? firstSentence + "." : "";
}

function parseFaqs(
  faqJson: string | null | undefined,
  ctx: { streetName: string; shortName: string; stats: RawSoldStats | null }
): FAQItem[] {
  if (faqJson) {
    try {
      const parsed = JSON.parse(faqJson) as Array<{ q: string; a: string }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((f) => ({ question: f.q, answer: f.a }));
      }
    } catch { /* fall through */ }
  }
  // Fallback template — grounded in aggregate stats only.
  const { streetName, stats } = ctx;
  const typical = num(stats?.avg_sold_price ?? null);
  return [
    {
      question: `What is the typical price on ${streetName}?`,
      answer: typical
        ? `Typical sold price on ${streetName} in the recent period was ${formatCADShort(roundPriceForProse(typical))}. Range varies by product type. See the deep-link sections above for detached, townhouse, and condo breakdowns.`
        : `Sale activity on ${streetName} has been limited recently. Contact our team for a private read.`,
    },
    {
      question: `How fast do homes sell on ${streetName}?`,
      answer: stats?.avg_dom
        ? `Typical days on market is around ${Math.round(num(stats.avg_dom) ?? 0)} days.`
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
}

function buildHero(input: HeroBuildInput): StreetHeroProps {
  const { streetName, neighbourhoods, stats, soldRange, allListings, streetContent, typeAggs } = input;
  const cleanNbhds = neighbourhoods.map(cleanNeighbourhoodName).filter(Boolean);
  const eyebrow = `Street Profile · ${cleanNbhds.slice(0, 3).join(" · ") || config.CITY_NAME} · ${config.CITY_NAME}, ${config.CITY_PROVINCE_CODE}`;
  const subtitle = streetContent?.description
    ? characterSummaryFrom(streetContent.description) || `A street in ${CITY_PROVINCE_LABEL}.`
    : `A street in ${CITY_PROVINCE_LABEL}.`;

  // Build stat tiles
  const heroStats: HeroStat[] = [];
  const mix = housingMix(typeAggs, allListings);
  heroStats.push({
    label: "Housing mix",
    value: mix.primary,
    sub: mix.description || undefined,
  });

  const typical = num(stats?.avg_sold_price ?? null);
  const countFor12mo = stats?.sold_count_12months ?? 0;
  if (typical && countFor12mo >= K_ANON_PRICE) {
    const lo = num(soldRange?.lo ?? null);
    const hi = num(soldRange?.hi ?? null);
    const showRange = soldRange && soldRange.n >= K_ANON_RANGE && lo !== null && hi !== null;
    heroStats.push({
      label: "Typical price",
      value: formatCAD(roundPriceForProse(typical)),
      sub: showRange ? `range ${formatCADShort(roundPriceForProse(lo!))} to ${formatCADShort(roundPriceForProse(hi!))}` : undefined,
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
    sub: totalTransactions > 0 ? "closed deals on file" : "new street",
  });

  heroStats.push({
    label: "Active right now",
    value: String(allListings.filter((l) => l.status === "active").length),
    sub: "live on the market",
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
      typicalPrice: publishable ? typicalPrice : null,
      priceLabel: publishable ? "typical" : "sample too small",
      anchor: `#type-${type}`,
    });
  }

  // Lease pills — simpler shape, only condo and townhouse tend to have data.
  const leasePills: ProductPillData[] = [];
  const lease1 = num(stats?.avg_leased_price_1bed ?? null);
  const lease2 = num(stats?.avg_leased_price_2bed ?? null);
  const lease3 = num(stats?.avg_leased_price_3bed ?? null);
  if ((stats?.leased_count_12months ?? 0) >= K_ANON_PRICE && (lease2 || lease1 || lease3)) {
    const typicalRent = num(stats?.avg_leased_price ?? null) || (lease2 ?? lease1 ?? lease3) || null;
    leasePills.push({
      type: "condo",
      displayName: "Lease",
      count: stats!.leased_count_12months,
      typicalPrice: typicalRent,
      priceLabel: typicalRent ? "typical / mo" : "sample too small",
      anchor: "#type-condo",
    });
  }

  const productTypePills: ProductPillRow[] = [];
  if (soldPills.length > 0) {
    productTypePills.push({ label: "Recent sales", dotColor: "navy", pills: soldPills });
  }
  if (leasePills.length > 0) {
    productTypePills.push({ label: "Recent leases", dotColor: "blue", pills: leasePills });
  }

  return {
    eyebrow,
    streetName,
    subtitle,
    heroStats,
    productTypePills,
    rawTypicalPrice:
      typical && countFor12mo >= K_ANON_PRICE ? typical : null,
    rawTotalTransactions: totalTransactions,
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

    const statsSold: StatCell[] = [];
    if (kOk) {
      statsSold.push({ label: "Typical price", value: formatCADShort(roundPriceForProse(typicalPrice)), detail: `across ${n} sales` });
      if (lo !== null && hi !== null) {
        statsSold.push({ label: "Price band", value: `${formatCADShort(roundPriceForProse(lo))} to ${formatCADShort(roundPriceForProse(hi))}` });
      }
      const dom = num(agg?.avg_dom ?? null);
      if (dom !== null) statsSold.push({ label: "Time on market", value: `${Math.round(dom)} days`, detail: "typical" });
      const ratio = num(agg?.avg_sold_to_ask ?? null);
      if (ratio !== null) statsSold.push({ label: "Sold to ask", value: `${Math.round(ratio * 100)}%` });
    } else if (n > 0) {
      statsSold.push({ label: "Recent sales", value: String(n), detail: "under the publish threshold" });
    }

    // Active inventory stats for the type
    if (activeForType.length > 0) {
      const priceSum = activeForType.reduce((s, l) => s + l.price, 0);
      statsSold.push({ label: "Active listings", value: String(activeForType.length), detail: `avg list ${formatCADShort(roundPriceForProse(priceSum / activeForType.length))}` });
    }

    const typeMonthly: QuarterlyDataPoint[] = kOk ? monthlyToQuarterly(monthlyRows) : [];

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
      typicalPrice: kOk ? typicalPrice : 0,
      statsSold,
      chartSold,
      showContactTeamPrompt: !kOk && n > 0,
    });
  }

  return sections;
}

export function monthlyToQuarterly(rows: RawMonthly[]): QuarterlyDataPoint[] {
  // Aggregate 12 months into quarters (3 per year). Group by year + floor((month-1)/3).
  const buckets = new Map<string, { totalPrice: number; totalCount: number; label: string }>();
  for (const r of rows) {
    const q = Math.floor((r.month - 1) / 3) + 1;
    const key = `${r.year}-Q${q}`;
    const label = `Q${q} '${String(r.year).slice(2)}`;
    const curr = buckets.get(key) ?? { totalPrice: 0, totalCount: 0, label };
    const price = num(r.avg_sold_price) ?? 0;
    curr.totalPrice += price * r.sold_count;
    curr.totalCount += r.sold_count;
    buckets.set(key, curr);
  }
  const out: QuarterlyDataPoint[] = [];
  Array.from(buckets.values()).forEach((v) => {
    if (v.totalCount === 0) return;
    out.push({ quarter: v.label, value: v.totalPrice / v.totalCount, count: v.totalCount });
  });
  return out.sort((a, b) => a.quarter.localeCompare(b.quarter)).slice(-8);
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
  streetContent: { description: string; streetName: string } | null
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
        heading: `About ${streetContent.streetName}`,
        paragraphs: streetContent.description.split(/\n\n+/).filter((p) => p.trim().length > 0),
      },
    ],
    faq: [],
  };
}

function buildSidebar(input: {
  shortName: string;
  streetName: string;
  stats: RawSoldStats | null;
  centroid: { lat: number; lng: number } | null;
  neighbourhoods: string[];
  soldRange: { n: number; lo: string | null; hi: string | null } | null;
}): DescriptionSidebarProps {
  const { shortName, streetName, stats, centroid, neighbourhoods, soldRange } = input;

  const facts: Record<string, string> = {};
  const cleanNbhds = neighbourhoods.map(cleanNeighbourhoodName).filter(Boolean);
  facts["Neighbourhood"] = cleanNbhds.slice(0, 2).join(", ") || config.CITY_NAME;
  const typical = num(stats?.avg_sold_price ?? null);
  if (typical && (stats?.sold_count_12months ?? 0) >= K_ANON_PRICE) {
    facts["Typical price"] = formatCADShort(roundPriceForProse(typical));
  }
  if (soldRange && soldRange.n >= K_ANON_RANGE) {
    const lo = num(soldRange.lo);
    const hi = num(soldRange.hi);
    if (lo !== null && hi !== null) facts["Price band"] = `${formatCADShort(roundPriceForProse(lo))} to ${formatCADShort(roundPriceForProse(hi))}`;
  }
  const dom = num(stats?.avg_dom ?? null);
  if (dom !== null) facts["Typical days on market"] = `${Math.round(dom)} days`;
  if (stats?.sold_count_12months) facts["Transactions tracked"] = String(stats.sold_count_12months);

  return {
    streetFacts: facts,
    nearbyPlaces: nearbyPlacesFor(centroid).slice(0, 6),
    sidebarCTA: {
      eyebrow: `For ${shortName} owners`,
      headline: `What is yours worth today?`,
      body: `A short conversation grounded in every sale we have tracked on ${streetName}.`,
      actionLabel: "Request a valuation",
      actionHref: "#valuation",
      trustLine: "Complimentary · Response within one hour",
    },
  };
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
  allListings: Listing[];
  typeAggs: RawTypeAgg[];
  soldRange: { n: number; lo: string | null; hi: string | null } | null;
}): GlanceTile[] {
  const { stats, allListings, typeAggs, soldRange } = input;
  const active = allListings.filter((l) => l.status === "active");

  const tiles: GlanceTile[] = [];

  tiles.push({ label: "Transactions tracked", value: String(stats?.sold_count_12months ?? 0), detail: "recent activity" });

  const typical = num(stats?.avg_sold_price ?? null);
  tiles.push({
    label: "Typical sold",
    value: typical && (stats?.sold_count_12months ?? 0) >= K_ANON_PRICE ? formatCADShort(roundPriceForProse(typical)) : "—",
    detail: (stats?.sold_count_12months ?? 0) >= K_ANON_PRICE ? "across sale records" : "under publish threshold",
  });

  const dom = num(stats?.avg_dom ?? null);
  tiles.push({
    label: "Typical DOM",
    value: dom !== null ? `${Math.round(dom)}d` : "—",
    detail: "closed sales",
  });

  const ratio = num(stats?.avg_sold_to_ask ?? null);
  tiles.push({
    label: "Sold to ask",
    value: ratio !== null ? `${Math.round(ratio * 100)}%` : "—",
    detail: "buyer competition",
  });

  // Type split — 2 tiles
  const topTypes = [...typeAggs].sort((a, b) => b.n - a.n).slice(0, 2);
  for (const t of topTypes) {
    const avgPrice = num(t.avg_price);
    tiles.push({
      label: `${displayNameFor(t.property_type)} sold`,
      value: t.n >= K_ANON_PRICE && avgPrice ? formatCADShort(roundPriceForProse(avgPrice)) : String(t.n),
      detail: t.n >= K_ANON_PRICE ? `across ${t.n}` : `${t.n} transactions`,
    });
  }

  // Range floor / ceiling
  if (soldRange && soldRange.n >= K_ANON_RANGE) {
    const lo = num(soldRange.lo);
    const hi = num(soldRange.hi);
    if (lo !== null) tiles.push({ label: "Lowest sold", value: formatCADShort(roundPriceForProse(lo)), detail: "last 12 mo" });
    if (hi !== null) tiles.push({ label: "Highest sold", value: formatCADShort(roundPriceForProse(hi)), detail: "last 12 mo" });
  } else {
    tiles.push({ label: "Sale range", value: "—", detail: "under publish threshold" });
    tiles.push({ label: "Activity", value: `${stats?.sold_count_90days ?? 0}`, detail: "recent window" });
  }

  tiles.push({ label: "Active right now", value: String(active.length), detail: "live listings" });

  // YoY
  const yoy = num(stats?.price_change_yoy ?? null);
  tiles.push({
    label: "Trend",
    value: yoy !== null ? `${yoy >= 0 ? "+" : ""}${(yoy * 100).toFixed(1)}%` : "—",
    detail: "year over year",
  });

  // Market temperature
  tiles.push({
    label: "Market state",
    value: (stats?.market_temperature ?? "balanced").replace(/^\w/, (c) => c.toUpperCase()),
    detail: "per current activity",
  });

  // Peak month
  const peak = stats?.peak_month;
  if (peak) {
    const monthName = new Date(2024, peak - 1, 1).toLocaleString("en-CA", { month: "short" });
    tiles.push({ label: "Busiest month", value: monthName, detail: "most closings" });
  } else {
    tiles.push({ label: "Leases (12m)", value: String(stats?.leased_count_12months ?? 0), detail: "closed" });
  }

  // Exactly 12 tiles
  return tiles.slice(0, 12);
}

/* ─────────────────────────────────────────────────────────────────────
   MARKET ACTIVITY
   ───────────────────────────────────────────────────────────────────── */

function buildMarketActivity(input: {
  slug: string;
  streetName: string;
  stats: RawSoldStats | null;
  monthlyRows: RawMonthly[];
}): MarketActivityProps {
  const { slug, streetName, stats, monthlyRows } = input;
  const salesCount = stats?.sold_count_90days ?? 0;
  const typical = num(stats?.avg_sold_price ?? null);
  const dom = num(stats?.avg_dom ?? null);

  const quarterly = monthlyToQuarterly(monthlyRows);

  const lease1 = num(stats?.avg_leased_price_1bed ?? null);
  const lease2 = num(stats?.avg_leased_price_2bed ?? null);
  const lease3 = num(stats?.avg_leased_price_3bed ?? null);
  const lease4 = num(stats?.avg_leased_price_4bed ?? null);
  const anyLease = (stats?.leased_count_12months ?? 0) >= K_ANON_PRICE && (lease1 || lease2 || lease3 || lease4);

  return {
    salesSummary: {
      title: "Sales",
      body: salesCount > 0
        ? `Sale activity on ${streetName} in the recent period. Stats reflect closed transactions only.`
        : `No closed sales on record for ${streetName} in the recent period.`,
      stats: [
        { label: "Recent sales", value: String(salesCount) },
        { label: "Typical sold", value: typical && salesCount >= K_ANON_PRICE ? formatCADShort(roundPriceForProse(typical)) : "—" },
        { label: "Days on market", value: dom !== null ? String(Math.round(dom)) : "—" },
      ],
    },
    leasesSummary: (stats?.leased_count_12months ?? 0) > 0 ? {
      title: "Leases",
      body: `Rental activity on ${streetName} across recent months. Breakdown by bed count below.`,
      stats: [
        { label: "Recent leases", value: String(stats?.leased_count_12months ?? 0) },
        { label: "Typical rent", value: num(stats?.avg_leased_price ?? null) ? formatCADShort(roundPriceForProse(num(stats?.avg_leased_price ?? null)!)) : "—" },
        { label: "Days on market", value: num(stats?.avg_lease_dom ?? null) !== null ? String(Math.round(num(stats?.avg_lease_dom ?? null)!)) : "—" },
      ],
    } : undefined,
    // K-anonymity: don't publish a quarterly line chart when the street has fewer
    // than 5 total closed sales across the window. With a tiny sample, each quarter
    // reveals individual transaction prices on the line.
    priceChart: (quarterly.length >= 3 && (stats?.sold_count_12months ?? 0) >= K_ANON_PRICE) ? {
      data: quarterly,
      caption: `Typical sold price across all product types on ${streetName}, plotted with transaction volume.`,
    } : null,
    rentByBeds: anyLease ? [
      { label: "1 bed", value: lease1 ? formatCADShort(roundPriceForProse(lease1)) : "—", detail: "typical" },
      { label: "2 bed", value: lease2 ? formatCADShort(roundPriceForProse(lease2)) : "—", detail: "typical" },
      { label: "3 bed", value: lease3 ? formatCADShort(roundPriceForProse(lease3)) : "—", detail: "typical" },
      { label: "4+ bed", value: lease4 ? formatCADShort(roundPriceForProse(lease4)) : "—", detail: "typical" },
    ] : undefined,
    soldTable: [], // populated by the page when canSeeRecords = true
    canSeeRecords: false, // overridden by the page
    currentPath: `/streets/${slug}`,
    streetName,
    streetSlug: slug,
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

  return { categories };
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
        name: sample?.streetName ?? extractStreetName(sample?.address ?? s.streetSlug),
        avgPrice: Math.round(s._avg.price ?? 0),
        count: s._count,
      };
    })
  );

  const neighbourhoodCards = neighbourhoods
    .map(cleanNeighbourhoodName)
    .filter((n) => n.length > 0)
    .slice(0, 2)
    .map((n) => ({
      slug: n.toLowerCase().replace(/\s+/g, "-"),
      name: n,
      summary: `Explore the ${n} area of ${config.CITY_NAME}, its streets and comparable housing stock.`,
    }));

  const schoolCards = schools
    .filter((s) => neighbourhoods.some((n) => s.neighbourhood.includes(n) || n.includes(s.neighbourhood)))
    .slice(0, 4)
    .map((s) => ({ slug: s.slug, name: s.name, board: s.boardName, level: s.level === "secondary" ? "Secondary" : "Elementary" }));

  return {
    similarStreets,
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
      actionHref: "#valuation",
    },
    buyerCTA: {
      eyebrow: "For buyers",
      headline: `Buying on ${input.shortName}`,
      body: `Private access to new and upcoming listings before they go public.`,
      actionLabel: "Set an alert",
      actionHref: "#alerts",
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
    { id: "s8", text: `Active inventory on ${shortName} right now.` },
    { id: "s9", text: `How ${shortName} compares to nearby streets and schools.` },
    { id: "s10", text: `Common questions about ${shortName}.` },
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
