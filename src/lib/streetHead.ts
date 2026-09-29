// src/lib/streetHead.ts: the street page's <title> and meta description (MC-048).
//
// ONE TITLE FORMAT, ONE META SHAPE, BUILT ONLY FROM THE NAME AND THE TOWN'S ADDRESSES.
// Street pages earn the address click: a searcher typing a street name wants to know the page covers
// every address on it. So the head says what the page holds and nothing sold-derived: no $, no price
// figure, no sales count, no days, no "typical" or "median" (a figure in a snippet goes stale between
// crawls and is the most clickable token on the result, so it has to be the one that cannot drift).
// The words "sold history" are a promise of a section, not a figure.
//
// TITLE: `${name}, Milton: homes, sold history, prices | Miltonly`, at most 65 characters. Over 65,
// ", prices" goes; still over, " | Miltonly" goes; still over, `fits` is false and the prebuild test
// (scripts/test-street-head.ts) fails the build naming the streets. On 2026-09-27: 645 published
// streets fit the first rung, 75 the second, 2 the third (the two Nassagaweya townlines), 0 fail.
//
// META: `${count} addresses on ${name}, numbered ${low} to ${high}. Every one listed, with its sold
// history for registered readers. Free to register.`, at most 155; over 155, the last sentence goes.
// The count and the range are the Town's (townAddressesForSlug, the same records the page's address
// section prints as "The Town records N civic addresses on X, numbered" from the lowest to the
// highest). With no Town address data, or a single address, the street gets the one sentence that
// states no count, so no count is ever invented and no snippet reads "1 addresses".
//
// No en-dash or em-dash anywhere in either (the page's own range puts an en-dash between the two
// numbers; the head says "to"). Sentence case after the colon. og:title and twitter:title are the title.
//
// FROZEN until the 28-day GSC re-read (MC-048): no title, meta or H1 change on street pages before
// then, or the read compares two formats.
import type { Metadata } from "next";
import { config } from "@/lib/config";

export const STREET_TITLE_MAX = 65;
export const STREET_META_MAX = 155;

/**
 * The head for a slug with no page data (MC-050's proposal 2, landed in MC-047). The page itself
 * answers notFound(), but generateMetadata runs first and its answer was a title and nothing else:
 * no canonical and no robots, the one street head that declared no canonical. Of the 256 street
 * pages Google crawled, 12 declared none at crawl (MC-050). noindex closes that path; follow
 * stays true, so a crawler that lands on it still reaches the site. Not a title, meta or H1 change
 * to any served street page, so the MC-048 freeze does not hold it.
 */
export const STREET_NOT_FOUND_METADATA: Metadata = {
  title: "Street Not Found",
  robots: { index: false, follow: true },
};

/** The day the head changed (MC-048's deploy, UTC). The sitemap's street lastmod is at least this. */
export const STREET_HEAD_REVISED_AT = new Date("2026-09-28T00:00:00Z");

export interface StreetTitle {
  title: string;
  /** 1 full, 2 without ", prices", 3 without " | Miltonly" */
  rung: 1 | 2 | 3;
  /** false when even the third rung is over the ceiling: the prebuild test fails on it */
  fits: boolean;
}

export function streetTitle(name: string): StreetTitle {
  const head = `${name}, ${config.CITY_NAME}: homes, sold history`;
  const rungs = [`${head}, prices | ${config.SITE_NAME}`, `${head} | ${config.SITE_NAME}`, head];
  for (let i = 0; i < rungs.length; i++) {
    if (rungs[i].length <= STREET_TITLE_MAX) return { title: rungs[i], rung: (i + 1) as 1 | 2 | 3, fits: true };
  }
  return { title: head, rung: 3, fits: false };
}

export interface StreetAddressRange {
  count: number;
  low: number;
  high: number;
}

/** The Town's address count and range for a street, or null where it records fewer than two. */
export function addressRangeOf(numbers: readonly number[] | null | undefined): StreetAddressRange | null {
  if (!numbers || numbers.length < 2) return null;
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  if (!(low < high)) return null;
  return { count: numbers.length, low, high };
}

export interface StreetMeta {
  description: string;
  /** "addresses" in full, "addresses-short" without the last sentence, or "no-address-data" */
  shape: "addresses" | "addresses-short" | "no-address-data";
  fits: boolean;
}

export function streetMeta(name: string, range: StreetAddressRange | null): StreetMeta {
  if (range) {
    const lead = `${range.count} addresses on ${name}, numbered ${range.low} to ${range.high}. Every one listed, with its sold history for registered readers.`;
    const full = `${lead} Free to register.`;
    if (full.length <= STREET_META_MAX) return { description: full, shape: "addresses", fits: true };
    return { description: lead, shape: "addresses-short", fits: lead.length <= STREET_META_MAX };
  }
  const plain = `${name}, ${config.CITY_NAME}: every address on the street, with sold history for registered readers.`;
  return { description: plain, shape: "no-address-data", fits: plain.length <= STREET_META_MAX };
}
