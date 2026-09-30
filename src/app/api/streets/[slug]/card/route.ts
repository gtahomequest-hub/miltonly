// THE CARD'S FACTS, AS JSON (MH-005, MA-001 change 6). The og.png renderer runs at the edge,
// where Prisma and the Neon driver cannot, so it asks this Node route for what the card states:
// the street, its area, the city, and one line of words.
//
// NO FIGURE AND NO COUNT (MC-046 Stage 1, ruling R5). The card carried the street's typical sale
// price with its sample ("typical sale price, across 33 sales in the last 12 months") on 218
// streets and a sale or lease count on every other one. Both are values derived from sold and
// leased records, and an og:image is shown to anyone a link is shared with. The response has no
// figure, basis or count field at all, so nothing downstream can draw one.
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getStreetPageData } from "@/lib/street-data";

export const revalidate = 86400;

/** The card's one line under the name: what the page offers, in words, with no number in it. */
const CARD_LINE ="Live listings, the Town's addresses and getting around";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await getStreetPageData(params.slug);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(
    {
      name: data.street.name,
      area: data.enrichment?.areaContext?.neighbourhoodName ?? data.street.neighbourhoods?.[0] ?? config.CITY_NAME,
      city: config.CITY_NAME,
      province: config.CITY_PROVINCE,
      line: CARD_LINE,
    },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
