// THE GATED SOLD RECORDS (MC-046 Stage 1). Every function here reads DB2 and takes a VowAccess
// from src/lib/vow/door.ts as its first argument: a reader who passed canSeeVowRecords (the route
// or page obtains it with vowReaderAccess). Without one there is no connection to read with.
//
// All queries enforce VOW compliance (perm_advertise = TRUE, the 90-day window, the
// transaction_type filter, the 100-record cap). Nothing is cached in Upstash any more (R18): a
// shared key would hold VOW records outside the door. The public stat readers this file used to
// carry (street and neighbourhood sale and lease stats, monthly sales, Milton totals) left with
// the visitor view and were deleted; Stage 2's gated ledger reads through the door.

import "server-only";
import { neighbourhoodRows } from "@/lib/hubSets";
import { soldDb, type VowAccess } from "@/lib/vow/door";
import { config } from "./config";
import type { SoldRecord } from "./db-types";

const MAX_CONSUMER_RECORDS = 100; // VOW rule — never exceed per consumer query

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
}

// ────────────────────────────────────────
// RAW RECORDS (authed-only callers must gate)
// ────────────────────────────────────────

export interface SoldListItem {
  mls_number: string;
  address: string;               // already redacted if display_address = false
  street_name: string;           // "" if display_address = false
  street_slug: string;           // "" if display_address = false
  neighbourhood: string;
  sold_price: number;
  list_price: number;
  sold_to_ask_ratio: number;
  sold_date: string;
  days_on_market: number;
  beds: number | null;
  baths: number | null;
  property_type: string;
  transaction_type: "For Sale" | "For Lease";
  mls_status: string;
  sqft_range: string | null;
  /** Listing Brokerage (TREB ListOfficeName). Required per-record display (VOW 6.3(c)). */
  list_office_name: string | null;
}

function toListItem(r: SoldRecord): SoldListItem {
  // InternetAddressDisplayYN=N withholds the street as well as the number: a withheld row
  // may be counted but not placed, so the street column and the street link go blank with
  // the address. lat/lng never leave SoldRecord. The neighbourhood stays; it is not an
  // address field.
  const withheld = !r.display_address;
  return {
    mls_number: r.mls_number,
    address: withheld ? "Address on request" : r.address,
    street_name: withheld ? "" : r.street_name,
    street_slug: withheld ? "" : r.street_slug,
    neighbourhood: r.neighbourhood,
    sold_price: n(r.sold_price) ?? 0,
    list_price: n(r.list_price) ?? 0,
    sold_to_ask_ratio: n(r.sold_to_ask_ratio) ?? 0,
    sold_date: r.sold_date,
    days_on_market: r.days_on_market,
    beds: r.beds,
    baths: n(r.baths),
    property_type: r.property_type,
    transaction_type: (r.transaction_type as "For Sale" | "For Lease") ?? "For Sale",
    mls_status: r.mls_status,
    sqft_range: r.sqft_range,
    list_office_name: r.list_office_name ?? null,
  };
}

export async function getStreetSoldList(
  access: VowAccess,
  streetSlug: string,
  type: "sale" | "lease",
  days: number = 90,
  limit: number = 20
): Promise<SoldListItem[]> {
  const db = soldDb(access);
  if (!db) return [];
  const safeDays = Math.min(90, Math.max(1, days));
  const safeLimit = Math.min(MAX_CONSUMER_RECORDS, Math.max(1, limit));
  const txn = type === "sale" ? "For Sale" : "For Lease";
  const rows = (await db`
    SELECT * FROM sold.sold_records
    WHERE street_slug = ${streetSlug}
      AND perm_advertise = TRUE
      AND transaction_type = ${txn}
      AND sold_date >= NOW() - (${safeDays} || ' days')::interval
      AND sold_date <= NOW() -- DEC-SOLD-UPPER-BOUND
    ORDER BY sold_date DESC
    LIMIT ${safeLimit}
  `) as Array<SoldRecord>;
  return rows.map(toListItem);
}

export async function getNeighbourhoodSoldList(
  access: VowAccess,
  neighbourhood: string,
  type: "sale" | "lease",
  days: number = 90,
  limit: number = 20
): Promise<SoldListItem[]> {
  const db = soldDb(access);
  if (!db) return [];
  const safeDays = Math.min(90, Math.max(1, days));
  const safeLimit = Math.min(MAX_CONSUMER_RECORDS, Math.max(1, limit));
  const txn = type === "sale" ? "For Sale" : "For Lease";
  const rows = (await db`
    SELECT * FROM sold.sold_records
    WHERE neighbourhood = ${neighbourhood}
      AND perm_advertise = TRUE
      AND transaction_type = ${txn}
      AND sold_date >= NOW() - (${safeDays} || ' days')::interval
      AND sold_date <= NOW() -- DEC-SOLD-UPPER-BOUND
    ORDER BY sold_date DESC
    LIMIT ${safeLimit}
  `) as Array<SoldRecord>;
  return rows.map(toListItem);
}

export async function getRecentSoldList(
  access: VowAccess,
  type: "sale" | "lease",
  days: number = 90,
  limit: number = 60,
  filters?: { neighbourhood?: string; property_type?: string }
): Promise<SoldListItem[]> {
  const db = soldDb(access);
  if (!db) return [];
  const safeDays = Math.min(90, Math.max(1, days));
  const safeLimit = Math.min(MAX_CONSUMER_RECORDS, Math.max(1, limit));
  const txn = type === "sale" ? "For Sale" : "For Lease";
  const nbhd = filters?.neighbourhood ?? null;
  const ptype = filters?.property_type ?? null;
  const rows = (await db`
    SELECT * FROM sold.sold_records
    WHERE city = ${config.PRISMA_CITY_VALUE}
      AND perm_advertise = TRUE
      AND transaction_type = ${txn}
      AND sold_date >= NOW() - (${safeDays} || ' days')::interval
      AND sold_date <= NOW() -- DEC-SOLD-UPPER-BOUND
      AND (${nbhd}::text IS NULL OR neighbourhood = ${nbhd})
      AND (${ptype}::text IS NULL OR property_type = ${ptype})
    ORDER BY sold_date DESC
    LIMIT ${safeLimit}
  `) as Array<SoldRecord>;
  return rows.map(toListItem);
}

/** One neighbourhood filter option: a stable slug for the URL, a clean name for the label, and the
 *  raw MLS string the query actually needs.
 *
 *  The chips used to put the RAW MLS string straight into the query — "?nbhd=1026 - CB Cobban".
 *  Some of those raw strings contain literal newlines, so we were emitting crawlable URLs with
 *  control characters in them, and every one was a distinct path for a crawler to spend budget on.
 *  The slug is stable, readable and safe; the raw string never leaves the server. */
export interface SoldNeighbourhoodOption {
  slug: string;
  name: string;
  raw: string;
}

/** Slugify a raw MLS neighbourhood string as a last resort — "1026 - CB Cobban" -> "cobban". */
function slugifyRawNeighbourhood(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^\s*\d+\s*-\s*[A-Z]{1,3}\s+/, "") // strip the "1026 - CB " MLS prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Distinct sold neighbourhoods as {slug,name,raw}, joined to the Neighbourhood registry where
 *  possible so the slug matches the rest of the site. */
export async function getSoldNeighbourhoodOptions(access: VowAccess | null): Promise<SoldNeighbourhoodOption[]> {
  // Without a reader's access there is no sold record to name a neighbourhood from; the page
  // falls back to the registry's own raw strings.
  if (!access) return [];
  const raws = await getDistinctSoldNeighbourhoods(access);
  if (raws.length === 0) return [];
  const registry = await neighbourhoodRows().catch(() => [] as Array<{ slug: string; name: string; rawStrings: string[] }>);
  const byRaw = new Map<string, { slug: string; name: string }>();
  for (const n of registry) for (const r of n.rawStrings ?? []) byRaw.set(r, { slug: n.slug, name: n.name });
  return raws.map((raw) => {
    const hit = byRaw.get(raw);
    return {
      raw,
      slug: hit?.slug ?? slugifyRawNeighbourhood(raw),
      name: hit?.name ?? slugifyRawNeighbourhood(raw).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  });
}

async function getDistinctSoldNeighbourhoods(access: VowAccess): Promise<string[]> {
  const db = soldDb(access);
  if (!db) return [];
  const rows = (await db`
    SELECT DISTINCT neighbourhood FROM sold.sold_records
    WHERE city = ${config.PRISMA_CITY_VALUE} AND perm_advertise = TRUE
      AND transaction_type = 'For Sale'
      AND sold_date >= NOW() - INTERVAL '90 days' AND sold_date <= NOW()
    ORDER BY neighbourhood ASC
  `) as Array<{ neighbourhood: string }>;
  return rows.map((r) => r.neighbourhood);
}
