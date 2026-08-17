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
