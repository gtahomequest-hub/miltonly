// src/lib/rentalStreetPage.ts
//
// THE STREET LINK ON A RENTAL CARD (ML-012, 2026-09-24). RentalsClient built it on the client from
// the address text, unit included: "115 Nipissing Road 2004" became /streets/nipissing-road-2004
// and "1 Yates Drive Bsmt" became /streets/yates-drive-1-bsmt. MA-010 measured 115 such links
// across /rentals, /rent and two hub views on 2026-09-23, every one a 404, and not one of the 181
// card links was canonical: the rest reached their page only through the middleware's suffix 301.
//
// The link now comes from the row's own streetSlug, resolved the way the middleware resolves an
// inbound URL (the curated map, then the identity rule), and kept only when the result is a
// published street page: the set publishedStreetPageSlugs() serves, which is the sitemap's set (a
// published StreetContent row AND a ResidentialStreet entity). A rental on a street with no page
// gets no link. Nothing here links to a page that does not exist, and nothing here creates one.
//
// The anchor text is what the page's own heading says: resolveStreetName over the same fallback
// chain src/lib/street-data.ts feeds it (the rural side-road name, then the published row's
// streetName). It is not the listing's streetName, which carries the feed's unit and direction
// noise ("Nipissing Rd 520 A") and would name a street the page is not about.
//
// A withheld listing (displayAddress false) is never tied to its street (MC-036), and the raw
// streetSlug and streetName leave every row before it is serialised, so a withheld listing's
// street is not in the payload either.

import { prisma } from "@/lib/prisma";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { resolveStreetName } from "@/lib/streetName";
import { deriveIdentity, ruralSideRoadName } from "@/lib/streetUtils";
import canonicalMap from "@/lib/_generated/canonical-map.json";

/** The published street page a rental card links to: its canonical slug and its heading name. */
export interface RentalStreetPage {
  slug: string;
  name: string;
}

interface StreetRow {
  streetSlug: string;
  streetName?: string | null;
  displayAddress: boolean;
}

const CANONICAL = canonicalMap as Record<string, string>;

/** The published page a feed slug names, or null. Exact first; then the middleware's two rules. */
function publishedPageFor(slug: string, published: Set<string>): string | null {
  if (published.has(slug)) return slug;
  const mapped = CANONICAL[slug];
  if (mapped && published.has(mapped)) return mapped;
  const derived = deriveIdentity(slug)?.canonicalSlug;
  if (derived && published.has(derived)) return derived;
  return null;
}

/**
 * The public card rows with their street columns replaced by the page they resolve to, or null.
 * The caller has already stripped the VOW-only columns and redacted a withheld address. One read
 * of the published set and one read of the linked pages' names per call.
 */
export async function withRentalStreetPages<T extends StreetRow>(
  rows: T[],
): Promise<Array<Omit<T, "streetSlug" | "streetName"> & { streetPage: RentalStreetPage | null }>> {
  const published = new Set(await publishedStreetPageSlugs());
  const pageOf = rows.map((row) => (row.displayAddress ? publishedPageFor(row.streetSlug, published) : null));
  const linked = Array.from(new Set(pageOf.filter((s): s is string => s !== null)));
  const names = new Map<string, string>();
  if (linked.length > 0) {
    const content = await prisma.streetContent.findMany({
      where: { streetSlug: { in: linked }, status: "published" },
      select: { streetSlug: true, streetName: true },
    });
    for (const c of content) names.set(c.streetSlug, c.streetName);
  }
  return rows.map((row, i) => {
    // The two street columns leave the row here; the void statements keep the destructure lint-clean.
    const { streetSlug, streetName, ...card } = row;
    void streetSlug;
    void streetName;
    const slug = pageOf[i];
    const streetPage = slug ? { slug, name: resolveStreetName(slug, ruralSideRoadName(slug) ?? names.get(slug) ?? null).name } : null;
    return { ...card, streetPage };
  });
}
