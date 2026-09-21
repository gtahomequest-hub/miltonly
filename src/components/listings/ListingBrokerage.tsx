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
import { config } from "@/lib/config";

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

/** Our own office, as the site names it: the feed's "RE/MAX REALTY SPECIALISTS INC." and the
 *  config's "RE/MAX Realty Specialists Inc." are the same office, so the comparison drops case
 *  and punctuation. */
const OUR_OFFICE = config.brokerage.name.replace(", Brokerage", "");
const officeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
export function isOurBrokerage(raw: string | null | undefined): boolean {
  return !!raw && officeKey(raw) === officeKey(OUR_OFFICE);
}

/**
 * THE SEPARATION LINE (MC-036, TRREB VOW rules item 8). Our contact card sits beside a listing
 * held by another brokerage, so the card says whose it is before it asks for a name: the first
 * line of every contact card on a listing surface, in the card's normal text size, never a
 * footnote. Names the listing brokerage when the feed supplies one that is not ours.
 */
export function contactSeparationLine(listOfficeName: string | null | undefined): string {
  const ours = `Contact ${config.realtor.name}, ${OUR_OFFICE}`;
  if (isOurBrokerage(listOfficeName)) return `${ours}, the listing brokerage`;
  const label = brokerageDisplayName(listOfficeName);
  return `${ours}, not the listing brokerage${label ? ` (${label})` : ""}`;
}

/** What the brokerage line says when the feed carries no office name: a price never stands
 *  alone, so the absence is printed in the brokerage's place rather than left blank. */
export const BROKERAGE_UNSUPPLIED = "Listing brokerage not supplied by the feed";

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
  // An empty name once returned null, so a listing without an office name rendered its price
  // with no brokerage line and the battery's per-element check had nothing to measure.
  if (!label) {
    return (
      <span data-brokerage data-brokerage-unsupplied className="listing-brokerage" style={{ ...INHERIT, ...style }}>
        {BROKERAGE_UNSUPPLIED}
      </span>
    );
  }
  return (
    <span data-brokerage className="listing-brokerage" style={{ ...INHERIT, ...style }}>
      {prefix}
      {label}
    </span>
  );
}
