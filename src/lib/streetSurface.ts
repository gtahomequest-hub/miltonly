// src/lib/streetSurface.ts
// The single source of truth for "is this ResidentialStreet entity surfaced?"
//
// Registry ingest (2026-07): the site holds an entity for every official Milton
// street (944), but a bare/dormant entity (0 sold, 0 listings, unpublished) would
// render a 404 at /streets/[slug]. So entities are surfaced in hero search,
// autocomplete, and hub street lists ONLY when they render a real page:
//   recencyWeightedSold > 0   (has sold history — the ~500 that render today)
//   OR a PUBLISHED StreetContent row  (a page was deliberately published — e.g.
//                              the minimal-template new-construction pages)
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THE SECOND CLAUSE IS A QUERY AND NO LONGER A COLUMN
//
// It used to read `hasPublishedPage`, a boolean on ResidentialStreet. That column is a
// denormalised copy of a fact that lives in StreetContent.status, and nothing kept the copy
// honest: generateStreet.ts — the ONLY path that publishes a page — writes StreetContent.status
// and publishedAt and never touches the flag. Three separate hand-run scripts set it
// (registry-minimal-publish, publish-redirect-targets, registry-entity-backfill phase 3), so the
// flag was only ever as current as the last time somebody remembered to reconcile it.
//
// It had drifted on 6 rows — geddes-landing, blacklock-street, jelinik-terrace, caldwell-crescent,
// alder-gate, symons-crossing — every one of them a street with a LIVE PUBLISHED PAGE that the
// flag called unpublished. They were therefore missing from autocomplete, from hero search, from
// the homepage street count and from their hub's ladder. And the drift is what let a geometric
// neighbourhood assignment reach a live page during the join work, because that script trusted
// the flag to mean "renders nothing".
//
// A denormalised copy that can drift will drift. So the predicate now DERIVES publication from
// StreetContent every time it is asked, and there is nothing left to synchronise. One extra
// indexed query, memoised per request.
//
// `hasPublishedPage` is now READ BY NOTHING. Dropping the column is the next step and is
// deliberately NOT done in the same change: one Neon instance serves production and every
// preview, so removing a column that the currently-deployed build still selects would break the
// homepage and every hub for the length of a deploy. Drop it once this is live.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import * as React from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * React's cache() exists only under the react-server condition. Next resolves it; a Node script
 * running this module through tsx gets `undefined` and used to die with
 * "import_react.cache is not a function" — which broke every diagnostic that imports
 * buildHubInput. Scripts are single-shot processes where per-request memoisation buys nothing, so
 * they fall through to the bare function.
 */
const perRequest = <T>(fn: T): T => {
  const c = (React as unknown as { cache?: (f: T) => T }).cache;
  return typeof c === "function" ? c(fn) : fn;
};

/** Slugs with a published StreetContent row. Memoised for the request. */
export const publishedStreetSlugs = perRequest(async (): Promise<string[]> => {
  const rows = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true },
  });
  return rows.map((r) => r.streetSlug);
});

/**
 * THE PUBLISHED STREET PAGES. Slugs that both carry a published StreetContent row AND exist as
 * a ResidentialStreet entity, which is exactly the set src/app/sitemap.ts emits under /streets/.
 *
 * WHY THE SECOND CONDITION IS NOT OPTIONAL, and why this is a function rather than a count each
 * caller writes for itself. `StreetContent.status = 'published'` alone returns 445 rows; one of
 * them, `15-side-road-side-road-milton`, is a machine-made address artifact with no entity behind
 * it, and the sitemap refuses it for that reason. A surface that counts 445 and a sitemap that
 * emits 444 are describing two different things while using one word.
 *
 * The homepage's proof point published "738 streets with their own page" before this existed. 738
 * was `surfacedStreetWhere()`'s count: entities with sold history OR a published page, the set
 * that decides what may appear in search and in a hub ladder. It is a real number and it counts
 * streets we can say something about; it has never been the number of pages. Anything claiming a
 * page count reads THIS, and so does the sitemap, so the two cannot drift apart again.
 */
export const publishedStreetPageSlugs = perRequest(async (): Promise<string[]> => {
  const [published, entities] = await Promise.all([
    prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } }),
    prisma.residentialStreet.findMany({ select: { slug: true } }),
  ]);
  const entitySlugs = new Set(entities.map((e) => e.slug));
  return published.map((r) => r.streetSlug).filter((slug) => entitySlugs.has(slug));
});

/** How many street pages are published. The count of the set above, never a second query. */
export async function publishedStreetPageCount(): Promise<number> {
  return (await publishedStreetPageSlugs()).length;
}

/**
 * The surfacing predicate, derived. Use everywhere `SURFACED_STREET_WHERE` used to appear —
 * including inside a relation `_count`, where it is still just a filter object.
 *
 * NON-RESIDENTIAL ENTITIES ARE EXCLUDED UNCONDITIONALLY. The 22 streets inside the Town's
 * "401 Industrial Area" polygon (industrial-drive, wheelabrator-way, market-drive …) are marked
 * isResidential=false so that a single industrial unit trading can never auto-promote them into
 * a residential surface. That is a property of the street, not of its activity, so it sits
 * outside the OR rather than inside it.
 */
export async function surfacedStreetWhere(): Promise<Prisma.ResidentialStreetWhereInput> {
  const published = await publishedStreetSlugs();
  return {
    isResidential: true,
    OR: [{ recencyWeightedSold: { gt: 0 } }, { slug: { in: published } }],
  };
}

// The hub street-ladder cap. The /neighbourhoods/[slug]/streets OVERFLOW page (and the hub's
// "View all streets →" link, and its sitemap entry) only exist when a neighbourhood has MORE
// published streets than the ladder can show — otherwise the ladder already links every published
// street and the overflow page would be redundant + thin (scaled-content risk). Floor = published
// street count STRICTLY GREATER THAN this cap.
export const HUB_STREET_LADDER_CAP = 12;
