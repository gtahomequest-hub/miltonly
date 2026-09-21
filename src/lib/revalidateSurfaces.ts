import { revalidatePath, revalidateTag } from "next/cache";

// MC-017 (2026-09-13). Hub, condo, guide and listing pages are ISR (a day, tagged), not rendered
// per request, so every write that changes what they show drops them here and the next visit
// renders once. The db2 tag (sold rows) is dropped by the sold sync and the db3 tag (analytics)
// by the compute jobs; this file is the path side: the DB1 rows those pages read through Prisma,
// which carry no cache tag.
//
// GUARDED ON PURPOSE, as generateStreet's revalidateStreetSurfaces is: revalidatePath needs a
// request-scoped incremental cache. A route handler has one, a script does not, and a script must
// not die because it cannot purge a cache it was never able to reach.
function purge(paths: string[], who: string): string[] {
  const done: string[] = [];
  for (const p of paths) {
    try {
      // "page" purges every path under a dynamic segment ("/listings/[mlsNumber]"); a literal
      // path purges one page.
      if (p.includes("[")) revalidatePath(p, "page");
      else revalidatePath(p);
      done.push(p);
    } catch (e) {
      console.log(`[${who}] revalidate skipped for ${p} (no request scope): ${String((e as Error).message).slice(0, 90)}`);
    }
  }
  if (done.length > 0) console.log(`[${who}] revalidated: ${done.join(", ")}`);
  return done;
}

/** The Data Cache tag on the street render's Listing rows (MC-034, src/lib/street-data.ts
 *  readStreetListings). Dropped here after every listing write, so a street page never shows a
 *  listing the feed has closed for longer than the page's own hour; /api/revalidate accepts it
 *  for the runners outside the app. */
export const LISTING_ROWS_TAG = "listings";

/** After a listing sync that created, updated or expired rows: every listing page, every condo
 *  page (its unit list), every hub (its active counts), the three indexes, and the tag the
 *  street render's Listing rows are cached under. */
export function revalidateListingSurfaces(who: string): string[] {
  try {
    revalidateTag(LISTING_ROWS_TAG);
    console.log(`[${who}] revalidated tag: ${LISTING_ROWS_TAG}`);
  } catch (e) {
    console.log(`[${who}] tag drop skipped for ${LISTING_ROWS_TAG} (no request scope): ${String((e as Error).message).slice(0, 90)}`);
  }
  return purge(
    [
      "/listings/[mlsNumber]",
      "/condos/[slug]",
      "/neighbourhoods/[slug]",
      "/condos",
      "/neighbourhoods",
    ],
    who,
  );
}

/** After a HubContent write. */
export function revalidateHubSurfaces(neighbourhoodSlug: string, who: string): string[] {
  return purge([`/neighbourhoods/${neighbourhoodSlug}`, "/neighbourhoods"], who);
}

/** After a CondoContent write. */
export function revalidateCondoSurfaces(buildingSlug: string, who: string): string[] {
  return purge([`/condos/${buildingSlug}`, "/condos"], who);
}
