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

export const GUIDE_SLUG = {
  schools: "milton-schools-what-the-data-shows",
  firstHome: "what-it-costs-to-buy-your-first-home-in-milton",
  soldPrice: "how-to-read-a-milton-sold-price",
  neighbourhoodCosts: "what-milton-neighbourhoods-cost",
  condoFees: "milton-condo-fees-parking-and-lockers",
} as const;

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

export function guidesForStreet(opts: { condoHeavy: boolean }): GuideUplink[] {
  return fromRegistry([
    GUIDE_SLUG.soldPrice,
    GUIDE_SLUG.firstHome,
    GUIDE_SLUG.schools,
    ...(opts.condoHeavy ? [GUIDE_SLUG.condoFees] : []),
  ]);
}

export function guidesForHub(opts: { condoHeavy: boolean }): GuideUplink[] {
  return fromRegistry([
    GUIDE_SLUG.neighbourhoodCosts,
    GUIDE_SLUG.schools,
    ...(opts.condoHeavy ? [GUIDE_SLUG.condoFees] : []),
  ]);
}
