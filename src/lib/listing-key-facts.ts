// Pure extractor for the "Key facts" card on /sales/ads/[mlsNumber].
// Surfaces structured Listing metadata (cross street, direction faces,
// construction stack, fireplace, MLS#, taxes, lot dimensions) as a
// two-column grid alongside the existing About-this-property + Highlights
// cards. Card hides when this returns an empty array.
//
// Lot-dimension sanity floor — important background:
//
// Listing.lotWidth and Listing.lotDepth are stored as raw floats from the
// TRREB ingest pipeline with NO co-stored unit field. Production data is
// feet for ~75% of records (sampled across 480 active Milton listings,
// median lotWidth ≈ 36 ft for detached freeholds). But some agents enter
// meters at the TRREB source, and the ingest doesn't normalize. The
// resulting record looks like a tiny lot (e.g. W13120162 has lotWidth
// = 9.15, lotDepth = 27 — physically impossible in feet for a 2,250 sqft
// detached, but a plausible 30ft × 89ft frontage when read as meters).
//
// This extractor's sanity floor (15 ft frontage, 25 ft depth) catches
// the meter-mis-entry pattern by omitting both rows when either value
// is below the floor. The honest path: when units are ambiguous, omit
// rather than guess.
//
// Permanent fix lives upstream — adding lotSizeUnits to the ingest +
// back-filling existing rows. Until then, this floor + a dev-only
// console.warn surface the affected listings to whoever is debugging.

export interface KeyFactsInput {
  mlsNumber: string;
  lotWidth: number | null;
  lotDepth: number | null;
  crossStreet: string | null;
  directionFaces: string | null;
  construction: string | null;
  roof: string | null;
  foundation: string | null;
  fireplace: boolean;
  taxAmount: number | null;
  taxYear: number | null;
}

export interface KeyFact {
  label: string;
  value: string;
}

const LOT_WIDTH_FLOOR_FT = 15;
const LOT_DEPTH_FLOOR_FT = 25;

// Trim insignificant trailing zeros (50.0 → "50") while preserving
// meaningful precision (36.14 → "36.14"). parseFloat handles this
// natively when the input is already a string with fixed decimals.
function formatLotFt(value: number): string {
  return `${parseFloat(value.toFixed(2))} ft`;
}

function formatTax(amount: number, year: number | null): string {
  const dollars = Math.round(amount).toLocaleString("en-US");
  return year ? `$${dollars}/year (${year})` : `$${dollars}/year`;
}

export function extractKeyFacts(input: KeyFactsInput): KeyFact[] {
  const facts: KeyFact[] = [];

  // Lot dimensions — both must be populated AND pass the sanity floor.
  // If either is missing or below the floor, both rows are omitted.
  // Single-field partial data is also skipped (a one-sided lot row
  // without the other reads as broken).
  if (input.lotWidth !== null && input.lotDepth !== null) {
    if (input.lotWidth >= LOT_WIDTH_FLOOR_FT && input.lotDepth >= LOT_DEPTH_FLOOR_FT) {
      facts.push({ label: "Lot frontage", value: formatLotFt(input.lotWidth) });
      facts.push({ label: "Lot depth", value: formatLotFt(input.lotDepth) });
    } else if (process.env.NODE_ENV === "development") {
      // Dev-only warning. Surfaces the affected listings to whoever is
      // running the local dev server so the underlying ingest fix is
      // tracked. Production builds never emit this — paid-traffic users
      // see a clean card with the lot rows quietly omitted.
      console.warn(
        `[KeyFacts] Lot dimensions skipped for ${input.mlsNumber}: ` +
          `lotWidth=${input.lotWidth}, lotDepth=${input.lotDepth}. ` +
          `Suspect meter-mis-entry. Add lotSizeUnits ingest fix to fix permanently.`,
      );
    }
  }

  // Single-field rows — push when the field is populated. Order matches
  // the on-card visual sequence (cross-street → orientation → materials).
  if (input.crossStreet) facts.push({ label: "Cross street", value: input.crossStreet });
  if (input.directionFaces) facts.push({ label: "Faces", value: input.directionFaces });
  if (input.construction) facts.push({ label: "Construction", value: input.construction });
  if (input.roof) facts.push({ label: "Roof", value: input.roof });
  if (input.foundation) facts.push({ label: "Foundation", value: input.foundation });
  // Fireplace is a Yes-only signal — negative facts add nothing.
  if (input.fireplace === true) facts.push({ label: "Fireplace", value: "Yes" });

  // MLS # — anchor identifier, but still gated so an all-empty test
  // input produces an empty array (card hides cleanly when nothing
  // is extractable, per spec).
  if (input.mlsNumber) facts.push({ label: "MLS #", value: input.mlsNumber });
  if (input.taxAmount !== null) {
    facts.push({ label: "Property taxes", value: formatTax(input.taxAmount, input.taxYear) });
  }

  return facts;
}
