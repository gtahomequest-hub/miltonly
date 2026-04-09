import { createHash } from "crypto";

// Extracts ONLY the street name — no house numbers, no unit numbers
export function extractStreetName(fullAddress: string): string {
  let address = fullAddress.trim();

  // Step 1: Remove unit/suite/apt prefixes
  // Handles: "Unit 4 - 55", "#302-", "Suite 100 -", "Apt 2 -", "PH-"
  address = address.replace(
    /^(unit|suite|apt|apartment|ph|penthouse|#)\s*[\w\d]+\s*[-–]\s*/i,
    ""
  );

  // Step 2: Remove condo-style prefix like "1204-38"
  address = address.replace(/^\d{1,6}-/, "");

  // Step 3: Remove slash-format multi-house numbers like "225/269"
  // Also handles partial slash leftovers like "/269"
  address = address.replace(/^\d*\/\d+\s+/, "");

  // Step 4: Remove leading house number (digits at start)
  address = address.replace(/^\d+\s+/, "");

  // Step 4b: Remove leading "E " artifact from addresses like "1050 E Main Street"
  // (the house number was stripped but the leading direction stayed)
  address = address.replace(/^([NSEW])\s+(?=[A-Z])/i, "$1 ");

  // Step 5: Remove trailing city/province info (", Milton, ON ...")
  address = address.replace(/,\s*(Milton|ON|Ontario).*/i, "");

  // Step 6: Remove anything in parentheses — (Lower), (Upper), (UPPER LEVELS), etc.
  address = address.replace(/\s*\([^)]*\)\s*/g, " ");

  // Step 7: Normalize street type suffixes to abbreviations FIRST
  // (so subsequent steps can match abbreviated forms)
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

  // Step 8: Remove trailing junk suffixes (run twice to catch chained junk like "Basement Apt.")
  const junkRegex =
    /\s+(Basement|BASEMENT|Bsmt|BSMT|Basemen|Bsmnt|Lower|LOWER|Upper|UPPER|Main|MAIN|Suite|Garden|N\/A|Apt\.?|bonus|SS\d*|Parking\s*\w*)[\s.]*\w*$/i;
  address = address.replace(junkRegex, "");
  address = address.replace(junkRegex, ""); // second pass for chained junk

  // Step 9: Remove trailing bare unit/floor numbers like "Derry Rd 1004" or "Main St E 107"
  // Matches: suffix + optional direction (N/S/E/W) + number
  address = address.replace(
    /\b(Ave|Rd|St|Blvd|Crt|Dr|Cres|Pl|Trl|Cir|Ln|Terr|Grv|Hts|Hllw|Way|Point|Gate|Landing|Line|Close|Crossing|Gardens)(\s+[NSEW])?\s+#?\d+[A-Z]?$/i,
    "$1$2"
  );

  // Step 10: Normalize case — proper title case
  address = address
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      // Keep single-letter directional suffixes: E, W, N, S
      if (/^[NSEWnsew]$/.test(word)) return word.toUpperCase();
      // Title-case any word (handles ALL-CAPS and all-lowercase)
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

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
