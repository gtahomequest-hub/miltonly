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
    timeline: string | null;
    preApproved: string | null;
    mlsNumber: string | null;
    listingAddress: string | null;
    // PII flowed in only so client-side SHA-256 can be passed to gtag user_data
    // for Google Ads Enhanced Conversions (manual mode). Hashed before any
    // network call leaves the browser; never logged or rendered.
    email: string | null;
    phone: string | null;
  } | null = null;

  if (lid && lid !== "spam") {
    const row = await prisma.lead.findUnique({ where: { id: lid } });
    if (row) {
      let listingAddress: string | null = null;
      if (row.mlsNumber) {
        const listing = await prisma.listing.findUnique({
          where: { mlsNumber: row.mlsNumber },
          select: { address: true, city: true },
        });
        if (listing) listingAddress = `${listing.address}, ${listing.city}`;
      }
      lead = {
        id: row.id,
        firstName: row.firstName,
        timeline: row.timeline,
        preApproved: row.preApproved,
        mlsNumber: row.mlsNumber,
        listingAddress,
        email: row.email,
        phone: row.phone,
      };
    }
  }

  const isSpam = lid === "spam";

  return <ThankYouClient lead={lead} isSpam={isSpam} />;
}
