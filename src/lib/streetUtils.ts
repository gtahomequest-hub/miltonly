import { createHash } from "crypto";

// Extracts ONLY the street name — no house numbers, no unit numbers
export function extractStreetName(fullAddress: string): string {
  let address = fullAddress.trim();

  // Step 1: Remove unit/suite/apt prefixes
  address = address.replace(
    /^(unit|suite|apt|apartment|ph|penthouse|#)\s*[\w\d]+\s*[-–]\s*/i,
    ""
  );

  // Step 2: Remove condo-style prefix like "1204-38"
  address = address.replace(/^\d{1,6}-/, "");

  // Step 3: Remove leading house number (digits at start)
  address = address.replace(/^\d+\s+/, "");

  // Step 4: Remove trailing city/province info (", Milton, ON ...")
  address = address.replace(/,\s*(Milton|ON|Ontario).*/i, "");

  // Step 5: Normalize street type suffixes
  const suffixes: Record<string, string> = {
    Avenue: "Ave",
    Road: "Rd",
    Street: "St",
    Boulevard: "Blvd",
    Court: "Crt",
    Drive: "Dr",
    Crescent: "Cres",
    Place: "Pl",
    Trail: "Trl",
    Circle: "Cir",
    Lane: "Ln",
    Terrace: "Terr",
    Grove: "Grv",
    Heights: "Hts",
    Hollow: "Hllw",
  };
  for (const [full, abbr] of Object.entries(suffixes)) {
    const regex = new RegExp(`\\b${full}\\b`, "i");
    address = address.replace(regex, abbr);
  }

  return address.trim();
}

// Converts street name to URL slug — always ends in -milton
export function streetNameToSlug(streetName: string): string {
  return (
    streetName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") + "-milton"
  );
}

// Calculates market data hash for staleness detection
export function calcMarketDataHash(stats: {
  avgSoldPrice: number;
  totalSold12mo: number;
  avgDOM: number;
  soldVsAskPct: number;
  dominantPropertyType: string;
}): string {
  const hashInput = [
    Math.round(stats.avgSoldPrice / 10000),
    stats.totalSold12mo,
    Math.round(stats.avgDOM),
    Math.round(stats.soldVsAskPct * 10),
    stats.dominantPropertyType,
  ].join("|");

  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}
