// src/lib/megaContext.ts
// THE NAV'S LINK WEIGHT, SPENT WHERE THE PAGE IS (MH-006, MA-004 change 10, defect 12).
//
// The menu's three strips were one global query each, so every one of 1,000+ pages sent the
// same eight street links to the same eight streets, and a hub's own streets and a street's
// neighbours got nothing from the chrome that framed them. MA-001 defect 14 (five streets
// with 631 to 650 inbound links, the rest with two to four) is that mechanism.
//
// So, per page:
//   a hub      the Streets strip is that hub's published streets, ranked by 12-month sales;
//   a street   the Streets strip is the streets that meet it (StreetAdjacency), and the
//              Sell strip is its hub's busiest, itself excluded;
//   elsewhere  the global strips, unchanged.
//
// Every candidate is intersected with publishedStreetPageSlugs(), the sitemap's own set, so
// the menu still cannot link a 404. A page whose context yields nothing (a street with no
// recorded neighbour, a hub with one street) keeps the global strip: a strip is never empty
// and the three on a page are never the same, which the nav gate asserts.
import { prisma } from "@/lib/prisma";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { resolveStreetName } from "@/lib/streetName";
import type { MegaStrip, NavContext } from "@/components/nav/megaTypes";
import type { MegaStrips } from "@/lib/megaLive";

const STRIP_SIZE = 8;

type Row = { slug: string; name: string | null; soldCount12mo: number };

const sold = (n: number) => `${n} sold`;
const toStrip = (label: string, rows: Row[]): MegaStrip | undefined =>
  rows.length ? { label, items: rows.map((r) => ({ slug: r.slug, name: resolveStreetName(r.slug, r.name).name, note: sold(r.soldCount12mo) })) } : undefined;

/** A hub's published streets by 12-month sales, one street optionally left out. */
async function hubStreets(hubSlug: string, published: Set<string>, except?: string): Promise<Row[]> {
  const hub = await prisma.neighbourhood.findUnique({ where: { slug: hubSlug }, select: { id: true } });
  if (!hub) return [];
  const rows = await prisma.residentialStreet.findMany({
    where: { neighbourhoodId: hub.id, slug: { in: Array.from(published).filter((s) => s !== except) } },
    orderBy: [{ soldCount12mo: "desc" }, { slug: "asc" }],
    take: STRIP_SIZE,
    select: { slug: true, name: true, soldCount12mo: true },
  });
  return rows;
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
      ? await prisma.residentialStreet.findMany({
          where: { slug: { in: neighbourSlugs } },
          orderBy: [{ soldCount12mo: "desc" }, { slug: "asc" }],
          take: STRIP_SIZE,
          select: { slug: true, name: true, soldCount12mo: true },
        })
      : [];
    const streets = toStrip(`Streets that meet ${street.name}`, neighbours);
    if (streets) out.streets = streets;
    if (hub) {
      const busiest = toStrip(`Most sales in ${hub.name}, last 12 months`, await hubStreets(hub.slug, published, street.slug));
      // With no recorded neighbour, the hub's busiest is the street's context in the Streets
      // panel and the Sell strip stays Milton-wide, so the two are never the same list.
      if (streets && busiest) out.sell = busiest;
      else if (busiest) out.streets = busiest;
    }
    return out;
  }

  if (ctx.hub) {
    const streets = toStrip(`Streets in ${ctx.hub.name}, most sales in 12 months`, await hubStreets(ctx.hub.slug, published));
    if (streets) out.streets = streets;
  }
  return out;
}
