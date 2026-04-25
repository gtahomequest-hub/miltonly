/**
 * One-shot backfill: re-fetch LivingAreaRange for all active Milton listings
 * from TREB and write a parsed integer to Listing.sqft.
 *
 * Run:  npx tsx --env-file=.env.local scripts/backfill-sqft.ts
 *
 * Uses the same shared parser as the live syncs (src/lib/sync/parse-utils.ts)
 * so backfill output and ongoing sync output stay in lockstep.
 */
import { prisma } from "@/lib/prisma";
import { parseLivingAreaRange } from "@/lib/sync/parse-utils";

const TREB_API_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const TREB_TOKEN = (process.env.TREB_API_TOKEN || "").trim();
const PAGE_SIZE = 1000;

interface AmpRow {
  ListingKey: string;
  LivingAreaRange: string | null;
}

async function fetchPage(skip: number): Promise<{ items: AmpRow[]; total: number }> {
  const filter = encodeURIComponent("City eq 'Milton'");
  const url = `${TREB_API_URL}?$select=ListingKey,LivingAreaRange&$filter=${filter}&$top=${PAGE_SIZE}&$skip=${skip}&$count=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TREB_TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TREB ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return { items: data.value || [], total: data["@odata.count"] ?? 0 };
}

(async () => {
  if (!TREB_TOKEN) {
    console.error("TREB_API_TOKEN not set — load .env.local with --env-file flag");
    process.exit(1);
  }

  let total = 0;
  let populated = 0;
  let skipped = 0;
  let parseFailed = 0;

  let skipN = 0;
  let totalAvailable = 0;
  while (true) {
    const { items, total: count } = await fetchPage(skipN);
    totalAvailable = count;
    if (items.length === 0) break;

    for (const item of items) {
      total++;
      if (!item.ListingKey) { skipped++; continue; }

      const raw = item.LivingAreaRange;
      if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
        skipped++;
        continue;
      }

      const parsed = parseLivingAreaRange(raw);
      if (parsed === null) {
        parseFailed++;
        console.warn(`  parse-fail ${item.ListingKey}: "${raw}"`);
        continue;
      }

      // Update only active listings (homepage cares about these); other
      // statuses will get refreshed on next normal sync run.
      const result = await prisma.listing.updateMany({
        where: { mlsNumber: item.ListingKey, status: "active" },
        data: { sqft: parsed },
      });
      if (result.count > 0) populated++;
    }

    console.log(`  page skip=${skipN}: scanned ${items.length} (running total=${total}, populated=${populated}, skipped=${skipped}, parse-failed=${parseFailed})`);

    skipN += PAGE_SIZE;
    if (total >= totalAvailable || items.length < PAGE_SIZE) break;
  }

  console.log("");
  console.log("=========================================");
  console.log(`TREB items processed:     ${total}`);
  console.log(`active rows populated:    ${populated}`);
  console.log(`skipped (TREB null/empty): ${skipped}`);
  console.log(`parse-failed (junk values): ${parseFailed}`);
  console.log("=========================================");

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
