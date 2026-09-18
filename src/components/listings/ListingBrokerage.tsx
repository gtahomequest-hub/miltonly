// src/components/listings/ListingBrokerage.tsx
// THE ONE BROKERAGE LINE (MC-029, TRREB VOW/IDX rules item 27). Wherever a listing is shown, the
// listing brokerage is shown with it, in the same typeface, size, weight and colour as the
// listing data it sits beside, inside the card body. It was a 10px grey footnote on the grid
// card, absent from the street tiles and the menu cards, and a different helper title-cased it
// on each surface.
//
// The component carries no size of its own: it inherits the font and colour of the element it
// is placed in, so a surface renders it INSIDE its price element and the two cannot drift apart.
// `data-brokerage` is the battery's hook (scripts/verify/checks/vow-fields.mjs measures its
// computed font size against the `data-price` element beside it). Server and client safe.

import type { CSSProperties } from "react";

const SMALL = new Set(["of", "at", "the", "in", "and", "on", "for", "by", "to"]);
const FIXUPS: Record<string, string> = {
  Remax: "RE/MAX",
  "Re/Max": "RE/MAX",
  Mls: "MLS",
  Ltd: "Ltd.",
  Inc: "Inc.",
  Llc: "LLC",
  Re: "RE",
  Ipro: "iPro",
  Exp: "eXp",
};

/** The feed's ALL-CAPS office name as prose. One rule for every surface. */
export function brokerageDisplayName(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cased = raw
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((tok, i) => {
      if (!tok.trim() || tok === "/" || tok === "-") return tok;
      if (i > 0 && SMALL.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join("");
  return Object.entries(FIXUPS).reduce((acc, [from, to]) => acc.replace(new RegExp(`\\b${from}\\b`, "g"), to), cased).replace(/\.\./g, ".");
}

const INHERIT: CSSProperties = {
  display: "block",
  font: "inherit",
  color: "inherit",
  letterSpacing: "inherit",
  lineHeight: "inherit",
  textDecoration: "none",
  textTransform: "none",
  marginTop: "0.2em",
};

/**
 * Renders the listing brokerage. Place it inside the element that renders the price (or the
 * listing data it must match) so it inherits that element's font and colour.
 */
export default function ListingBrokerage({ name, prefix = "Listed by ", style }: { name: string | null | undefined; prefix?: string; style?: CSSProperties }) {
  const label = brokerageDisplayName(name);
  if (!label) return null;
  return (
    <span data-brokerage className="listing-brokerage" style={{ ...INHERIT, ...style }}>
      {prefix}
      {label}
    </span>
  );
}
