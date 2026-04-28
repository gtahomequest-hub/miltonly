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
      };
    }
  }

  const isSpam = lid === "spam";
  const cheatsheetEnabled = process.env.CHEATSHEET_ENABLED === "true";
  const awConversionId = (process.env.NEXT_PUBLIC_AW_CONVERSION_ID || "").trim();
  const awConversionLabel = (process.env.NEXT_PUBLIC_AW_CONVERSION_LABEL || "").trim();

  return (
    <ThankYouClient
      lead={lead}
      isSpam={isSpam}
      cheatsheetEnabled={cheatsheetEnabled}
      awConversionId={awConversionId}
      awConversionLabel={awConversionLabel}
    />
  );
}
