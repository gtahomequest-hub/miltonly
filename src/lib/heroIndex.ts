// src/lib/heroIndex.ts
// Builds the hero-autocomplete index ONCE (cached) and ships it to the client, so
// suggestions filter with zero per-keystroke latency. ~24 neighbourhoods + ~915
// streets + ~108 condos ≈ 1k small entries (~18KB gzipped) — one fetch on first
// focus beats a network round-trip per keystroke, and there's no new dependency.
//
// Secondary lines are the "depth proof" — real counts:
//   neighbourhood → "Neighbourhood · N streets"  (N = ResidentialStreet _count)
//   street        → "<its neighbourhood> · N homes" (N = distinct addresses that
//                    have sold on the street — the honest "homes we have data on")
//   condo         → its address (condo `name` is address-form; units when distinct)
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { expandStreetName } from "@/lib/street-data";
import { SURFACED_STREET_WHERE } from "@/lib/streetSurface";

export interface HeroIndexEntry {
  type: "neighbourhood" | "street" | "condo";
  name: string;
  slug: string;
  secondary: string;
}

let _cache: HeroIndexEntry[] | null = null;
let _cacheAt = 0;
const TTL_MS = 60 * 60 * 1000;

const cleanName = (n: string) => expandStreetName(n).replace(/\.\s/g, " ").replace(/\s+/g, " ").trim();

// Some ResidentialStreet rows are really unit-level addresses ("Main Street East
// Unit 3", "… Ground Floor Apartment", "Solomon Court Main&up") — keep them out of
// autocomplete so real streets aren't buried.
const UNIT_LIKE = /\b(unit|apt|apartment|suite|ph|penthouse|floor|flr|upper|lower|bsmt|basement|ground|rear)\b|[/&#]/i;

export async function getHeroIndex(): Promise<HeroIndexEntry[]> {
  if (_cache && Date.now() - _cacheAt < TTL_MS) return _cache;
  const soldDb = getSoldDb();
  const [nbs, streets, condos, homesRows] = await Promise.all([
    prisma.neighbourhood.findMany({
      // Count only surfaced streets so the "· N streets" line stays honest after
      // the dormant-entity backfill (pageless entities are not shown anywhere).
      select: { slug: true, name: true, _count: { select: { residentialStreets: { where: SURFACED_STREET_WHERE } } } },
    }),
    prisma.residentialStreet.findMany({
      where: SURFACED_STREET_WHERE, // dormant/pageless entities never appear in autocomplete
      select: { slug: true, name: true, neighbourhood: { select: { name: true } } },
    }),
    prisma.condoBuilding.findMany({
      select: { slug: true, name: true, address: true, buildingAddress: true, totalUnits: true },
    }),
    soldDb
      ? (soldDb`SELECT street_slug, COUNT(DISTINCT address)::int AS homes
           FROM sold.sold_records WHERE street_slug IS NOT NULL GROUP BY street_slug` as unknown as Promise<
          Array<{ street_slug: string; homes: number }>
        >)
      : Promise.resolve([] as Array<{ street_slug: string; homes: number }>),
  ]);

  const homesBySlug = new Map<string, number>();
  for (const r of homesRows) homesBySlug.set(r.street_slug, r.homes);

  const entries: HeroIndexEntry[] = [];
  for (const nb of nbs) {
    const n = nb._count.residentialStreets;
    entries.push({ type: "neighbourhood", name: nb.name, slug: nb.slug, secondary: `Neighbourhood · ${n} street${n === 1 ? "" : "s"}` });
  }
  for (const s of streets) {
    if (UNIT_LIKE.test(s.name)) continue; // skip unit-level rows
    const homes = homesBySlug.get(s.slug) ?? 0;
    const nb = s.neighbourhood?.name ?? "Milton";
    entries.push({
      type: "street",
      name: cleanName(s.name),
      slug: s.slug,
      secondary: homes > 0 ? `${nb} · ${homes} home${homes === 1 ? "" : "s"}` : nb,
    });
  }
  for (const c of condos) {
    const name = c.name || c.address || c.buildingAddress || c.slug;
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
