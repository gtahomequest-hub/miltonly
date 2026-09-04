// DEC-GROUNDING-ZERO. A page whose input carries no price may not print one.
//
// WHY THIS EXISTS. numeric_ungrounded fires on the MARKET SECTION ONLY, deliberately:
// that is where the audited fabrication patterns were found. tasker-court-milton
// generated against an input with typicalPrice, priceRange and daysOnMarket all null,
// no neighbourhoodComparable, no leaseActivity, kAnonLevel "zero" — and produced
// "$1.1M" in neighbourhoodComparable, "low $1Ms" in homes, and "rents from $2,800 to
// $3,500" in the FAQ. All three sit outside the market section. The validator returned
// 0 violations and the judge passed it. drew-centre-milton and pickersgill-crescent-milton
// had been live on production in exactly that shape since July.
//
// This is not a k-anon leak and no k threshold would have caught it. The k5 floor was
// respected: no street-level price was published. The failure is the opposite one — a
// leak publishes a real number too precisely, this publishes a number that does not
// exist. When the payload has no price at any grain, there is nothing a currency amount
// could be citing, so every one of them is ungrounded by construction.
//
// The second half of this guard matters as much as the first. A rule that only proves
// the new case can be satisfied by something that quietly weakened the old one, so the
// pre-existing market-section rule is asserted here too, on the same fixtures.
import {
  findZeroTierPrices,
  inputHasNoPriceAtAnyGrain,
  findUngroundedNumerics,
  tierBandFor,
  correctTierFor,
} from "../src/lib/ai/validateStreetGeneration";
import type { StreetGeneratorInput } from "../src/types/street-generator";

const failures: string[] = [];

function base(): StreetGeneratorInput {
  return {
    street: { name: "Tasker Court", slug: "tasker-court-milton", type: "court", identityKey: "tasker|court", siblingSlugs: ["tasker-court-milton"], direction: "" },
    neighbourhoods: ["Ford"],
    aggregates: { salesCount: 0, leasesCount: 0, typicalPrice: null, priceRange: null, daysOnMarket: null, kAnonLevel: "zero" },
    byType: {},
    nearby: [],
    commute: [],
    activeListingsCount: 0,
    crossStreets: [],
  } as unknown as StreetGeneratorInput;
}

/** tasker's real payload: nothing price-bearing at any grain. */
const ZERO_PRICE_INPUT = base();

/** A payload that DOES carry a price, so the zero-tier gate must stay shut. */
const PRICED_INPUT: StreetGeneratorInput = (() => {
  const i = base();
  i.aggregates.salesCount = 8;
  i.aggregates.typicalPrice = 1_050_000;
  i.aggregates.kAnonLevel = "full";
  return i;
})();

function expect(label: string, got: boolean, want: boolean) {
  if (got !== want) failures.push(`  ${label}: got ${got}, want ${want}`);
}

// ── THE GATE PREDICATE ───────────────────────────────────────────────────────────────
expect("zero-price input: no price at any grain", inputHasNoPriceAtAnyGrain(ZERO_PRICE_INPUT), true);
expect("priced input: has a price grain", inputHasNoPriceAtAnyGrain(PRICED_INPUT), false);

// Each grain on its own must close the gate. If any one of these regressed, the rule
// would start firing on pages that have data, which is how a good rule gets reverted.
{
  const withRange = base();
  withRange.aggregates.priceRange = { low: 900_000, high: 1_200_000 };
  expect("priceRange alone closes the gate", inputHasNoPriceAtAnyGrain(withRange), false);

  const withComparable = base();
  (withComparable as unknown as { neighbourhoodComparable: unknown }).neighbourhoodComparable =
    { typicalSoldPrice: 1_100_000 };
  expect("neighbourhoodComparable alone closes the gate", inputHasNoPriceAtAnyGrain(withComparable), false);

  const withLease = base();
  (withLease as unknown as { leaseActivity: unknown }).leaseActivity =
    { byBed: { "3": { count: 6, typicalRent: 3_100 } } };
  expect("leaseActivity alone closes the gate", inputHasNoPriceAtAnyGrain(withLease), false);
}

// ── THE CASE: zero-price input, "$1.1M" output ───────────────────────────────────────
const FABRICATED = "The typical sold price for such homes in the area sits near $1.1M, based on a sample that is thin but indicative.";
{
  const hits = findZeroTierPrices(FABRICATED, ZERO_PRICE_INPUT);
  if (hits.length === 0) {
    failures.push(`  zero-price input + "$1.1M" output: no violation raised`);
  } else if (!hits.some((h) => h.raw === "$1.1M")) {
    failures.push(`  zero-price input + "$1.1M": fired, but not on the figure — ${hits.map((h) => h.raw).join(", ")}`);
  }
}

// tasker's other two, verbatim. The band construct and the rent range both count.
for (const [label, prose, want] of [
  ["homes-section band", "Across the broader Ford area, homes typically trade in the low $1Ms, a figure that gives a sense of the market context.", "low$1Ms"],
  ["FAQ rent range", "In the Ford area, rents for similar homes typically range from $2,800 to $3,500 per month.", "$2,800"],
  ["bare magnitude, no dollar sign", "Comparable homes in the area trade around 1.1M today.", "1.1M"],
  ["bare grouped number near price vocabulary", "Homes on this street have sold around 800,000 in recent years.", "800,000"],
] as const) {
  const hits = findZeroTierPrices(prose, ZERO_PRICE_INPUT);
  if (!hits.some((h) => h.raw.replace(/\s/g, "") === want)) {
    failures.push(`  ${label}: expected a hit on "${want}", got ${hits.map((h) => h.raw).join(", ") || "nothing"}`);
  }
}

// ── THE FLOOR: no false positives ────────────────────────────────────────────────────
// A zero-price page still says plenty. None of this is a price.
for (const prose of [
  "No recent sales on Tasker Court, so no typical price can be published for this street.",
  "Milton GO Station is a nine-minute drive, and Highway 401 is about ten minutes away.",
  "The homes here are detached, on lots of roughly 1,200 square feet of frontage.",
  "Anne J. MacArthur PS and P.L. Robertson PS are both within five minutes.",
]) {
  const hits = findZeroTierPrices(prose, ZERO_PRICE_INPUT);
  if (hits.length > 0) {
    failures.push(`  false positive on non-price prose: "${hits.map((h) => h.raw).join(", ")}" in "${prose.slice(0, 50)}..."`);
  }
}

// The gate is inert wherever the input has data. This is the assertion that keeps the
// rule shippable: it must add zero firing surface to 400-odd pages that are fine.
{
  const hits = findZeroTierPrices(FABRICATED, PRICED_INPUT);
  if (hits.length > 0) {
    failures.push(`  priced input: zero-tier rule fired anyway on ${hits.map((h) => h.raw).join(", ")}`);
  }
}

// ── THE REVERSE CASE, which already worked and must keep working ─────────────────────
// A figure absent from a NON-EMPTY input is numeric_ungrounded's job. Asserted here so
// the new rule cannot be implemented by loosening the old one.
{
  const hits = findUngroundedNumerics(FABRICATED, PRICED_INPUT);
  if (hits.length === 0) {
    failures.push(`  non-empty input + a figure absent from it: numeric_ungrounded no longer fires`);
  }
}
{
  // ...and a figure that IS in the input must still pass, so the reverse assertion is
  // not just "everything fires".
  const grounded = "Homes here typically trade around $1.05M across the last twelve months.";
  const hits = findUngroundedNumerics(grounded, PRICED_INPUT);
  if (hits.length > 0) {
    failures.push(`  grounded figure rejected by numeric_ungrounded: ${hits.map((h) => h.raw).join(", ")}`);
  }
}

// ── THE SECOND ARM: zero tier WITH a neighbourhood block ─────────────────────────────
// DEC-ZERO-CONTEXT gives a zero-tier page the neighbourhood's real typical and range,
// which correctly switches the zero-tier rule off. That immediately re-opened a
// narrower hole: given Ford's low of $419,990 the model wrote "the high-$400s", and
// given Timberlea's high of $1,575,000 it wrote "the mid-$1.5Ms". Real endpoints,
// restated loosely enough to fall outside ±max($15K, 4%), in the homes section where
// numeric_ungrounded does not look. A reader cannot tell a loose restatement from an
// invention, so on a zero tier every dollar must round-trip.
const ZERO_WITH_AREA: StreetGeneratorInput = (() => {
  const i = base();
  (i as unknown as { neighbourhoodComparable: unknown }).neighbourhoodComparable = {
    neighbourhood: "Ford",
    filterByPropertyType: "all",
    filterByBedroomCount: null,
    fallbackApplied: "whole-nbhd",
    sampleSize: 150,
    windowMonths: 12,
    mostRecentSoldAt: null,
    typicalSoldPrice: 1_025_527,
    priceRange: { low: 419_990, high: 1_980_000 },
    daysOnMarket: 87,
    priceChangeYoy: null,
    soldToAsk: null,
    kAnonLevel: "full",
  };
  return i;
})();

expect("zero tier + area block: zero-tier rule stands down", inputHasNoPriceAtAnyGrain(ZERO_WITH_AREA), false);

{
  // The real defect, verbatim from the 2026-09-04 regeneration.
  const loose = "The range across Ford spans from the high-$400s to just under $2M, reflecting a mix of stock.";
  const hits = findUngroundedNumerics(loose, ZERO_WITH_AREA).filter((h) => h.type === "dollar");
  if (!hits.some((h) => h.raw === "high-$400s")) {
    failures.push(`  loose restatement "high-$400s" of a $419,990 low: not flagged (got ${hits.map((h) => h.raw).join(", ") || "nothing"})`);
  }
}
{
  // Accurate restatements of the same three input values must pass, or the rule is
  // just a ban on prices and the neighbourhood block was pointless.
  const accurate = "Across Ford, homes typically trade around $1.05M, within a range running from about $420,000 to roughly $1.98M.";
  const hits = findUngroundedNumerics(accurate, ZERO_WITH_AREA).filter((h) => h.type === "dollar");
  if (hits.length > 0) {
    failures.push(`  accurate restatement rejected: ${hits.map((h) => h.raw).join(", ")}`);
  }
}

// ── TIER BANDS: the model must be able to pass by telling the truth ──────────────────
// Ford's real low is $419,990. "the low $400s" is an accurate characterisation of it and
// must clear; "the high-$400s" names 466,667-500,000 and must not. Without this, the
// second arm becomes a retry storm no honest output can escape, which is exactly the
// parkway-drive "Brian Best Park" failure in a different costume.
{
  const accurate = "Recent trades across Ford span from the low $400s to around $2M.";
  const hits = findUngroundedNumerics(accurate, ZERO_WITH_AREA).filter((h) => h.type === "dollar");
  if (hits.length > 0) {
    failures.push(`  accurate tier construct rejected: ${hits.map((h) => h.raw).join(", ")}`);
  }
}
{
  const wrong = "Recent trades across Ford span from the high-$400s to around $2M.";
  const hits = findUngroundedNumerics(wrong, ZERO_WITH_AREA).filter((h) => h.type === "dollar");
  if (!hits.some((h) => /high[-\s]\$400s/i.test(h.raw))) {
    failures.push(`  wrong tier construct "high-$400s" accepted against a $419,990 low`);
  }
}
{
  const band = tierBandFor("low $400s");
  if (!band || band.lo !== 400_000 || Math.round(band.hi) !== 433_333) {
    failures.push(`  tierBandFor("low $400s") = ${JSON.stringify(band)}, want ~400,000-433,333`);
  }
  if (tierBandFor("$950,000") !== null) {
    failures.push(`  tierBandFor on a plain figure should be null`);
  }
}

// A rejection the model cannot act on is a retry storm, not a guard: pickersgill burned
// its whole budget re-guessing "high-$600s". The feedback must name the band the value
// actually sits in, rebuilt from the value rather than echoing the writer's decade.
{
  const cases: Array<[string, number, string]> = [
    ["high-$600s", 637_500, "mid-$600s"],
    ["high-$800s", 937_859, "mid-$900s"],
    ["high-$400s", 419_990, "low-$400s"],
  ];
  for (const [tok, val, want] of cases) {
    const got = correctTierFor(tok, val);
    if (got !== want) failures.push(`  correctTierFor("${tok}", ${val}) = ${got}, want ${want}`);
  }
}

if (failures.length > 0) {
  console.error(`test-grounding-zero: ${failures.length} failure(s)`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log("test-grounding-zero: PASS (26 assertions)");
