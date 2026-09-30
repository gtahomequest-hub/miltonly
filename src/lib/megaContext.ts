// src/lib/megaContext.ts
// THE NAV'S LINK WEIGHT, SPENT WHERE THE PAGE IS (MH-006, MA-004 change 10, defect 12).
//
// The menu's three strips were one global query each, so every one of 1,000+ pages sent the
// same eight street links to the same eight streets, and a hub's own streets and a street's
// neighbours got nothing from the chrome that framed them. MA-001 defect 14 (five streets
// with 631 to 650 inbound links, the rest with two to four) is that mechanism.
//
// So, per page:
//   a hub      the Streets strip is that hub's published streets, most for sale now first;
//   a street   the Streets strip is the streets that meet it (StreetAdjacency), and the
//              Sell strip is its hub's streets with the most for sale, itself excluded;
//   elsewhere  the global strips, unchanged.
//
// ACTIVE COUNT, TIES ALPHABETICAL (MC-046 R9). These strips were ranked by 12-month sales and
// each link carried "N sold". A rank by sales discloses relative sold volume with no figure on
// it, so the order is now the count of homes for sale today (public IDX rows), and a tie reads
// A to Z. A street with none for sale still appears, after those with some, and carries no note.
//
// Every candidate is intersected with publishedStreetPageSlugs(), the sitemap's own set, so
// the menu still cannot link a 404. A page whose context yields nothing (a street with no
// recorded neighbour, a hub with one street) keeps the global strip: a strip is never empty
// and the three on a page are never the same, which the nav gate asserts.
import { prisma } from "@/lib/prisma";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { resolveStreetName } from "@/lib/streetName";
import { PUBLIC_SALE_WHERE } from "@/lib/listings/vow";
import type { MegaStrip, NavContext } from "@/components/nav/megaTypes";
import type { MegaStrips } from "@/lib/megaLive";

const STRIP_SIZE = 8;

type Row = { slug: string; name: string; active: number };

/** Active sale listings per street slug, public rows only. A slug with none is absent. */
export async function activeSaleCounts(slugs: string[]): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: { _all: true },
    where: { ...PUBLIC_SALE_WHERE, streetSlug: { in: slugs } },
  });
  return new Map(rows.map((r) => [r.streetSlug, r._count._all]));
}

/** Most for sale first, ties alphabetical by the resolved street name. */
async function rankByActive(rows: { slug: string; name: string | null }[]): Promise<Row[]> {
  const counts = await activeSaleCounts(rows.map((r) => r.slug));
  return rows
    .map((r) => ({ slug: r.slug, name: resolveStreetName(r.slug, r.name).name, active: counts.get(r.slug) ?? 0 }))
    .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name))
    .slice(0, STRIP_SIZE);
}

const toStrip = (label: string, rows: Row[]): MegaStrip | undefined =>
  rows.length ? { label, items: rows.map((r) => ({ slug: r.slug, name: r.name, note: r.active > 0 ? `${r.active} for sale` : "" })) } : undefined;

/** A hub's published streets, most for sale first, one street optionally left out. */
async function hubStreets(hubSlug: string, published: Set<string>, except?: string): Promise<Row[]> {
  const hub = await prisma.neighbourhood.findUnique({ where: { slug: hubSlug }, select: { id: true } });
  if (!hub) return [];
  const rows = await prisma.residentialStreet.findMany({
    where: { neighbourhoodId: hub.id, slug: { in: Array.from(published).filter((s) => s !== except) } },
    select: { slug: true, name: true },
  });
  return rankByActive(rows);
}

/** The strips a page's context earns. Keys absent here keep the global strip. */
export async function getContextStrips(ctx: NavContext | undefined): Promise<Partial<MegaStrips>> {
  if (!ctx?.street && !ctx?.hub) return {};
  const published = new Set(await publishedStreetPageSlugs());
  const out: Partial<MegaStrips> = {};

  if (ctx.street) {
    const street = ctx.street;
    const [adjacent, self] = await Promise.all([
      prisma.streetAdjacency.findMany({ where: { streetSlug: street.slug }, select: { connectedSlug: true } }),
      ctx.hub ? null : prisma.residentialStreet.findUnique({ where: { slug: street.slug }, select: { neighbourhood: { select: { slug: true, name: true } } } }),
    ]);
    const hub = ctx.hub ?? (self?.neighbourhood ? { slug: self.neighbourhood.slug, name: self.neighbourhood.name } : undefined);
    const neighbourSlugs = adjacent.map((a) => a.connectedSlug).filter((s) => published.has(s) && s !== street.slug);
    const neighbours = neighbourSlugs.length
      ? await rankByActive(await prisma.residentialStreet.findMany({ where: { slug: { in: neighbourSlugs } }, select: { slug: true, name: true } }))
      : [];
    const streets = toStrip(`Streets that meet ${street.name}`, neighbours);
    if (streets) out.streets = streets;
    if (hub) {
      const most = toStrip(`For sale now in ${hub.name}`, await hubStreets(hub.slug, published, street.slug));
      // With no recorded neighbour, the hub's streets are the street's context in the Streets
      // panel and the Sell strip stays Milton-wide, so the two are never the same list.
      if (streets && most) out.sell = most;
      else if (most) out.streets = most;
    }
    return out;
  }

  if (ctx.hub) {
    const streets = toStrip(`Streets in ${ctx.hub.name}, by homes for sale now`, await hubStreets(ctx.hub.slug, published));
    if (streets) out.streets = streets;
  }
  return out;
}
