// 4l-fix smoke test: prove the new similar-listings matcher returns the
// right cards for W13120162 (2-Storey detached). Replicates the exact data
// fetched by src/app/sales/ads/[mlsNumber]/page.tsx and feeds it through the
// matcher's exported pure helper, then prints the proof table required by
// Gate C.
//
// Run: pnpm tsx scripts/smoke-similar-W13120162.ts

import { prisma } from "../src/lib/prisma";
import {
  ageBucket,
  computeSimilarMatch,
  type LiveListingSliderListing,
} from "../src/components/landing/LiveListingSlider";

const SALE = "For Sale";
const ACTIVE = "active";
const TARGET = "W13120162";
const POOL_LIMIT = 80;

async function main() {
  const target = await prisma.listing.findUnique({
    where: { mlsNumber: TARGET },
    select: {
      mlsNumber: true,
      address: true,
      city: true,
      propertyType: true,
      architecturalStyle: true,
      approximateAge: true,
    },
  });
  if (!target) {
    console.error(`Target listing ${TARGET} not found.`);
    process.exit(1);
  }

  console.log("Target listing:");
  console.log(`  ${target.mlsNumber}  propertyType=${target.propertyType}  ` +
    `architecturalStyle=${target.architecturalStyle}  ` +
    `approximateAge=${target.approximateAge}  ` +
    `→ ageBucket=${ageBucket(target.approximateAge)}`);
  console.log();

  // Replicate the page.tsx slider-pool query exactly.
  const pool = await prisma.listing.findMany({
    where: {
      transactionType: SALE,
      status: ACTIVE,
      city: target.city,
      mlsNumber: { not: target.mlsNumber },
      permAdvertise: true,
    },
    orderBy: { listedAt: "desc" },
    take: POOL_LIMIT,
    select: {
      mlsNumber: true,
      address: true,
      price: true,
      bedrooms: true,
      bathrooms: true,
      sqft: true,
      photos: true,
      listedAt: true,
      propertyType: true,
      architecturalStyle: true,
      approximateAge: true,
    },
  });

  // Coerce to LiveListingSliderListing[] (Prisma Date → ISO string, photos array).
  const poolForMatcher: LiveListingSliderListing[] = pool.map((l) => ({
    mlsNumber: l.mlsNumber,
    address: l.address,
    price: l.price,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    sqft: l.sqft,
    photos: l.photos,
    listedAt: l.listedAt.toISOString(),
    propertyType: l.propertyType,
    architecturalStyle: l.architecturalStyle,
    approximateAge: l.approximateAge,
  }));

  console.log(`Pool size (top ${POOL_LIMIT} by listedAt, excluding target): ${poolForMatcher.length}`);
  console.log();

  const { tier, listings } = computeSimilarMatch(poolForMatcher, {
    propertyType: target.propertyType,
    architecturalStyle: target.architecturalStyle,
    approximateAge: target.approximateAge,
  });

  console.log(`Matched tier: ${tier}`);
  console.log(`Cards returned: ${listings.length}`);
  console.log();

  // Per-card per-tier breakdown — for each returned card, recompute which
  // tier it WOULD have matched, so we can show the audit table requested
  // at Gate C.
  const targetStyle = (target.architecturalStyle ?? "").trim().toLowerCase();
  const targetAge = ageBucket(target.approximateAge);

  function cardTier(l: LiveListingSliderListing): 1 | 2 | 3 {
    const sameType = l.propertyType.toLowerCase() === target.propertyType.toLowerCase();
    const sameStyle =
      !!targetStyle &&
      (l.architecturalStyle ?? "").trim().toLowerCase() === targetStyle;
    const sameAge = targetAge !== null && ageBucket(l.approximateAge) === targetAge;
    if (sameType && sameStyle && sameAge) return 1;
    if (sameType && sameStyle) return 2;
    return 3;
  }

  console.log("Card audit table:");
  console.log(
    "MLS         | propertyType | architecturalStyle  | approximateAge | tier",
  );
  console.log(
    "----------- | ------------ | ------------------- | -------------- | ----",
  );
  let nonMatching = 0;
  for (const l of listings) {
    const t = cardTier(l);
    const styleCol = (l.architecturalStyle ?? "<null>").padEnd(19);
    const ageCol = (l.approximateAge ?? "<null>").padEnd(14);
    const ptCol = l.propertyType.padEnd(12);
    console.log(`${l.mlsNumber.padEnd(11)} | ${ptCol} | ${styleCol} | ${ageCol} | ${t}`);
    // Hard archetype check: every card must be same propertyType as target.
    if (l.propertyType.toLowerCase() !== target.propertyType.toLowerCase()) nonMatching++;
    // For Tier 1 or 2 (which require style match), confirm style matches.
    if (tier === 1 || tier === 2) {
      if ((l.architecturalStyle ?? "").trim().toLowerCase() !== targetStyle) nonMatching++;
    }
  }

  console.log();
  if (nonMatching > 0) {
    console.log(`✗ FAIL: ${nonMatching} card(s) violate the tier's archetype invariant.`);
    process.exit(2);
  } else {
    console.log(`✓ PASS: every returned card matches target archetype (tier=${tier}).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
