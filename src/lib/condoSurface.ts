// Which condo buildings a visitor may be pointed at (MC-046). A CondoBuilding row can exist only
// because sold or leased records named the building (scripts/ws3-backfill.ts built them from
// DB2), so naming a building with no page in search would disclose VOW data by presence. The
// public surfaces (hero search, the hero index, autocomplete) list only buildings whose page is
// published, the same set /condos and the sitemap emit.
import { prisma } from "@/lib/prisma";

export async function publishedCondoSlugs(): Promise<string[]> {
  const rows = await prisma.condoContent.findMany({ where: { status: "published" }, select: { buildingSlug: true } });
  return rows.map((r) => r.buildingSlug);
}
