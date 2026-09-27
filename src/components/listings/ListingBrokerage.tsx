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

/** Our own office, for COMPARISON only. The feed spells it "RE/MAX REALTY SPECIALISTS INC." with no
 *  registration descriptor, and the config carries the registered name "RE/MAX Realty Specialists
 *  Inc., Brokerage": the key drops a trailing "Brokerage", case and punctuation, so both sides are
 *  the same office whichever way either is spelled. The key itself never renders. */
const officeKey = (s: string) => s.toLowerCase().replace(/,?\s*brokerage\s*$/, "").replace(/[^a-z0-9]+/g, "");
const OUR_OFFICE_KEY = officeKey(config.brokerage.name);
export function isOurBrokerage(raw: string | null | undefined): boolean {
  return !!raw && officeKey(raw) === OUR_OFFICE_KEY;
}

/** The feed's ALL-CAPS office name as prose. One rule for every surface. Our own office prints its
 *  registered name in full instead, config.brokerage.name: the feed carries it without ", Brokerage"
 *  and Ontario requires the registered name wherever the brokerage names itself (MC-043). Every
 *  other office keeps the feed's name, cased. */
export function brokerageDisplayName(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  if (isOurBrokerage(raw)) return config.brokerage.name;
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

/**
 * THE SEPARATION LINE (MC-036, TRREB VOW rules item 8). Our contact card sits beside a listing
 * held by another brokerage, so the card says whose it is before it asks for a name: the first
 * line of every contact card on a listing surface, in the card's normal text size, never a
 * footnote. Names the listing brokerage when the feed supplies one that is not ours.
 */
export function contactSeparationLine(listOfficeName: string | null | undefined): string {
  // On our own listing the appositive names the brokerage, never the salesperson (MC-043).
  if (isOurBrokerage(listOfficeName)) return `Contact ${config.realtor.name} of the listing brokerage, ${config.brokerage.name}`;
  const label = brokerageDisplayName(listOfficeName);
  return `Contact ${config.realtor.name} (${config.brokerage.name}), not the listing brokerage${label ? ` (${label})` : ""}`;
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
