// Prebuild test for the VOW line (MC-029): the withheld per-listing facts never reach an
// anonymous surface, and the battery agrees with the code about which facts those are.
//
// The behavioural half runs the real helpers: stripVowFields removes exactly the listed
// columns and nothing else, isPublicListing answers the sale side by status and the lease side
// by leaseStatus, and the display flag wins on both. The structural half reads the source, so a
// future edit that puts `listedAt` back on a card type, serialises a Prisma row without the
// strip, drops the session read from the grid page, or lets the battery's key list drift from
// VOW_ONLY_FIELDS fails here rather than in a TRREB letter.

import { readFileSync } from "node:fs";
import { VOW_ONLY_FIELDS, stripVowFields, isPublicListing } from "@/lib/listings/vow";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  assertions++;
  if (!cond) failures.push(label);
}
const read = (p: string) => readFileSync(p, "utf8");
/** Source with comments removed, so a comment naming a field is not a use of it. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ── behaviour ────────────────────────────────────────────────────────────────────────────
const row = {
  mlsNumber: "W1", price: 1, listOfficeName: "X", status: "active", permAdvertise: true,
  daysOnMarket: 3, listedAt: new Date(), priorPrice: 2, priceChangedAt: new Date(), lastPriceChangeAt: new Date(), soldPrice: null, soldDate: null,
};
const stripped = stripVowFields(row) as Record<string, unknown>;
for (const f of VOW_ONLY_FIELDS) ok(!(f in stripped), `stripVowFields removes ${f}`);
ok(stripped.mlsNumber === "W1" && stripped.price === 1 && stripped.listOfficeName === "X", "stripVowFields keeps the public columns");
ok(!("status" in stripped) && !("leaseStatus" in stripped), "stripVowFields drops the status columns, redundant on a public row");
ok("daysOnMarket" in row, "stripVowFields does not mutate its input");
ok(VOW_ONLY_FIELDS.length === 7, "seven withheld columns");

ok(isPublicListing({ permAdvertise: true, status: "active", transactionType: "For Sale", leaseStatus: null }), "active sale is public");
ok(!isPublicListing({ permAdvertise: true, status: "sold", transactionType: "For Sale", leaseStatus: null }), "sold is not public");
ok(!isPublicListing({ permAdvertise: true, status: "expired", transactionType: "For Sale", leaseStatus: null }), "expired is not public");
ok(isPublicListing({ permAdvertise: true, status: "rented", transactionType: "For Lease", leaseStatus: "active" }), "available lease is public");
ok(!isPublicListing({ permAdvertise: true, status: "rented", transactionType: "For Lease", leaseStatus: "leased" }), "leased is not public");
ok(!isPublicListing({ permAdvertise: false, status: "active", transactionType: "For Sale", leaseStatus: null }), "the display flag wins on the sale side");
ok(!isPublicListing({ permAdvertise: false, status: "rented", transactionType: "For Lease", leaseStatus: "active" }), "the display flag wins on the lease side");

// ── structure ────────────────────────────────────────────────────────────────────────────
const VOW_RE = /\b(daysOnMarket|listedAt|priorPrice|priceChangedAt|lastPriceChangeAt|soldPrice|soldDate)\b/;

// 1. The battery's key list is the code's.
const battery = read("scripts/verify/checks/vow-fields.mjs");
const keys = battery.match(/const VOW_KEYS = \[([^\]]+)\]/)?.[1].match(/'([a-zA-Z]+)'/g)?.map((k) => k.replace(/'/g, "")) ?? [];
ok(keys.length === VOW_ONLY_FIELDS.length && VOW_ONLY_FIELDS.every((f) => keys.includes(f)), `battery VOW_KEYS == VOW_ONLY_FIELDS (got ${keys.join(",")})`);

// 2. No card type or anonymous card component names a withheld column, except under `vow`.
const cardTypes = code("src/components/listings/v2/types.ts");
const outsideVow = cardTypes.replace(/export interface ListingCardVow \{[\s\S]*?\}/, "");
ok(!VOW_RE.test(outsideVow), "ListingCardData names no VOW-only column outside ListingCardVow");
for (const f of [
  "src/components/nav/megaTypes.ts",
  "src/components/nav/SiteNav.tsx",
  "src/components/street/v2/types.ts",
  "src/components/street/v2/sections.tsx",
  "src/types/street.ts",
  "src/components/home/NewestListings.tsx",
  "src/components/places/PlaceListings.tsx",
  "src/app/rentals/RentalsClient.tsx",
  "src/app/listings/[mlsNumber]/ListingDetailClient.tsx",
  "src/app/listings/[mlsNumber]/ListingExtras.tsx",
  "src/app/sales/ads/[mlsNumber]/SalesAdsClient.tsx",
  "src/app/rentals/ads/[mlsNumber]/RentalsAdsClient.tsx",
  "src/app/rentals/ads/AdsClient.tsx",
  "src/components/landing/LiveListingSlider.tsx",
  "src/components/condo/types.ts",
]) {
  ok(!VOW_RE.test(code(f)), `${f} names no VOW-only column`);
}
const card = code("src/components/listings/v2/ListingCard.tsx");
ok(!VOW_RE.test(card.replace(/l\.vow\.[a-zA-Z]+/g, "")), "ListingCard reads VOW-only columns only through l.vow");
ok(/data-vow-facts/.test(card), "ListingCard marks the acknowledged facts with data-vow-facts");

// 3. Every page that serialises Prisma listing rows for a client component strips them first.
for (const f of [
  "src/app/listings/[mlsNumber]/page.tsx",
  "src/app/rentals/page.tsx",
  "src/app/rent/page.tsx",
  "src/app/rentals/ads/page.tsx",
  "src/app/schools/[slug]/page.tsx",
  "src/app/mosques/[slug]/page.tsx",
  "src/app/sales/ads/[mlsNumber]/page.tsx",
  "src/app/rentals/ads/[mlsNumber]/page.tsx",
]) {
  ok(/stripVowFields/.test(code(f)), `${f} strips VOW-only columns before serialising`);
}

// 4. The grid: the sold mode is gone, the session is read on the page, the select is the gate.
const gridPage = code("src/app/listings/page.tsx");
ok(/getSession\(\)/.test(gridPage) && /canSeeVowRecords\(/.test(gridPage), "/listings reads the session server-side and gates through canSeeVowRecords");
ok(/status === 'sold'\) redirect\('\/sold'\)/.test(gridPage), "/listings?status=sold redirects to /sold");
const loader = code("src/lib/listingsV2Data.ts");
ok(!/status: 'sold'|status === 'sold'/.test(loader), "the grid loader has no sold mode");
const cardSelect = loader.match(/const CARD_SELECT = \{([\s\S]*?)\} as const;/)?.[1] ?? "";
ok(cardSelect.length > 0 && !VOW_RE.test(cardSelect), "CARD_SELECT names no VOW-only column");
ok(/PUBLIC_LEASE_WHERE/.test(loader) && /PUBLIC_SALE_WHERE/.test(loader), "the grid loader uses the public predicates");

// 5. The listing page: the public predicate, not the flag alone, and the island is placed.
const detail = code("src/app/listings/[mlsNumber]/page.tsx");
ok((detail.match(/isPublicListing\(/g) ?? []).length >= 2, "listing page gates metadata and render on isPublicListing");
ok(/ListingVowFacts/.test(detail), "listing page places the VOW island");
ok(!/days ago/.test(detail), "listing page metadata no longer says 'Listed N days ago'");

// 6. The gated route checks the session and is dynamic.
const route = code("src/app/api/listings/[mlsNumber]/vow/route.ts");
ok(/force-dynamic/.test(route) && /getSession\(\)/.test(route) && /canSeeVowRecords\(/.test(route), "the VOW route is force-dynamic and gates through canSeeVowRecords");

// 7. The menu: price-change cards are the newest, and the card type has no prior price.
const mega = code("src/lib/megaLive.ts");
ok(!/priorPrice|\.change\b|dom:/.test(mega.replace(/priceChangedAt|lastPriceChangeAt/g, "")), "the menu composer emits no prior price, change or day count");

// 8. One brokerage component, placed inside a data-price element on every card surface.
for (const f of [
  "src/components/listings/v2/ListingCard.tsx",
  "src/components/nav/SiteNav.tsx",
  "src/components/street/v2/sections.tsx",
  "src/components/home/NewestListings.tsx",
  "src/components/places/PlaceListings.tsx",
  "src/components/condo/sections.tsx",
  "src/app/rentals/RentalsClient.tsx",
  "src/app/listings/[mlsNumber]/ListingDetailClient.tsx",
  "src/app/sales/ads/[mlsNumber]/SalesAdsClient.tsx",
  "src/app/rentals/ads/[mlsNumber]/RentalsAdsClient.tsx",
  "src/app/rentals/ads/AdsClient.tsx",
  "src/components/landing/LiveListingSlider.tsx",
]) {
  const s = code(f);
  ok(/<ListingBrokerage\b/.test(s) && /data-price/.test(s), `${f} renders ListingBrokerage inside a data-price element`);
}

if (failures.length) {
  console.error(`[vow-fields] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`[vow-fields] PASS: ${assertions} assertions.`);
