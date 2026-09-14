// src/lib/listingStyle.ts
//
// The TRREB feed spells a building's style the way its enumeration does: "2-Storey",
// "Bungalow-Raised", "Backsplit 4", "1 Storey/Apt". Those are field values, not prose, and the
// nightly audit reads any of them in rendered text as a raw field that reached the page without a
// label map (MA-003, `treb-string`). This is the one formatter between the feed's style string and
// a reader. Every render site of `architecturalStyle` goes through it; none prints the raw value.
//
// The map covers every distinct value in DB1 as of 2026-09-13. A value it has never seen falls
// through to a sentence-cased copy of itself rather than nothing, so a new feed value shows up as
// readable text and as a `treb-string` finding, which is the signal to extend the map.

const STYLE_LABELS: Record<string, string | null> = {
  "2-Storey": "Two-storey",
  "3-Storey": "Three-storey",
  "1 1/2 Storey": "One-and-a-half storey",
  "2 1/2 Storey": "Two-and-a-half storey",
  "1 Storey/Apt": "One storey",
  "Apartment": "Apartment",
  "Bungalow": "Bungalow",
  "Bungalow-Raised": "Raised bungalow",
  "Bungaloft": "Bungalow with loft",
  "Backsplit 3": "Three-level backsplit",
  "Backsplit 4": "Four-level backsplit",
  "Backsplit 5": "Five-level backsplit",
  "Backsplit": "Back-split",
  "Sidesplit 3": "Three-level sidesplit",
  "Sidesplit 4": "Four-level sidesplit",
  "Sidesplit 5": "Five-level sidesplit",
  "Sidesplit": "Side-split",
  "Stacked Townhouse": "Stacked townhouse",
  "Multi-Level": "Multi-level",
  "Loft": "Loft",
  // "Other" says nothing a reader can use; the site prints nothing rather than the word.
  "Other": null,
};

/** The reader's name for a feed style string, or null when there is nothing worth printing. */
export function formatArchitecturalStyle(raw: string | null | undefined): string | null {
  const key = (raw ?? "").trim();
  if (!key) return null;
  if (key in STYLE_LABELS) return STYLE_LABELS[key];
  // The feed can join several values with ", " (detect/route.ts); label each and rejoin.
  if (key.includes(", ")) {
    const parts = key.split(", ").map((p) => formatArchitecturalStyle(p)).filter((p): p is string => !!p);
    return parts.length ? parts.join(", ") : null;
  }
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}
