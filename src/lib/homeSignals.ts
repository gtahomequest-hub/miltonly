// src/lib/homeSignals.ts
// The three "Milton right now" reads the homepage needs and nothing else had.
// READ-ONLY. Nothing in this file writes, and nothing in it invents a figure that
// its source cannot support.
//
// WHAT IS DELIBERATELY ABSENT: a price-drop count. The only signal DB1 carries is
// `Listing.lastPriceChangeAt`, which records THAT a price changed and never what it
// changed from. A drop cannot be told from an increase without a prior price, and
// there is no prior price stored. Until one is, this file offers no such function,
// so no surface can accidentally publish "dropped" over a figure that only means
// "changed". See DEC-PRICE-CHANGE-NOT-DROP in the report.
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getSoldDb } from "@/lib/db";
import { cached, CACHE_TTL } from "@/lib/cache";
import { K_ANON_PRICE } from "@/lib/kAnon";
import { resolveStreetName } from "@/lib/streetName";
import { deriveVideoPoster } from "@/lib/streetVideo";

const WEEK_MS = 7 * 86_400_000;
const round5k = (n: number) => Math.round(n / 5000) * 5000;

// ─────────────────────────────────────────────────────────────────────────────
// NEW THIS WEEK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active sale listings first advertised in the last 7 days.
 *
 * `listedAt` is the field the rentals surfaces already count this way, and it is the
 * only listing-age field DB1 carries that is not derived. Sale side only: a lease
 * coming to market is a different market and folding the two would inflate the figure.
 */
export async function getNewThisWeekCount(): Promise<number> {
  return prisma.listing.count({
    where: {
      status: "active",
      permAdvertise: true,
      city: config.PRISMA_CITY_VALUE,
      transactionType: { not: "For Lease" },
      listedAt: { gte: new Date(Date.now() - WEEK_MS) },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLD SO FAR THIS MONTH
// ─────────────────────────────────────────────────────────────────────────────

export interface SoldThisMonth {
  count: number;
  /** k-gated: null below K_ANON_PRICE, never 0 */
  typicalPrice: number | null;
  /** the last day included, ISO — the label must say "so far", because it is */
  through: string;
}

/**
 * Calendar month to date, Milton, sale side, from DB2.
 *
 * TWO THINGS THE LABEL HAS TO CARRY, and the caller is why they are returned rather
 * than assumed. (1) It is MONTH TO DATE, not a month: on the 3rd it is three days of
 * sales and it will look like a collapse beside a full month if the copy pretends
 * otherwise. (2) Sold records arrive with a reporting lag, so even the completed days
 * are still filling in. "Sold so far this month" is honest; "sold this month" is not.
 *
 * The price is the same statistic the hero and the Board publish (the midpoint of the
 * pool), gated at K_ANON_PRICE and rounded the way every other price on the site is.
 * Suppression returns null, never 0.
 */
export async function getSoldThisMonth(): Promise<SoldThisMonth> {
  const through = new Date().toISOString().slice(0, 10);
  const db = getSoldDb();
  if (!db) return { count: 0, typicalPrice: null, through };
  return cached(`home:sold-mtd:${through}`, CACHE_TTL.stats, async () => {
    const rows = (await db`
      SELECT COUNT(*)::int AS n,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS typical
      FROM sold.sold_records
      WHERE city = ${config.PRISMA_CITY_VALUE} AND perm_advertise = TRUE
        AND transaction_type = 'For Sale'
        AND sold_date >= date_trunc('month', NOW()) AND sold_date <= NOW()
    `) as Array<{ n: number; typical: unknown }>;
    const r = rows[0];
    const count = Number(r?.n ?? 0);
    const raw = r?.typical == null ? null : Number(r.typical);
    const typicalPrice =
      count >= K_ANON_PRICE && raw !== null && Number.isFinite(raw) ? round5k(raw) : null;
    return { count, typicalPrice, through };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STREETS WITH VIDEO
// ─────────────────────────────────────────────────────────────────────────────

export interface StreetVideoCard {
  slug: string;
  name: string;
  poster: string;
  /** "day" | "night" — the strip labels overnight clips, because they answer different questions */
  variant: "day" | "night";
  capturedAt: string | null;
}

/**
 * Published streets carrying a clip, newest capture first.
 *
 * THE POSTER IS THE GATE. `deriveVideoPoster` is the one place a poster URL comes from
 * (name convention, no poster column), and it returns null for any URL it cannot rewrite.
 * A card with no poster is a grey box, so a row without one is dropped here rather than
 * rendered empty. This is the same rule the VideoObject follows: no thumbnail, no entry.
 *
 * Day is preferred when a street carries both — the strip is a browse surface and a lit
 * frame reads at 200px where an overnight one does not. The street page still shows both.
 */
export async function getStreetsWithVideo(limit = 12): Promise<StreetVideoCard[]> {
  const rows = await prisma.streetContent.findMany({
    where: {
      status: "published",
      OR: [{ videoUrl: { not: null } }, { nightVideoUrl: { not: null } }],
    },
    select: {
      streetSlug: true,
      streetName: true,
      videoUrl: true,
      videoCapturedAt: true,
      nightVideoUrl: true,
      nightCapturedAt: true,
    },
  });

  const cards: StreetVideoCard[] = [];
  for (const r of rows) {
    const useDay = r.videoUrl !== null;
    const url = useDay ? r.videoUrl : r.nightVideoUrl;
    if (!url) continue;
    const poster = deriveVideoPoster(url);
    if (!poster) continue; // no thumbnail, no card
    const capturedAt = useDay ? r.videoCapturedAt : r.nightCapturedAt;
    cards.push({
      slug: r.streetSlug,
      // resolveStreetName is the only source of a street name on any surface.
      name: resolveStreetName(r.streetSlug, r.streetName).name,
      poster,
      variant: useDay ? "day" : "night",
      capturedAt: capturedAt ? capturedAt.toISOString().slice(0, 10) : null,
    });
  }

  cards.sort((a, b) => (b.capturedAt ?? "").localeCompare(a.capturedAt ?? ""));
  return cards.slice(0, limit);
}

/** How many published streets carry a clip at all — the strip states its own total. */
export async function getStreetVideoCount(): Promise<number> {
  return prisma.streetContent.count({
    where: {
      status: "published",
      OR: [{ videoUrl: { not: null } }, { nightVideoUrl: { not: null } }],
    },
  });
}

/**
 * Which published streets carry a clip, as a set of slugs.
 *
 * The hub ladder needs to MARK filmed streets, not render them, so it needs membership rather
 * than the card. One query, one set, no poster derivation for streets nobody is showing.
 */
export async function getVideoStreetSlugs(): Promise<Set<string>> {
  const rows = await prisma.streetContent.findMany({
    where: {
      status: "published",
      OR: [{ videoUrl: { not: null } }, { nightVideoUrl: { not: null } }],
    },
    select: { streetSlug: true },
  });
  return new Set(rows.map((r) => r.streetSlug));
}

/**
 * The filmed streets belonging to one neighbourhood, as cards.
 *
 * Same poster gate as the corpus-wide version: a row whose poster URL cannot be derived is
 * dropped rather than rendered as a grey box.
 */
export async function getStreetsWithVideoForSlugs(slugs: string[], limit = 8): Promise<StreetVideoCard[]> {
  if (slugs.length === 0) return [];
  const rows = await prisma.streetContent.findMany({
    where: {
      status: "published",
      streetSlug: { in: slugs },
      OR: [{ videoUrl: { not: null } }, { nightVideoUrl: { not: null } }],
    },
    select: {
      streetSlug: true, streetName: true,
      videoUrl: true, videoCapturedAt: true,
      nightVideoUrl: true, nightCapturedAt: true,
    },
  });

  const cards: StreetVideoCard[] = [];
  for (const r of rows) {
    const useDay = r.videoUrl !== null;
    const url = useDay ? r.videoUrl : r.nightVideoUrl;
    if (!url) continue;
    const poster = deriveVideoPoster(url);
    if (!poster) continue;
    const capturedAt = useDay ? r.videoCapturedAt : r.nightCapturedAt;
    cards.push({
      slug: r.streetSlug,
      name: resolveStreetName(r.streetSlug, r.streetName).name,
      poster,
      variant: useDay ? "day" : "night",
      capturedAt: capturedAt ? capturedAt.toISOString().slice(0, 10) : null,
    });
  }
  cards.sort((a, b) => (b.capturedAt ?? "").localeCompare(a.capturedAt ?? ""));
  return cards.slice(0, limit);
}
