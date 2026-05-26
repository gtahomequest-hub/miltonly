import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStreetSoldList } from "@/lib/sold-data";
import type { SoldTableRow } from "@/types/street";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const user = await getSession();
  const canSee = !!(user && user.vowAcknowledgedAt);
  if (!canSee) {
    return NextResponse.json({ canSee: false, records: [] as SoldTableRow[] });
  }

  const items = await getStreetSoldList(params.slug, "sale", 90, 20).catch(
    () => [],
  );
  const records: SoldTableRow[] = items.map((r) => ({
    mls_number: r.mls_number,
    address: r.address,
    sold_price: r.sold_price,
    list_price: r.list_price,
    sold_to_ask_ratio: r.sold_to_ask_ratio,
    sold_date: r.sold_date,
    days_on_market: r.days_on_market,
    beds: r.beds,
    baths: r.baths,
    property_type: r.property_type,
    transaction_type: r.transaction_type,
    list_office_name: r.list_office_name,
  }));

  return NextResponse.json({ canSee: true, records });
}
