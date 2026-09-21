import { NextRequest, NextResponse } from "next/server";
import { getSession, touchSession } from "@/lib/auth";
import { canSeeVowRecords } from "@/lib/vow-access";
import { logVowAccess, clientIpFromHeaders } from "@/lib/vow-audit";
import { getStreetSoldList } from "@/lib/sold-data";
import type { SoldTableRow } from "@/types/street";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const user = await getSession();
  const canSee = canSeeVowRecords(user);
  if (!canSee) {
    // MP-002: a signed-in person who has not yet finished the card (acknowledgement, and since
    // MP-002b a password) is told so, and the island renders the card in place of the sign-in
    // gate. The card asks /api/auth/me which parts are still owed. Before this, both states
    // got "Sign in free to unlock", and signing in again led nowhere.
    return NextResponse.json({ canSee: false, needsAcknowledgement: !!user, records: [] as SoldTableRow[] });
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

  // The audit trail (MP-006): one row per gated read, before the records go out.
  await logVowAccess({
    userId: user!.id,
    kind: "street-records",
    scope: params.slug,
    path: req.nextUrl.pathname,
    recordCount: records.length,
    ip: clientIpFromHeaders(req.headers),
    userAgent: req.headers.get("user-agent"),
  });
  await touchSession();

  return NextResponse.json({ canSee: true, records });
}
