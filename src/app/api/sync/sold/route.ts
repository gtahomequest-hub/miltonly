// VOW sold records sync — TREB AMP OData → sold.sold_records.
//
// DATA FLOW: TREB VOW feed → DB2 (sold schema). Never touches DB1.
//
// Architecture decisions (Phase 1, locked):
//   Point 1 — NEVER delete from sold.sold_records. VOW 90-day rule is enforced
//             on the read path, not here.
//   Point 3 — (Unified with Point A) ingest ALL records regardless of
//             PermAdvertise. Flags stored on the row. Display filter handles
//             compliance, and flips (true→false) are captured on next sync.
//   Point 5 — NO triggerStatsCompute() call. The 11:30 UTC cron runs stats
//             compute independently.
//   Point 7 — Authorization header only (Vercel cron injects it automatically
//             from the CRON_SECRET env var).
//   Point B — On first run (empty table), backfill all available Milton history
//             via CloseDate cursor. Subsequent runs are incremental by
//             ModificationTimestamp cursor with no CloseDate lower bound.
//   Point C — Sync records regardless of MlsStatus; store current status so
//             flips (Sold → Active after deal collapse) are honored on read.
//
// Auth: Authorization: Bearer <CRON_SECRET>.

import { NextRequest, NextResponse } from "next/server";
import { soldDb } from "@/lib/db";
import { extractStreetName, streetNameToSlug } from "@/lib/streetUtils";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TREB_API_URL = process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property";
const TREB_TOKEN = process.env.TREB_API_TOKEN || "";
const PAGE_SIZE = 500;

// Fields we need for a sold record. Includes ModificationTimestamp (cursor),
// PermAdvertise flags (compliance), and status fields (mutation tracking).
const SELECT_FIELDS = [
  "ListingKey",
  "UnparsedAddress", "StreetNumber", "StreetName", "StreetSuffix",
  "City", "CityRegion",
  "ListPrice", "ClosePrice",
  "CloseDate", "ListDate", "OriginalEntryTimestamp",
  "BedroomsTotal", "BathroomsTotalInteger",
  "PropertyType", "PropertySubType",
  "LivingAreaRange",
  "Latitude", "Longitude",
  "MlsStatus", "TransactionType",
  "InternetEntireListingDisplayYN",
  "InternetAddressDisplayYN",
  "ModificationTimestamp",
].join(",");

interface AmpSoldRecord {
  ListingKey: string;
  UnparsedAddress: string | null;
  StreetNumber: string | null;
  StreetName: string | null;
  StreetSuffix: string | null;
  City: string | null;
  CityRegion: string | null;
  ListPrice: number | null;
  ClosePrice: number | null;
  CloseDate: string | null;
  ListDate: string | null;
  OriginalEntryTimestamp: string | null;
  BedroomsTotal: number | null;
  BathroomsTotalInteger: number | null;
  PropertyType: string | null;
  PropertySubType: string | null;
  LivingAreaRange: string | null;
  Latitude: number | null;
  Longitude: number | null;
  MlsStatus: string | null;
  TransactionType: string | null;
  InternetEntireListingDisplayYN: boolean | null;
  InternetAddressDisplayYN: boolean | null;
  ModificationTimestamp: string | null;
}

function mapPropertyType(type: string | null, subType: string | null): string {
  const sub = (subType || "").toLowerCase();
  if (sub.includes("detach") && !sub.includes("semi")) return "detached";
  if (sub.includes("semi")) return "semi";
  if (sub.includes("town") || sub.includes("row")) return "townhouse";
  if (sub.includes("condo") || sub.includes("apart") || sub.includes("strata")) return "condo";
  const t = (type || "").toLowerCase();
  if (t.includes("condo")) return "condo";
  if (t.includes("residential")) return "detached";
  return "other";
}

function buildAddress(item: AmpSoldRecord): string {
  return (
    item.UnparsedAddress ||
    [item.StreetNumber, item.StreetName, item.StreetSuffix].filter(Boolean).join(" ")
  );
}

function computeDaysOnMarket(listDate: string | null, closeDate: string | null): number {
  if (!listDate || !closeDate) return 0;
  const l = new Date(listDate).getTime();
  const c = new Date(closeDate).getTime();
  if (!Number.isFinite(l) || !Number.isFinite(c) || c < l) return 0;
  return Math.round((c - l) / (1000 * 60 * 60 * 24));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch one page with exponential backoff on 429/503. */
async function fetchPage(filter: string, orderby: string): Promise<AmpSoldRecord[]> {
  const url = `${TREB_API_URL}?$select=${SELECT_FIELDS}&$filter=${encodeURIComponent(
    filter
  )}&$top=${PAGE_SIZE}&$orderby=${orderby}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TREB_TOKEN}`, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.value as AmpSoldRecord[]) ?? [];
    }
    if (res.status === 429 || res.status === 503) {
      attempt++;
      if (attempt > 5) throw new Error(`TREB backoff exhausted: ${res.status}`);
      const wait = Math.min(30_000, 1000 * Math.pow(2, attempt));
      await sleep(wait);
      continue;
    }
    throw new Error(`TREB error: ${res.status} ${res.statusText}`);
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!header || !process.env.CRON_SECRET || header !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!soldDb) {
    return NextResponse.json(
      { error: "SOLD_DATABASE_URL is not configured" },
      { status: 503 }
    );
  }

  const started = Date.now();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let pagesFetched = 0;

  // Determine cursor.
  // - Empty table → backfill: fetch by CloseDate ASC, all Milton Sold history
  //   (bounded below by 2010-01-01 to avoid pathological pre-data ranges).
  // - Populated table → incremental: fetch by ModificationTimestamp > max(we have).
  const stateRows = (await soldDb`
    SELECT
      (SELECT COUNT(*) FROM sold.sold_records)::int AS total,
      (SELECT MAX(modification_timestamp) FROM sold.sold_records) AS max_mod
  `) as Array<{ total: number; max_mod: string | null }>;
  const isBackfill = stateRows[0]?.total === 0;
  const maxMod = stateRows[0]?.max_mod;

  // Pagination cursor values.
  // We chunk by the cursor field with `gt` tiebreaker to avoid infinite loops
  // when many records share the same timestamp.
  let cursorCloseDate: string | null = isBackfill ? "2010-01-01T00:00:00Z" : null;
  let cursorModTime: string | null = !isBackfill ? (maxMod ?? "1970-01-01T00:00:00Z") : null;
  let cursorKey: string = "";

  while (true) {
    let filter: string;
    let orderby: string;
    if (isBackfill) {
      filter =
        `City eq 'Milton' and MlsStatus eq 'Sold' ` +
        `and (CloseDate gt ${cursorCloseDate} ` +
        `or (CloseDate eq ${cursorCloseDate} and ListingKey gt '${cursorKey}'))`;
      orderby = "CloseDate asc,ListingKey asc";
    } else {
      filter =
        `City eq 'Milton' ` +
        `and (ModificationTimestamp gt ${cursorModTime} ` +
        `or (ModificationTimestamp eq ${cursorModTime} and ListingKey gt '${cursorKey}'))`;
      orderby = "ModificationTimestamp asc,ListingKey asc";
    }

    const items = await fetchPage(filter, orderby);
    pagesFetched++;
    if (items.length === 0) break;

    for (const item of items) {
      // Garbage filter: City must be Milton (not 'Deleted'), StreetName present,
      // not obviously placeholder. Do NOT filter on PermAdvertise — ingest all.
      if (!item.ListingKey) { skipped++; continue; }
      if ((item.City || "").toLowerCase() === "deleted") { skipped++; continue; }
      if ((item.StreetName || "").toLowerCase() === "deleted") { skipped++; continue; }

      const mlsStatus = item.MlsStatus || "Unknown";
      const isSold = mlsStatus.toLowerCase().includes("sold");

      // For backfill we only care about Sold rows; for incremental we ingest
      // any status so flips (Sold → Active after collapse) are captured.
      if (isBackfill && !isSold) { skipped++; continue; }

      // Core fields required for a sold row. If the record isn't sold (post-flip)
      // we still update mls_status on our existing row; we don't insert a brand
      // new non-sold record.
      const address = buildAddress(item);
      const streetName = extractStreetName(address);
      const streetSlug = streetNameToSlug(streetName);
      const modTimestamp = item.ModificationTimestamp ?? new Date().toISOString();

      if (!isSold) {
        // Status flip update path: only touch rows we already have.
        const existing = (await soldDb`
          SELECT mls_number FROM sold.sold_records WHERE mls_number = ${item.ListingKey}
        `) as Array<{ mls_number: string }>;
        if (existing.length === 0) { skipped++; continue; }
        await soldDb`
          UPDATE sold.sold_records
          SET mls_status = ${mlsStatus},
              modification_timestamp = ${modTimestamp},
              perm_advertise = ${item.InternetEntireListingDisplayYN !== false},
              display_address = ${item.InternetAddressDisplayYN !== false},
              updated_at = NOW()
          WHERE mls_number = ${item.ListingKey}
        `;
        updated++;
      } else {
        const listPrice = item.ListPrice ?? 0;
        const soldPrice = item.ClosePrice ?? 0;
        const listDate = item.ListDate ?? item.OriginalEntryTimestamp ?? item.CloseDate;
        const closeDate = item.CloseDate;
        if (!closeDate || !listDate || soldPrice <= 0 || listPrice <= 0) {
          skipped++;
          continue;
        }
        const dom = computeDaysOnMarket(listDate, closeDate);
        const ratio = listPrice > 0 ? soldPrice / listPrice : 0;
        const propertyType = mapPropertyType(item.PropertyType, item.PropertySubType);

        const result = (await soldDb`
          INSERT INTO sold.sold_records (
            mls_number, address, street_name, street_slug, neighbourhood, city,
            list_price, sold_price, sold_date, list_date,
            days_on_market, sold_to_ask_ratio,
            beds, baths, property_type, sqft_range,
            lat, lng,
            display_address, perm_advertise, mls_status,
            modification_timestamp, updated_at
          ) VALUES (
            ${item.ListingKey}, ${address}, ${streetName}, ${streetSlug},
            ${item.CityRegion || "Milton"}, ${item.City || "Milton"},
            ${listPrice}, ${soldPrice}, ${closeDate}, ${listDate},
            ${dom}, ${ratio},
            ${item.BedroomsTotal}, ${item.BathroomsTotalInteger},
            ${propertyType}, ${item.LivingAreaRange},
            ${item.Latitude}, ${item.Longitude},
            ${item.InternetAddressDisplayYN !== false},
            ${item.InternetEntireListingDisplayYN !== false},
            ${mlsStatus},
            ${modTimestamp}, NOW()
          )
          ON CONFLICT (mls_number) DO UPDATE SET
            address                = EXCLUDED.address,
            street_name            = EXCLUDED.street_name,
            street_slug            = EXCLUDED.street_slug,
            neighbourhood          = EXCLUDED.neighbourhood,
            city                   = EXCLUDED.city,
            list_price             = EXCLUDED.list_price,
            sold_price             = EXCLUDED.sold_price,
            sold_date              = EXCLUDED.sold_date,
            list_date              = EXCLUDED.list_date,
            days_on_market         = EXCLUDED.days_on_market,
            sold_to_ask_ratio      = EXCLUDED.sold_to_ask_ratio,
            beds                   = EXCLUDED.beds,
            baths                  = EXCLUDED.baths,
            property_type          = EXCLUDED.property_type,
            sqft_range             = EXCLUDED.sqft_range,
            lat                    = EXCLUDED.lat,
            lng                    = EXCLUDED.lng,
            display_address        = EXCLUDED.display_address,
            perm_advertise         = EXCLUDED.perm_advertise,
            mls_status             = EXCLUDED.mls_status,
            modification_timestamp = EXCLUDED.modification_timestamp,
            updated_at             = NOW()
          RETURNING (xmax = 0) AS inserted
        `) as Array<{ inserted: boolean }>;
        if (result[0]?.inserted) inserted++; else updated++;
      }

      // Advance cursor based on the record we just processed.
      cursorKey = item.ListingKey;
      if (isBackfill && item.CloseDate) cursorCloseDate = item.CloseDate;
      if (!isBackfill && item.ModificationTimestamp) cursorModTime = item.ModificationTimestamp;
    }

    if (items.length < PAGE_SIZE) break; // last page
    // Safety cap to prevent runaway backfills
    if (pagesFetched > 400) break;
  }

  const durationMs = Date.now() - started;
  console.log(
    `[sync/sold] mode=${isBackfill ? "backfill" : "incremental"} ` +
    `pages=${pagesFetched} inserted=${inserted} updated=${updated} skipped=${skipped} duration=${durationMs}ms`
  );

  return NextResponse.json({
    ok: true,
    mode: isBackfill ? "backfill" : "incremental",
    pagesFetched,
    inserted,
    updated,
    skipped,
    durationMs,
  });
}
