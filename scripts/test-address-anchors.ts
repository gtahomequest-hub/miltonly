// scripts/test-address-anchors.ts
// PREBUILD GUARD — QUEUE item 3, address anchors.
//
// TWO THINGS THIS EXISTS TO STOP, both of which would ship silently.
//
// 1. A PRICE REACHING THE ADDRESS ITEMLIST. A single address is a population of one, so no
//    k-anonymity threshold can make a per-address figure safe. The rule is "never, at any k", and
//    a rule that lives only in a comment is a rule that survives until the next edit. This scans
//    the emitted JSON-LD for a price-shaped KEY (offers, price, amount, currency…) and for a
//    price-shaped VALUE, and fails on either. `offers` is the specific shape to fear: it is the
//    one node that would smuggle a figure onto a residence and still validate.
//
// 2. A NON-NUMERIC ANCHOR id. The whole route contract is /streets/<slug>#<houseNumber>. An id
//    that is not the bare house number breaks every deep link into the page without breaking the
//    build, the render or any test that only looks at data. So this RENDERS the section and reads
//    the ids back out of the markup — it does not assert that the component imports something.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { buildAddressLadder, type AddressLadderListing } from "../src/lib/streetAddresses";
import { buildAddressesItemListSchema } from "../src/lib/schema/street-schema";
import { StreetAddresses } from "../src/components/street/v2/AddressLadder";
import type { StreetV2Data } from "../src/components/street/v2/types";

const failures: string[] = [];
const stripMarkers = (html: string) => html.split("<!-- -->").join("");
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
};

// ── fixtures ────────────────────────────────────────────────────────────────
// Real Town data for a real street, plus DB1 rows shaped like the ones the page fetches. The
// listing rows deliberately carry a `price` the ladder must never read.

const listings: AddressLadderListing[] = [
  { address: "262 Pine Street, Milton, ON L9T 2M8", mlsNumber: "W1234567", status: "active", permAdvertise: true, propertySubType: "Detached", propertyType: "Detached" },
  { address: "279 Pine Street, Milton, ON", mlsNumber: "W7654321", status: "expired", permAdvertise: true, propertySubType: "Att/Row/Townhouse", propertyType: "Townhouse" },
  { address: "290 Pine Street, Milton, ON", mlsNumber: "W1111111", status: "active", permAdvertise: false, propertySubType: "Detached", propertyType: "Detached" },
  { address: "1000 Asleton Boulevard, Milton, ON", mlsNumber: "W2222222", status: "active", permAdvertise: true, propertySubType: "Detached", propertyType: "Detached" },
];

const ladder = buildAddressLadder({
  slug: "pine-street-milton",
  streetName: "Pine Street",
  listings,
  linkableSlugs: new Set(["ontario-street-milton"]),
});

ok("pine-street-milton has a ladder", ladder !== null);

if (!ladder) {
  console.error("test-address-anchors FAILED\n  no ladder for pine-street-milton");
  process.exit(1);
}

// ── the join is by house number AND street identity ─────────────────────────

const at = (n: number) => ladder.marks.find((m) => m.number === n) ?? null;

ok("262 is present", at(262) !== null);
ok("262 is listed now", at(262)?.active?.mlsNumber === "W1234567", JSON.stringify(at(262)?.active));
ok("262 links to its listing", at(262)?.active?.href === "/listings/W1234567");
ok("262 carries its form", at(262)?.form === "Detached", String(at(262)?.form));

ok("279 has a form from an expired listing", at(279)?.form === "Townhouse", String(at(279)?.form));
ok("279 is NOT listed now", at(279)?.active === null);

ok("290 is not listed now — permAdvertise false", at(290)?.active === null, JSON.stringify(at(290)?.active));

ok("251 has no form — never listed", at(251)?.form === null, String(at(251)?.form));
ok("251 is not listed now", at(251)?.active === null);

// A listing on another street cannot attach to this one, whatever slug ingest filed it under.
ok("no Asleton number leaked in", ladder.marks.every((m) => m.number !== 1000));

// ── sides, order and position ───────────────────────────────────────────────

ok("odd numbers are the odd side", ladder.marks.every((m) => (m.number % 2 === 1) === (m.side === "odd")));
ok("fractions are within 0-1", ladder.marks.every((m) => m.fraction >= 0 && m.fraction <= 1));
ok("marks ascend by number", ladder.marks.every((m, i) => i === 0 || m.number > ladder.marks[i - 1].number));
ok("the low end is 0", Math.min(...ladder.marks.map((m) => m.fraction)) === 0);
ok("the high end is 1", Math.max(...ladder.marks.map((m) => m.fraction)) === 1);
ok("low and high are the number range", ladder.low === 251 && ladder.high === 446, `${ladder.low}-${ladder.high}`);

// Cross streets are ordered from the low-number end, which is what the summary sentence claims.
ok("cross streets are in order", ladder.crossStreets.every((c, i) => i === 0 || c.fraction >= ladder.crossStreets[i - 1].fraction));
ok("a published cross street links", ladder.crossStreets.some((c) => c.href === "/streets/ontario-street-milton"));
ok("an unlisted cross street does not link", ladder.crossStreets.some((c) => c.slug !== "ontario-street-milton" && c.href === null));
ok("cross street names come from the resolver", ladder.crossStreets.every((c) => /^[A-Z]/.test(c.name) && !c.name.includes("-")));

// ── the summary sentence is data, not prose from a model ────────────────────

ok("summary names the count", ladder.summary.includes(`${ladder.count} civic addresses`), ladder.summary);
ok("summary carries the range with an en-dash", ladder.summary.includes("251–446"), ladder.summary);
ok("summary has no em-dash", !ladder.summary.includes("—"), ladder.summary);
ok("summary has no dollar sign", !ladder.summary.includes("$"), ladder.summary);
ok("summary names cross streets in order", ladder.summary.indexOf("Charles Street") < ladder.summary.indexOf("Ontario Street"), ladder.summary);

// ── a street the Town has no address points for renders nothing ─────────────

ok(
  "an unknown street returns null, not an empty ladder",
  buildAddressLadder({ slug: "not-a-street-at-all-milton", streetName: "Not A Street", listings: [] }) === null
);

// ── RULE 1: no price-shaped value anywhere in the ItemList ──────────────────

const schema = buildAddressesItemListSchema(ladder, "pine-street-milton", "Pine Street") as Record<string, unknown> | null;
ok("an ItemList is emitted", schema !== null);

const PRICE_KEY = /price|offer|amount|currency|cost|valuation|sold|sale/i;
const PRICE_VALUE = /\$|\b\d{3},\d{3}\b|\b\d{6,}\b/;

function scan(node: unknown, path: string): void {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    if (PRICE_VALUE.test(node)) failures.push(`  price-shaped VALUE at ${path}: ${node}`);
    return;
  }
  if (typeof node === "number") {
    if (node >= 100000) failures.push(`  price-shaped NUMBER at ${path}: ${node}`);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => scan(v, `${path}[${i}]`));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (PRICE_KEY.test(k)) failures.push(`  price-shaped KEY at ${path}.${k}`);
      scan(v, `${path}.${k}`);
    }
  }
}
scan(schema, "ItemList");

const items = ((schema?.itemListElement as Array<Record<string, unknown>>) ?? []).map(
  (li) => li.item as Record<string, unknown>
);
ok("every item is a PostalAddress", items.length > 0 && items.every((it) => it["@type"] === "PostalAddress"));
ok("every item carries streetAddress", items.every((it) => typeof it.streetAddress === "string" && (it.streetAddress as string).includes("Pine Street")));
ok("every item is in Milton, ON, CA", items.every((it) => it.addressLocality === "Milton" && it.addressRegion === "ON" && it.addressCountry === "CA"));
ok("every item url is the page anchor", items.every((it) => /^https:\/\/miltonly\.com\/streets\/pine-street-milton#\d+$/.test(String(it.url))));
ok("the ItemList covers every mark", items.length === ladder.marks.length, `${items.length} vs ${ladder.marks.length}`);

// ── RULE 2: every rendered address id is numeric ────────────────────────────

// React writes a <!-- --> separator between adjacent text nodes under renderToString; strip it
// so this asserts the heading TEXT and not one renderer's spacing.
const markup = stripMarkers(renderToStaticMarkup(
  createElement(StreetAddresses, {
    data: { name: "Pine Street", addresses: ladder } as unknown as StreetV2Data,
  })
));

const ids = [...markup.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]).filter((v) => v !== "addresses");
ok("the section rendered its addresses", ids.length === ladder.marks.length, `${ids.length} ids vs ${ladder.marks.length} marks`);
ok("every address id is numeric", ids.every((v) => /^[0-9]+$/.test(v)), ids.filter((v) => !/^[0-9]+$/.test(v)).join(", "));
ok(
  "every mark has an id and an anchor onto itself",
  ladder.marks.every((m) => markup.includes(`id="${m.number}"`) && markup.includes(`href="#${m.number}"`))
);
ok("the ids match the ItemList urls", ids.join(",") === items.map((it) => String(it.url).split("#")[1]).join(","));
ok("no dollar sign is rendered", !markup.includes("$"));
ok("the H2 is the scoped heading", markup.includes("<h2>Addresses on Pine Street</h2>"), "");
ok("the summary is rendered as plain text", markup.includes(ladder.summary));

// ── report ──────────────────────────────────────────────────────────────────

const ASSERTIONS = 30;
if (failures.length > 0) {
  console.error(`test-address-anchors FAILED (${failures.length} of ${ASSERTIONS})`);
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`test-address-anchors PASS · ${ASSERTIONS} assertions · ${ladder.marks.length} addresses on Pine Street`);
