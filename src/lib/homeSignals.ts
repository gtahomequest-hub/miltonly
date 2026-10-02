// src/lib/homeSignals.ts
// The "Milton right now" reads the homepage and the menu need and nothing else had.
// READ-ONLY. Nothing in this file writes, and nothing in it invents a figure that
// its source cannot support.
//
// PUBLIC ROWS ONLY (MC-046 Stage 1, PropTx VOW Best Practices item 40). Every read here is
// over active IDX listings or the street video registry. "Sold so far this month" and its
// typical left the homepage and the menu with Stage 1, and so did the DB2 read behind them:
// a sold count is VOW-derived however it is labelled, and it is not computed to be discarded.
//
// WHAT IS DELIBERATELY ABSENT: a price-drop count. Which listing changed price, and from
// what, is price history (VOW); so is a count of changes across the market (MC-046 R8).
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { resolveStreetName } from "@/lib/streetName";
import { deriveVideoPoster, torontoWall } from "@/lib/streetVideo";

const WEEK_MS = 7 * 86_400_000;

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
// ON THE MARKET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active listings advertised today, Milton-wide: the hero's "homes for sale today" and the
 * menu's "N for sale". The predicate is the one buildMiltonWideContext() counted with, so the
 * figure does not move; it is read here so neither caller runs that context's sold queries
 * for one active count (MC-046 Stage 1).
 */
export async function getOnMarketCount(): Promise<number> {
  return prisma.listing.count({ where: { permAdvertise: true, status: "active" } });
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
    // the Toronto date of the instant, never its UTC date (a 9:40 pm capture is the next day in UTC)
    const capturedAt = torontoWall(useDay ? r.videoCapturedAt : r.nightCapturedAt)?.date ?? null;
    cards.push({
      slug: r.streetSlug,
      // resolveStreetName is the only source of a street name on any surface.
      name: resolveStreetName(r.streetSlug, r.streetName).name,
      poster,
      variant: useDay ? "day" : "night",
      capturedAt,
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
    // the Toronto date of the instant, never its UTC date (a 9:40 pm capture is the next day in UTC)
    const capturedAt = torontoWall(useDay ? r.videoCapturedAt : r.nightCapturedAt)?.date ?? null;
    cards.push({
      slug: r.streetSlug,
      name: resolveStreetName(r.streetSlug, r.streetName).name,
      poster,
      variant: useDay ? "day" : "night",
      capturedAt,
    });
  }
  cards.sort((a, b) => (b.capturedAt ?? "").localeCompare(a.capturedAt ?? ""));
  return cards.slice(0, limit);
}
