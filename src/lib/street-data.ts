// Street page data shaper. Composes a StreetPageData payload from DB1 (the street's listing
// rows and its StreetContent row), the Town's open data and the registry, and fills in the rest
// from deterministic helpers (geo POIs, schools roster, listing centroid).
//
// THE VISITOR VIEW IS IDX AND OPEN DATA ONLY (MC-046 Stage 1, PropTx VOW Best Practices item 40).
// Every value derived from a sold, leased, expired or terminated record left this payload: the
// typical price and its range, the sale and lease pills, the transaction counts, the glance
// tiles, the sidebar's market facts, the type cards' sold rows, the market cards, the rent grid,
// the quarterly chart, the neighbourhood typical and the latest-sale "updated" date. The DB2 and
// DB3 reads that fed them are gone with them, rather than computed and discarded, and so is the
// DB2 existence probe. This file opens no DB2 or DB3 connection and holds no SQL on the sold or
// analytics schemas; a cron-side caller of resolveSiblingSlugs injects its own door-opened
// reader for the DB2/DB3 slug candidates.
//
// The sold view for the street is the gated island (StreetSoldRecords), which reads
// /api/streets/<slug>/sold-records per session. Nothing here feeds it.

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { dataCached } from "./dataCache";
import { PUBLIC_LISTING_WHERE } from "@/lib/listings/vow";
import { LISTING_ROWS_TAG } from "./revalidateSurfaces";
// NAMING MOVED OUT (DEC-NAME-SOURCE Build 1). expandStreetName / shortNameFor / displayStreetName
// used to live in this file, behind its `import "server-only"` — which is why
// scripts/build-street-adjacency.ts had to grow a private copy that then drifted. They are now in
// the pure @/lib/streetName beside resolveStreetName, and re-exported here so every existing
// importer of street-data keeps working unchanged.
import { resolveStreetName, expandStreetName, shortNameFor, displayStreetName } from "@/lib/streetName";
export { expandStreetName, shortNameFor, displayStreetName, resolveStreetName };
import { config } from "./config";
import { buildStreetEnrichment } from "./streetEnrichment";
import { stripNumericSentences } from "./prose/numericSentences";
import { stripVowTopicSentences } from "./prose/vowTopic";
import { firstSentence } from "./prose/sentences";
import { haversineKm, hasValidCoords, driveMinutes, walkMinutes, MOSQUES, GROCERIES } from "./geo";
import { streetCentroidFor } from "./town/roadFacts";
import { buildAddressLadder, addressLadderEnabledFor } from "./streetAddresses";
import { schools } from "./schools";
import { extractStreetName, ruralSideRoadName, deriveIdentity } from "./streetUtils";
import { resolveStreetVideo } from "./streetVideo";
import { publishedHubSlugs as publishedHubSlugList, neighbourhoodRows, perRequest } from "./hubSets";
import { cleanNeighbourhoodName, roundPriceForProse } from "./format";
import { formatCADShort } from "./charts/theme";
import type {
  StreetPageData,
  StreetHeroProps,
  HeroStat,
  DescriptionBodyProps,
  DescriptionSidebarProps,
  TypeSectionProps,
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

const SITE_URL = config.SITE_URL;

/* ─────────────────────────────────────────────────────────────────────
   TYPE PEEKS — the DB3 monthly row shape the GENERATOR still reads
   (src/lib/ai/buildGeneratorInput.ts imports it with monthlyToQuarterly).
   The street render reads no DB3 row since MC-046.
   ───────────────────────────────────────────────────────────────────── */

export interface RawMonthly {
  year: number;
  month: number;
  avg_sold_price: string | null;
  sold_count: number;
  avg_dom: string | null;
  avg_sold_to_ask: string | null;
}
/* ─────────────────────────────────────────────────────────────────────
   SIBLING RESOLUTION (Step 13m-1)
   ───────────────────────────────────────────────────────────────────── */

/**
 * Given a slug, return all sibling slugs that share its identity (same base
 * token + same direction, ignoring suffix-token abbreviation variance).
 * The union is DB1 Listing plus whatever `vowCandidates` returns, so no physical-street data
 * source is missed. The returned list always includes the input slug itself.
 *
 * THE DB2/DB3 HALF IS INJECTED (MC-046, the one door). This file is imported by the street page,
 * an anonymous entry point, so it opens no DB2 or DB3 connection and holds no SQL on the sold or
 * analytics schemas. A cron-side caller (the generator, the decision gate) that wants the slugs
 * only sold.sold_records and analytics.street_sold_stats carry passes `vowCandidates`: a reader,
 * opened through src/lib/vow/door.ts, that returns the DISTINCT street_slug values of both
 * tables matching `likePattern`. Without it the union is DB1's alone.
 */
export async function resolveSiblingSlugs(
  slug: string,
  vowCandidates?: (likePattern: string) => Promise<string[]>,
): Promise<string[]> {
  const identity = deriveIdentity(slug);
  if (!identity) return [slug];
  // Narrow candidate pool via base-prefix LIKE queries on each data source.
  // Cheap (uses idx_sold_street_slug + streetSlug indexes) and bounded.
  const likePattern = `${identity.base}-%-${config.SLUG_SUFFIX}`;
  const [vowSlugs, db1Slugs] = await Promise.all([
    vowCandidates ? vowCandidates(likePattern).catch(() => [] as string[]) : Promise.resolve([] as string[]),
    listingSiblingCandidates(identity.base),
  ]);
  return siblingsFromPool(slug, [...vowSlugs, ...db1Slugs]);
}

/** DB1's candidate slugs for an identity base: every Listing streetSlug with that prefix. */
async function listingSiblingCandidates(base: string): Promise<string[]> {
  const rows = await prisma.listing.findMany({
    where: { streetSlug: { startsWith: `${base}-`, endsWith: `-${config.SLUG_SUFFIX}` } },
    distinct: ["streetSlug"],
    select: { streetSlug: true },
  });
  return rows.map((r) => r.streetSlug).filter((x): x is string => !!x);
}

/** The candidates that share `slug`'s identity (same base token and direction, suffix variance
 *  ignored), always including `slug` itself, sorted. Pure. */
export function siblingsFromPool(slug: string, candidates: Iterable<string>): string[] {
  const identity = deriveIdentity(slug);
  if (!identity) return [slug];
  const siblings: string[] = [];
  for (const s of Array.from(new Set([slug, ...Array.from(candidates)]))) {
    const id = deriveIdentity(s);
    if (id && id.identityKey === identity.identityKey) siblings.push(s);
  }
  if (!siblings.includes(slug)) siblings.push(slug);
  return siblings.sort();
}

/* ─────────────────────────────────────────────────────────────────────
   THE STREET'S LISTING ROWS (MC-034)
   ───────────────────────────────────────────────────────────────────── */

// The columns the render reads, and nothing else. Before MC-034 this pull selected every column
// (photos, description, the VOW-only facts) on every row of every street render, about 4.9 KB a
// row on the wire against about 200 B here, and it was half of DB1's daily egress. Each column
// below is read somewhere on the render: mlsNumber and address by the ladder and the inventory
// card, streetName and address by the name fallback (allListings[0]), neighbourhood by the hero
// and the schema, status by every active filter, permAdvertise by the ladder gate,
// propertySubType and propertyType by the ladder's form and the housing mix, price by the
// per-type list average and the card, bedrooms, bathrooms, parking and listOfficeName by the
// card, latitude and longitude by computeCentroid. The VOW-only columns are never selected
// (src/lib/listings/vow.ts); the card's photo is the first URL of the active rows only, read by
// readStreetListings below, because photos is the widest column and the card shows one.
// Sixteen columns since MC-036: displayAddress (InternetAddressDisplayYN) is read by the
// inventory card, which prints "Address on request" in place of a withheld address, and by
// the ladder, which skips a withheld row before deriving a house number from it. Without the
// column nothing downstream could tell a withheld address from a shown one. One boolean a row.
export const STREET_LISTING_SELECT = {
  mlsNumber: true,
  address: true,
  streetName: true,
  neighbourhood: true,
  status: true,
  permAdvertise: true,
  displayAddress: true,
  propertySubType: true,
  propertyType: true,
  price: true,
  bedrooms: true,
  bathrooms: true,
  parking: true,
  listOfficeName: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.ListingSelect;

export type StreetListing = Prisma.ListingGetPayload<{ select: typeof STREET_LISTING_SELECT }> & {
  /** the first photo URL, active rows only; null elsewhere */
  photo: string | null;
};

/** One read of a street's rows: the narrow select, then the first photo of each active row. */
async function readStreetListings(siblingSlugs: string[]): Promise<StreetListing[]> {
  // MC-046: public rows only (an active sale or an available lease). A sold, expired or leased row
  // is VOW data in its entirety: it may not name the street's neighbourhood, place a building form
  // on an address, or make the page exist.
  const rows = await prisma.listing.findMany({
    where: { ...PUBLIC_LISTING_WHERE, streetSlug: { in: siblingSlugs } },
    orderBy: { listedAt: "desc" },
    select: STREET_LISTING_SELECT,
  });
  const activeMls = rows.filter((r) => r.status === "active").map((r) => r.mlsNumber);
  const photos =
    activeMls.length > 0
      ? await prisma.$queryRaw<Array<{ mlsNumber: string; photo: string | null }>>`
          SELECT "mlsNumber", photos[1] AS photo FROM "public"."Listing"
          WHERE "mlsNumber" IN (${Prisma.join(activeMls)})`
      : [];
  const photoOf = new Map(photos.map((p) => [p.mlsNumber, p.photo]));
  return rows.map((r) => ({ ...r, photo: photoOf.get(r.mlsNumber) ?? null }));
}

// Three layers, each measured (MC-034). The select above cuts the bytes a row costs. React's
// cache() on getStreetPageData collapses generateMetadata and the page body into one read within
// a render pass. This Data Cache entry carries the rows across passes (the HTML and the RSC
// payload of one ISR revalidation are two passes) and across renders for up to an hour, the
// page's own ISR window. Its key carries a write stamp, one indexed row (the row count and the
// latest updatedAt of the street's rows, which every Prisma write bumps), so a listing sync
// that touches the street changes the key and the next render misses: unstable_cache serves a
// tag-dropped entry stale while it refreshes in the background, and a stamp in the key is what
// keeps a regeneration from rendering the rows as they were before the sync. The tag
// LISTING_ROWS_TAG is on the entry as well, and through it on every street page: dropped by
// revalidateListingSurfaces (src/lib/revalidateSurfaces.ts, called by /api/sync,
// /api/sync/detect and /api/sync/expire after a write) and by /api/revalidate { tag: "listings" },
// so the pages regenerate on their next visit after a sync rather than at their hour. Outside a
// Next server dataCached runs the read (a script sees live rows). Not the Upstash cached()
// helper: that one skips Redis under a static render.
async function streetListingsFor(siblingSlugs: string[]): Promise<StreetListing[]> {
  const stamp = await prisma.listing.aggregate({
    where: { streetSlug: { in: siblingSlugs }, permAdvertise: true },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  const written = `${stamp._count._all}:${stamp._max.updatedAt?.getTime() ?? 0}`;
  return dataCached(() => readStreetListings(siblingSlugs), ["street-listings:v3", written, ...siblingSlugs], {
    revalidate: 3600,
    tags: [LISTING_ROWS_TAG],
  })();
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN EXPORT
   ───────────────────────────────────────────────────────────────────── */

// Memoised per request (React.cache when it exists): generateMetadata and the page body both call
// it in one render, and a render pass reads the street once.
export const getStreetPageData = perRequest(async function getStreetPageData(slug: string): Promise<StreetPageData | null> {
  // Step 13m-1 — resolve sibling slugs that map to the same identity. The
  // slug-as-key model routed data under whichever slug MLS ingest produced
  // (usually the abbreviated form) while the render layer queried the
  // canonical slug (usually the full-word form) — 277 inversions across
  // the universe. Unioning across siblings restores data fidelity.
  // THE RENDER READS DB1 ONLY (MC-046). No DB2/DB3 candidate reader is passed: the page pools over
  // the DB1 siblings, which is every slug a row it shows can live under.
  const siblingSlugs = await resolveSiblingSlugs(slug);

  // TWO READS (MC-046). The street's DB1 rows and its StreetContent row. The DB3 street_sold_stats
  // and street_monthly_stats reads, the four DB2 aggregates (per-type, 12-month sale sample,
  // 12-month lease sample, per-bed rents) and the DB2 coordinate fallback fed only values that left
  // the visitor view, so they are not run at all. The DB2 existence probe went too: whether a page
  // answers 200 or 404 is itself a statement, and a page that existed only because a sold record
  // did told every visitor that one does. An anonymous render opens no DB2 or DB3 connection.
  const [allListings, streetContent] = await Promise.all([
    streetListingsFor(siblingSlugs),
    // StreetContent is keyed by slug too — prefer the sibling with non-empty
    // description if any. First non-null row wins.
    // MC-046: the columns the page uses, never the row (statsJson and the stored meta carry
    // VOW-derived figures from generation time).
    prisma.streetContent.findFirst({
      where: { streetSlug: { in: siblingSlugs } },
      select: {
        streetName: true, description: true, faqJson: true, generatedAt: true, neighbourhood: true,
        videoUrl: true, videoCapturedAt: true, nightVideoUrl: true, nightCapturedAt: true,
      },
    }),
  ]);

  // Existence gate — a street page renders only from a PRIMARY DB1 signal: listing rows on the
  // street, or a StreetContent row (every published street has one, DEC-PH41-DUALWRITE). DB3
  // analytics.street_sold_stats never was a basis (Registry cleanup 2026-07, the phantom-200
  // path), and since MC-046 neither is a DB2 sold record on its own.
  if (allListings.length === 0 && !streetContent) {
    return null;
  }

  // The street's live rows: the only listing rows any value on the page is computed from.
  const activeListings = allListings.filter((l) => l.status === "active");

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
  // The public rows' neighbourhoods, then the one the street's own StreetContent row carries, so a
  // published street with nothing listed today still names its neighbourhood (MC-046: never from
  // a sold or leased row).
  const neighbourhoods = dedupe(
    [...allListings.map((l) => l.neighbourhood), streetContent?.neighbourhood ?? null]
      .map((n) => cleanNeighbourhoodName(n ?? ""))
      .filter((n) => n.length > 0)
  );
  // THE STREET'S OWN POSITION, in preference order. The Town's centreline first: it describes
  // the whole street rather than wherever a few homes happen to have traded, and it exists for
  // 424 of the 426 published streets. The mean of the street's live listings is the fallback for
  // a street outside the Town's centreline coverage. The DB2 sold-record coordinate fallback
  // went with MC-046: a sold home's position is not read on the visitor path.
  let centroid = streetCentroidFor(slug);
  if (!centroid) centroid = computeCentroid(activeListings);

  // ─── Registry context ─────────────────────────────────────────────
  // The street's neighbourhood from the registry, and whether the street has any row on record
  // (for the noRecord prose guard). No sold or leased aggregate is read.
  const enrichment = await buildStreetEnrichment({
    slug,
    hasRecord: allListings.length > 0,
  });

  // ─── Hero ─────────────────────────────────────────────────────────
  const heroProps = buildHero({
    streetName,
    neighbourhoods,
    activeListings,
    streetContent,
  });

  // ─── Product type sections (active listings only) ─────────────────
  const productTypes = buildProductTypeSections({
    streetName,
    shortName,
    activeListings,
  });

  // ─── Description body + sidebar ───────────────────────────────────
  const descriptionBody = buildDescriptionBody(streetContent, streetName);
  const descriptionSidebar = buildSidebar({ streetName, centroid, neighbourhoods });

  // ─── Commute + nearby ─────────────────────────────────────────────
  const commuteGrid = buildCommuteGrid(centroid);

  // ─── Active inventory ─────────────────────────────────────────────
  const activeInventory = buildActiveInventory({
    listings: activeListings,
    streetName,
    shortName,
  });

  // ─── Context cards ────────────────────────────────────────────────
  const contextCards = await buildContextCards({
    slug,
    siblingSlugs,
    neighbourhoods,
    centroid,
  });

  // ─── Address ladder ───────────────────────────────────────────────
  // The Town's civic addresses for this street, joined to DB1 for form and live status only.
  // Sourced from the build-time projection, NOT from MLS: house numbers exist for every address
  // whether or not it has ever been listed, so the VOW question does not arise for the position
  // half. Null where the Town's address layer carries nothing for this identity.
  const addressLadder = addressLadderEnabledFor(slug)
    ? buildAddressLadder({
        slug,
        streetName,
        // A tick links only where StreetAdjacency already holds the pair, and every
        // connectedSlug in that table is a PUBLISHED street. Everything else renders as a
        // label. A cross street is a fact whether or not we have written its page; a link to
        // a page that does not exist is not.
        linkableSlugs: new Set(contextCards.connectedStreets.map((c) => c.slug)),
        listings: allListings.map((l) => ({
          address: l.address,
          mlsNumber: l.mlsNumber,
          status: l.status,
          permAdvertise: l.permAdvertise,
          displayAddress: l.displayAddress,
          propertySubType: l.propertySubType,
          propertyType: l.propertyType,
          listOfficeName: l.listOfficeName,
        })),
      })
    : null;


  // ─── FAQs ──────────────────────────────────────────────────────────
  const faqs = parseFaqs(streetContent?.faqJson);

  // ─── Final CTAs + corner widget ───────────────────────────────────
  const finalCTAs = buildFinalCTAs({ streetName, shortName });
  const cornerWidget = buildCornerWidget({
    streetName,
    shortName,
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
      // It is read by the Place JSON-LD description (street-schema.ts). Since MC-046 it also passes
      // the VOW topic filter (stripVowTopicSentences), so neither surface carries a claim about
      // price, sales, leases or the market.
      //
      // Empty string (not the neutral placeholder) when nothing survives the guards, so each
      // consumer falls through to its own fallback: the schema to its richer "A residential street
      // in <neighbourhoods>" line. The visible hero is unaffected — it reads heroProps.subtitle,
      // which still defaults to the neutral sentence.
      characterSummary: heroProps.suppressedSummary,
      coordinates: centroid ?? { lat: 43.5083, lng: -79.8822 },
    },
    heroProps,
    descriptionSidebar,
    descriptionBody,
    productTypes,
    // The glance grid and the market block left the visitor view whole (MC-046): every tile and
    // card in them was a sold or leased figure. The fields stay in the shared StreetPageData type
    // (src/types/street.ts) and carry nothing.
    glanceTiles: [],
    marketActivity: EMPTY_MARKET(streetName),
    commuteGrid,
    activeInventory,
    addressLadder,
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
    // THE UPDATED DATE IS THE PROFILE'S GENERATION DATE (MC-046, ruling R5). It used to be the
    // later of the generation and the most recent closed sale in the 12-month sample, which put
    // a sold date in og:modifiedTime, WebPage.dateModified and the visible "Updated" line on
    // every page. It is the generation's own date now, and never a sale's.
    lastUpdated: isoDate(streetContent?.generatedAt ?? null),
  };
});

/** The empty market block the shared type still requires. Nothing reads it for render. */
function EMPTY_MARKET(streetName: string): MarketActivityProps {
  return { salesSummary: { title: "Sales", body: "", stats: [] }, priceChart: null, streetName };
}

/** "2026-09-17" from a date, or today's date where the street has no StreetContent row. */
function isoDate(d: string | Date | null): string {
  const t = d ? (d instanceof Date ? d : new Date(d)) : null;
  return (t && !Number.isNaN(t.getTime()) ? t : new Date()).toISOString().slice(0, 10);
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


function computeCentroid(listings: StreetListing[]): { lat: number; lng: number } | null {
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

/** The stored FAQ bank (StreetContent.faqJson), or none. The page renders the generation's FAQ
 *  through mapStreetV2Data's filters, not this field. The fallback template that answered "What
 *  is the typical price" and "How fast do homes sell" from the sale sample left with MC-046: a
 *  price and a days-on-market answer are VOW figures, and nothing replaces them. */
function parseFaqs(faqJson: string | null | undefined): FAQItem[] {
  if (!faqJson) return [];
  try {
    const parsed = JSON.parse(faqJson) as Array<{ q: string; a: string }>;
    if (Array.isArray(parsed)) return parsed.map((f) => ({ question: f.q, answer: f.a }));
  } catch { /* fall through */ }
  return [];
}

/* ─────────────────────────────────────────────────────────────────────
   HERO
   ───────────────────────────────────────────────────────────────────── */

interface HeroBuildInput {
  streetName: string;
  neighbourhoods: string[];
  /** the street's live rows: the housing mix and the active count read these and nothing else */
  activeListings: StreetListing[];
  streetContent: { description: string } | null;
}

/** Any phrasing that asserts nothing has ever traded on the street. This is the detector for
 *  prose we did not author (stored generation output), not a source of copy: a stored sentence
 *  may not make an existence claim about the sold record on the visitor view (MC-046, R10). */
const ASSERTS_NO_SALES =
  /no (home )?resales? (are |have been )?recorded|no recent turnover|yet to (trade|sell|change hands)|no homes have (sold|traded)|never (sold|traded)|until a home[^.]*trades|nothing has (traded|sold)/i;

function buildHero(input: HeroBuildInput): StreetHeroProps {
  const { streetName, neighbourhoods, activeListings, streetContent } = input;
  const cleanNbhds = neighbourhoods.map(cleanNeighbourhoodName).filter(Boolean);
  const eyebrow = `Street Profile · ${cleanNbhds.slice(0, 3).join(" · ") || config.CITY_NAME} · ${config.CITY_NAME}, ${config.CITY_PROVINCE_CODE}`;
  // The hero summary is STORED generation output (StreetContent.description). Three passes, in
  // order: every numeric sentence goes (compliance suppression; no figure on the page licenses
  // one, so no published-figure option is set), then every sentence on a VOW topic (price,
  // sales, leases, rents, the market: MC-046, R1), then the absence guard. What survives is the
  // subtitle; where nothing does, the neutral line below.
  const rawSummary = streetContent?.description
    ? stripVowTopicSentences(stripNumericSentences(characterSummaryFrom(streetContent.description), { standalone: true }))
    : null;
  const summaryClaimsAbsence = rawSummary != null && ASSERTS_NO_SALES.test(rawSummary);
  // The suppressed sentence, or "" when it did not survive the guards. Kept SEPARATE from the
  // neutral fallback below so downstream surfaces can tell "we have nothing to say about this
  // street" apart from "here is a sentence", and fall through to their own fallback instead of
  // publishing the placeholder. street.characterSummary is set from THIS value.
  const suppressedSummary =
    rawSummary && !summaryClaimsAbsence ? rawSummary : "";
  // A PROGRAMME PAGE'S SUBTITLE IS A FACT OR NOTHING (MH-005, MA-001 defect 17). "A street in
  // Milton Ontario." was the placeholder on every page with no surviving summary. The
  // neighbourhood is a fact the page has; where it has none, the hero carries no subtitle.
  const firstNbhd = neighbourhoods.map(cleanNeighbourhoodName).find(Boolean);
  const subtitle = suppressedSummary || (firstNbhd ? `${streetName} is in ${firstNbhd}, ${config.CITY_NAME}.` : "");

  // IDX TILES ONLY (MC-046). The typical price, its range and basis, and "Transactions tracked"
  // were sold and leased figures; they left the hero, and so did the sale and lease pills.
  const heroStats: HeroStat[] = [];
  heroStats.push({
    label: "Active right now",
    value: String(activeListings.length),
    sub: "live listings · today",
  });
  const mix = housingMix(activeListings);
  if (mix) heroStats.push({ label: "Housing mix", value: mix.primary, sub: mix.description || undefined });

  return {
    eyebrow,
    streetName,
    subtitle,
    suppressedSummary,
    heroStats,
    productTypePills: [],
    rawTypicalPrice: null,
  };
}

/** The mix of the street's LIVE listings, by type. It was read off the 12-month sold sample,
 *  which made it a description of what sold; it describes what is listed now, or nothing. */
function housingMix(activeListings: StreetListing[]): { primary: string; description: string } | null {
  const counts: Record<string, number> = {};
  for (const l of activeListings) counts[l.propertyType] = (counts[l.propertyType] ?? 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
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

// A TYPE CARD IS A TYPE LISTED NOW (MC-046). It rendered for a type that cleared k>=5 on sold
// price and carried the typical, the band, days on market, sold to ask, the closed-sale count
// and a quarterly sold chart. All of that was VOW; the card's very presence said "five or more
// of these sold here". It now renders for a type with an active listing, and states the count
// and the mean asking price of those listings, labelled asking.
function buildProductTypeSections(input: {
  streetName: string;
  shortName: string;
  activeListings: StreetListing[];
}): TypeSectionProps[] {
  const { streetName, shortName, activeListings } = input;

  const types: ProductTypeKey[] = ["detached", "semi", "townhouse", "condo"];
  const sections: TypeSectionProps[] = [];

  for (const type of types) {
    const activeForType = activeListings.filter((l) => l.propertyType === type);
    if (activeForType.length === 0) continue;
    const n = activeForType.length;
    const priceSum = activeForType.reduce((s, l) => s + l.price, 0);
    const avgAsking = priceSum > 0 ? roundPriceForProse(priceSum / n) : 0;
    const statsSold: StatCell[] = [
      {
        label: "Active listings",
        value: String(n),
        ...(avgAsking > 0 ? { detail: `avg asking ${formatCADShort(avgAsking)}` } : {}),
      },
    ];
    const noun = displayNameFor(type).toLowerCase();
    sections.push({
      type,
      displayName: displayNameFor(type),
      hasData: true,
      intro: `${n === 1 ? `One ${noun} home is` : `${n} ${noun} homes are`} listed for sale on ${streetName} now.`,
      streetName,
      streetShort: shortName,
      typicalPrice: 0,
      statsSold,
    });
  }

  return sections;
}

// Used by the generator (src/lib/ai/buildGeneratorInput.ts), not by the street render.
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

// SIDEBAR FACTS ARE REGISTRY FACTS (MC-046). The typical price, the price band, the typical
// days on market and "Sales tracked" were sold figures and left the visitor view; the
// neighbourhood stays. The road facts card beside it is the Town's (geometryFactsFor).
function buildSidebar(input: {
  streetName: string;
  centroid: { lat: number; lng: number } | null;
  neighbourhoods: string[];
}): DescriptionSidebarProps {
  const { streetName, centroid, neighbourhoods } = input;

  const facts: Record<string, string> = {};
  const cleanNbhds = neighbourhoods.map(cleanNeighbourhoodName).filter(Boolean);
  facts["Neighbourhood"] = cleanNbhds.slice(0, 2).join(", ") || config.CITY_NAME;

  return {
    streetFacts: facts,
    // POI names survive (they are genuinely Milton locations); the minute figures do not,
    // until a per-street coordinate exists to derive them from.
    nearbyPlaces: nearbyPlacesFor(centroid)
      .slice(0, 6)
      .map((p) => (isStreetSpecificCoord(centroid) ? p : { ...p, distance: null })),
    sidebarCTA: {
      eyebrow: `For ${streetName} owners`,
      headline: `What is yours worth today?`,
      // It promised a conversation "grounded in every sale we have tracked on" the street: a
      // claim about the sold record, true or false by street (MC-046, R10). The offer stands.
      body: `A short, private conversation about your home on ${streetName}.`,
      actionLabel: "Request a valuation",
      actionHref: "/sell",
      // "Response within one hour" was a service level nothing measures (MA-001 defect 9).
      trustLine: "Complimentary. No obligation.",
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
  listings: StreetListing[];
  streetName: string;
  shortName: string;
}): ActiveInventoryProps {
  return {
    // A withheld address (InternetAddressDisplayYN = N) is counted on the street and never carded
    // on it: a card under "Active listings on {street}" ties the listing to the street, which the
    // rule forbids as much as printing the number. The count above the cards keeps the row.
    total: input.listings.length,
    listings: input.listings.filter((l) => l.displayAddress).map((l) => ({
      mlsNumber: l.mlsNumber,
      // InternetAddressDisplayYN = N (MC-036): the address is not shown on any surface. The
      // row keeps its price, type, beds, baths, brokerage and link; only the address line
      // changes, to the placeholder every other surface prints.
      address: l.displayAddress ? l.address : "Address on request",
      price: l.price,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      parking: l.parking,
      propertyType: l.propertyType,
      listOfficeName: l.listOfficeName ?? null,
      photo: l.photo ?? undefined,
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
  siblingSlugs: string[];
  neighbourhoods: string[];
  centroid: { lat: number; lng: number } | null;
}): Promise<ContextCardsProps> {
  const { slug, siblingSlugs, neighbourhoods } = input;

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

  // THE UP-LINK IS THE REGISTRY'S HUB, AND ONLY THAT (MC-027 item 5, MA-005 defect 8). It used
  // to be resolved from the sold records' neighbourhood strings on the street, while the hub's
  // ladder is the registry (ResidentialStreet.neighbourhoodId): seven streets on five hubs
  // linked up to a hub whose ladder did not list them, and two ladder leaders linked nowhere.
  // One source now: the street's registry row (the first sibling slug that carries one), and
  // only when that hub is published. A street the Town's polygons never placed gets no card,
  // never a guess from a listing agent's string. scripts/hub-membership-reconcile.ts lists
  // where the records and the registry disagree.
  const [pubHubSlugList, nbhdRows] = await Promise.all([publishedHubSlugList(), neighbourhoodRows()]);
  const publishedHubSlugs = new Set(pubHubSlugList);
  const registryRows = await prisma.residentialStreet.findMany({
    where: { slug: { in: siblingSlugs }, neighbourhoodId: { not: null } },
    select: { slug: true, neighbourhood: { select: { slug: true, name: true } } },
  });
  const registryHub = [slug, ...siblingSlugs]
    .map((sl) => registryRows.find((r) => r.slug === sl)?.neighbourhood ?? null)
    .find((h): h is { slug: string; name: string } => h !== null && h !== undefined) ?? null;
  const neighbourhoodCards: Array<{ slug: string; name: string; summary: string }> = [];
  if (registryHub && publishedHubSlugs.has(registryHub.slug)) {
    const name = nbhdRows.find((nb) => nb.slug === registryHub.slug)?.name ?? registryHub.name;
    neighbourhoodCards.push({
      slug: registryHub.slug,
      name,
      summary: `Explore the ${name} area of ${config.CITY_NAME}, its streets and comparable housing stock.`,
    });
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

// THE RESOLVED NAME IN THE HEADINGS (MH-008). These read "Selling on Main" and "Buying on
// Asleton": shortName is the prose form and never appears in a heading (CLAUDE.md, Names). The
// alert body promised "access before they go public", which nothing on the site does; the
// alert emails when a home on the street is listed for sale (StreetAlertCTA, street-alert):
// /api/alerts/match reads new active listings and nothing else, so the card says listed, not
// "listed or sold", until a sold alert exists (ML-004).
// The seller body promised a conversation "grounded in every sale we have tracked on" the
// street, a claim about the sold record (MC-046, R10). The offer is the same; the claim is gone.
function buildFinalCTAs(input: { streetName: string; shortName: string }): FinalCTAsProps {
  void input.shortName;
  return {
    sellerCTA: {
      eyebrow: "For owners",
      headline: `Selling on ${input.streetName}`,
      body: `A private conversation about your home on ${input.streetName} and what is listed around it, before you decide anything.`,
      actionLabel: "Request a valuation",
      actionHref: "/sell",
    },
    buyerCTA: {
      eyebrow: "For buyers",
      headline: `Buying on ${input.streetName}`,
      body: `An email when a home on ${input.streetName} is listed for sale. Nothing else, and no account.`,
      actionLabel: "Set an alert",
      actionHref: "/listings",
      secondary: true,
    },
  };
}

// Retired component's data (src/components/street/retired/CornerWidget.tsx renders nowhere). It
// carried the typical and the transaction count; it carries neither now (MC-046).
function buildCornerWidget(input: {
  streetName: string;
  shortName: string;
  productTypes: TypeSectionProps[];
}): CornerWidgetProps {
  const { streetName, shortName, productTypes } = input;
  const sectionInsights: SectionInsight[] = [
    { id: "s1", text: `Where you land on ${streetName} shapes what you are buying.` },
    ...productTypes.map((p) => ({
      id: `type-${p.type}`,
      text: `${p.displayName}: listed now · see details inline.`,
    })),
    { id: "s5", text: `The fine details that distinguish ${streetName}.` },
    { id: "s7", text: `Commute reach from ${streetName}.` },
    { id: "s8", text: `Active inventory on ${streetName} right now.` },
    { id: "s9", text: `How ${streetName} compares to nearby streets and schools.` },
    { id: "s10", text: `Common questions about ${streetName}.` },
  ];

  return {
    streetName,
    streetShort: shortName,
    heroHeadline: "Live street data",
    sectionInsights,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   URL / CANONICAL
   ───────────────────────────────────────────────────────────────────── */

export function canonicalUrlFor(slug: string): string {
  return `${SITE_URL}/streets/${slug}`;
}
