// src/lib/heroIndex.ts
// Builds the hero-autocomplete index ONCE (cached) and ships it to the client, so
// suggestions filter with zero per-keystroke latency. ~24 neighbourhoods + ~915
// streets + ~108 condos ≈ 1k small entries (~18KB gzipped) — one fetch on first
// focus beats a network round-trip per keystroke, and there's no new dependency.
//
// Secondary lines:
//   neighbourhood → "Neighbourhood · N streets"  (N = ResidentialStreet _count)
//   street        → its neighbourhood
//   condo         → its address (condo `name` is address-form; units when distinct)
//
// NO SOLD COUNT (MC-046 R7). A street's line read "<its neighbourhood> · N homes", N being the
// distinct addresses that had sold on it, from sold.sold_records. That is a count derived from
// VOW records, served to anyone by /api/hero-index, so the line is the neighbourhood alone and
// this module no longer reads the sold database at all.
import { condoDisplayName } from "@/lib/condoName";
import { prisma } from "@/lib/prisma";
import { surfacedStreetWhere } from "@/lib/streetSurface";
import { resolveStreetName } from "@/lib/streetName";
import { publishedCondoSlugs } from "@/lib/condoSurface";

export interface HeroIndexEntry {
  type: "neighbourhood" | "street" | "condo";
  name: string;
  slug: string;
  secondary: string;
}

let _cache: HeroIndexEntry[] | null = null;
let _cacheAt = 0;
const TTL_MS = 60 * 60 * 1000;

// Some ResidentialStreet rows are really unit-level addresses ("Main Street East
// Unit 3", "… Ground Floor Apartment", "Solomon Court Main&up") — keep them out of
// autocomplete so real streets aren't buried.
const UNIT_LIKE = /\b(unit|apt|apartment|suite|ph|penthouse|floor|flr|upper|lower|bsmt|basement|ground|rear)\b|[/&#]/i;

export async function getHeroIndex(): Promise<HeroIndexEntry[]> {
  if (_cache && Date.now() - _cacheAt < TTL_MS) return _cache;
  // Derived once and reused by both queries below, so the neighbourhood count and the street list
  // can never disagree about what "surfaced" means.
  const surfaced = await surfacedStreetWhere();
  const [nbs, streets, condos] = await Promise.all([
    prisma.neighbourhood.findMany({
      // Count only surfaced streets so the "· N streets" line stays honest after
      // the dormant-entity backfill (pageless entities are not shown anywhere).
      select: { slug: true, name: true, _count: { select: { residentialStreets: { where: surfaced } } } },
    }),
    prisma.residentialStreet.findMany({
      where: surfaced, // dormant/pageless entities never appear in autocomplete
      select: { slug: true, name: true, neighbourhood: { select: { name: true } } },
    }),
    // MC-046: buildings with a published page only (src/lib/condoSurface.ts).
    prisma.condoBuilding.findMany({
      where: { slug: { in: await publishedCondoSlugs() } },
      select: { slug: true, name: true, address: true, buildingAddress: true, totalUnits: true, streetNumber: true, streetSlug: true, displayName: true },
    }),
  ]);

  const entries: HeroIndexEntry[] = [];
  for (const nb of nbs) {
    const n = nb._count.residentialStreets;
    entries.push({ type: "neighbourhood", name: nb.name, slug: nb.slug, secondary: `Neighbourhood · ${n} street${n === 1 ? "" : "s"}` });
  }
  for (const s of streets) {
    if (UNIT_LIKE.test(s.name)) continue; // skip unit-level rows
    entries.push({
      type: "street",
      name: resolveStreetName(s.slug, s.name).name,
      slug: s.slug,
      secondary: s.neighbourhood?.name ?? "Milton",
    });
  }
  for (const c of condos) {
    // DEC-CONDO-NAME: same name here as on the building's own page.
    const name = condoDisplayName({
      slug: c.slug,
      streetNumber: c.streetNumber,
      streetSlug: c.streetSlug,
      buildingAddress: c.buildingAddress ?? c.displayName ?? c.name ?? c.address,
    });
    // condo `name` is address-form; show a distinct address, else unit count, else generic.
    const secondary =
      c.address && c.address !== name
        ? c.address
        : c.totalUnits
          ? `Condo · ${c.totalUnits} units`
          : "Condo building";
    entries.push({ type: "condo", name, slug: c.slug, secondary });
  }

  _cache = entries;
  _cacheAt = Date.now();
  return entries;
}
