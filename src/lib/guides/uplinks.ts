// src/lib/guides/uplinks.ts
//
// WHICH GUIDES A STREET OR A HUB LINKS UP TO. The six guides existed for a day with no
// inbound link from any of the 449 street pages or 22 hubs, which is the whole corpus
// telling a crawler the guides do not matter. Every page now carries a small "Guides"
// block, and the set it carries is decided here, once, from the registry in guides.ts.
// Nothing below invents a title or a slug: a guide the registry does not know is not
// linked, and a slug that stops matching the registry drops out of every page at once
// rather than becoming 449 dead anchors.
//
// The rules, as ruled (MC-003):
//   · schools guide            from every street page and every hub
//   · first-time buyer guide   from every street page
//   · sold-price literacy      from every street page
//   · neighbourhood costs      from every hub
//   · condo fees guide         from condo-heavy hubs and streets only
//
// "Condo-heavy" is decided by the caller from what its own page renders, so the battery can
// derive the same population from the served HTML: a street with a condo sale pill, a hub
// that lists condo buildings or carries a monthly fee.
import "server-only";
import { GUIDE_DEFS, type GuideDef } from "./guides";
import { hubSlugAt, hubSlugsNear } from "./hubLookup";
import { PILOT_PARKS } from "@/data/sources/miltonParking";
import { TOWN_PARKS } from "@/data/townPlaces";

export const GUIDE_SLUG = {
  schools: "milton-schools-what-the-data-shows",
  firstHome: "what-it-costs-to-buy-your-first-home-in-milton",
  soldPrice: "how-to-read-a-milton-sold-price",
  neighbourhoodCosts: "what-milton-neighbourhoods-cost",
  condoFees: "milton-condo-fees-parking-and-lockers",
  parking: "parking-in-milton",
  goTrain: "milton-go-train-to-toronto",
} as const;

// THE PARKING AND GO GUIDES LINK DOWN TO A SET OF HUBS, AND THOSE HUBS LINK BACK UP (MC-012).
// The same two rules the guides use to choose their hubs (src/lib/guides/parking.ts,
// goTransit.ts) are computed here, once, from the same layers, so the up-link and the
// down-link are one population: a hub holding a pilot park carries the parking guide; a hub
// whose polygon edge lies within 1,600 m of Milton GO carries the GO guide. A street inherits
// its hub's answer. The battery derives the same sets by reading the two guide pages' hub
// links and asserts the up-links against them in both directions.
const STATION = { lng: -79.867172, lat: 43.52364 };
const NEAR_METRES = 1600;

function parkingHubSet(): Set<string> {
  const out = new Set<string>();
  for (const p of PILOT_PARKS) {
    if (!p.townPark) continue;
    const row = TOWN_PARKS.find((t) => t.name.startsWith(p.townPark as string));
    if (!row) continue;
    const slug = hubSlugAt(row.lng, row.lat);
    if (slug) out.add(slug);
  }
  return out;
}
function goHubSet(): Set<string> {
  return new Set(hubSlugsNear(STATION.lng, STATION.lat, NEAR_METRES).map((n) => n.slug));
}
let parkingHubs: Set<string> | null = null;
let goHubs: Set<string> | null = null;
export function hubCarriesParkingGuide(hubSlug: string | null | undefined): boolean {
  if (!hubSlug) return false;
  if (!parkingHubs) parkingHubs = parkingHubSet();
  return parkingHubs.has(hubSlug);
}
export function hubCarriesGoGuide(hubSlug: string | null | undefined): boolean {
  if (!hubSlug) return false;
  if (!goHubs) goHubs = goHubSet();
  return goHubs.has(hubSlug);
}

export interface GuideUplink {
  slug: string;
  href: string;
  title: string;
  dek: string;
  categoryLabel: string;
}

function toUplink(def: GuideDef): GuideUplink {
  return { slug: def.slug, href: `/guides/${def.slug}`, title: def.title, dek: def.dek, categoryLabel: def.categoryLabel };
}

/** Registry lookup in the order asked for. An unknown slug is skipped, never fabricated. */
function fromRegistry(slugs: readonly string[]): GuideUplink[] {
  const out: GuideUplink[] = [];
  for (const slug of slugs) {
    const def = GUIDE_DEFS.find((d) => d.slug === slug);
    if (def) out.push(toUplink(def));
  }
  return out;
}

export function guidesForStreet(opts: { condoHeavy: boolean; hubSlugs?: readonly string[] }): GuideUplink[] {
  const hubs = opts.hubSlugs ?? [];
  return fromRegistry([
    GUIDE_SLUG.soldPrice,
    GUIDE_SLUG.firstHome,
    GUIDE_SLUG.schools,
    ...(opts.condoHeavy ? [GUIDE_SLUG.condoFees] : []),
    ...(hubs.some((h) => hubCarriesParkingGuide(h)) ? [GUIDE_SLUG.parking] : []),
    ...(hubs.some((h) => hubCarriesGoGuide(h)) ? [GUIDE_SLUG.goTrain] : []),
  ]);
}

export function guidesForHub(opts: { condoHeavy: boolean; hubSlug?: string | null }): GuideUplink[] {
  return fromRegistry([
    GUIDE_SLUG.neighbourhoodCosts,
    GUIDE_SLUG.schools,
    ...(opts.condoHeavy ? [GUIDE_SLUG.condoFees] : []),
    ...(hubCarriesParkingGuide(opts.hubSlug) ? [GUIDE_SLUG.parking] : []),
    ...(hubCarriesGoGuide(opts.hubSlug) ? [GUIDE_SLUG.goTrain] : []),
  ]);
}
