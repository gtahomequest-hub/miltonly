import { prisma } from "@/lib/prisma";
import ThankYouClient from "./ThankYouClient";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const lidRaw = sp.lid;
  const lid = (Array.isArray(lidRaw) ? lidRaw[0] : lidRaw || "").toString();

  let lead: {
    id: string;
    firstName: string;
    bedrooms: number | null;
    priceRangeMax: number | null;
    timeline: string | null;
    propertyType: string | null;
    // PII flowed in only so client-side SHA-256 can be passed to gtag user_data
    // for Google Ads Enhanced Conversions (manual mode). Hashed before any
    // network call leaves the browser; never logged or rendered.
    email: string | null;
    phone: string | null;
  } | null = null;

  if (lid && lid !== "spam") {
    const row = await prisma.lead.findUnique({ where: { id: lid } });
    if (row) {
      lead = {
        id: row.id,
        firstName: row.firstName,
        bedrooms: row.bedrooms,
        priceRangeMax: row.priceRangeMax,
        timeline: row.timeline,
        propertyType: row.propertyType,
        email: row.email,
        phone: row.phone,
      };
      // [EC-DEBUG] Server-side prop check — confirms Prisma actually returns
      // email + phone for this lid before they cross the wire to the client.
      console.log("[EC-DEBUG server] lead loaded", { id: row.id, hasEmail: !!row.email, hasPhone: !!row.phone, emailLen: row.email?.length ?? 0, phoneLen: row.phone?.length ?? 0 });
    } else {
      console.log("[EC-DEBUG server] no lead row for lid", lid);
    }
  }

  const isSpam = lid === "spam";
  const cheatsheetEnabled = process.env.CHEATSHEET_ENABLED === "true";

  return (
    <ThankYouClient
      lead={lead}
      isSpam={isSpam}
      cheatsheetEnabled={cheatsheetEnabled}
    />
  );
}
