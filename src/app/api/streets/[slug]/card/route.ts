// THE CARD'S FACTS, AS JSON (MH-005, MA-001 change 6). The og.png renderer runs at the edge,
// where Prisma and the Neon driver cannot, so it asks this Node route for the four things the
// card states: the street, its area, the typical price with the basis the description uses
// (the same PriceBasis object, so the card and the snippet cannot disagree), or the strongest
// fact below the floor. Nothing here is not already on the page.
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getStreetPageData } from "@/lib/street-data";
import { roundPriceForProse } from "@/lib/format";
import { formatCAD } from "@/lib/charts/theme";
import { windowDisclosure } from "@/lib/streetEnrichment";

export const revalidate = 86400;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await getStreetPageData(params.slug);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sb = data.enrichment?.saleBasis ?? null;
  const sales = data.enrichment?.counts.sale12mo ?? 0;
  const leases = data.enrichment?.counts.lease12mo ?? 0;
  const figure = sb ? formatCAD(roundPriceForProse(sb.typical)) : null;
  const basis = sb
    ? `typical sale price, ${windowDisclosure(sb)}`
    : sales > 0
      ? `${sales} sale${sales === 1 ? "" : "s"} on record in the last 12 months`
      : leases > 0
        ? `${leases} lease${leases === 1 ? "" : "s"} on record in the last 12 months`
        : "current listings and the full street read";
  return NextResponse.json(
    {
      name: data.street.name,
      area: data.street.neighbourhoods?.[0] ?? config.CITY_NAME,
      city: config.CITY_NAME,
      province: config.CITY_PROVINCE,
      figure,
      basis,
    },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
