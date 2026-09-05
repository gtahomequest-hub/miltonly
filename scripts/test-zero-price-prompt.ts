// A zero-price street's prompt must SAY the street has no price.
//
// WHY THIS EXISTS. The 058 corpus audit ended with three streets the generator could not
// write: geddes-landing, jasper-street and wood-close each burned the whole retry budget
// re-inventing a price for a payload that carries none. The validator caught every attempt -
// zero_tier_price is the rule, and it is why those pages were draft rather than live - but
// the prompt never told the model the street has no price. The model read a missing figure
// as a figure to supply, and no amount of retry feedback after the fact fixed that, because
// each rejection named one token while the underlying belief went unchallenged.
//
// A validator says "not that". A prompt says "here is what is true". This asserts the second
// one exists, because the first one was already there and was not enough.
//
// The gate fires on kAnonLevel "zero" OR an input with no price at any grain. The second
// disjunct matters: coates-drive and jasper-street are "thin", not "zero", and both carried
// no price of any kind. A guard that only tested "zero" would pass while leaving the exact
// pages that prompted it uncovered.
import { isZeroPrice, buildZeroPricePreamble } from "../src/lib/ai/compliance";
import type { StreetGeneratorInput } from "../src/types/street-generator";

const failures: string[] = [];
const ok = (cond: boolean, msg: string) => { if (!cond) failures.push(msg); };

function base(): StreetGeneratorInput {
  return {
    street: { name: "Geddes Landing", slug: "geddes-landing-milton", type: "landing", identityKey: "geddes|landing", siblingSlugs: ["geddes-landing-milton"], direction: "" },
    neighbourhoods: ["Scott"],
    aggregates: { salesCount: 0, leasesCount: 0, typicalPrice: null, priceRange: null, daysOnMarket: null, kAnonLevel: "zero" },
    byType: {},
    nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
    commute: {
      toTorontoDowntown: { method: "car", minutes: 60 },
      toMississauga: { method: "car", minutes: 30 },
      toOakville: { method: "car", minutes: 25 },
      toBurlington: { method: "car", minutes: 25 },
      toPearson: { method: "car", minutes: 35 },
    },
    activeListingsCount: 0,
    crossStreets: [],
  } as StreetGeneratorInput;
}

// ── The gate ────────────────────────────────────────────────────────────────
const zero = base();
ok(isZeroPrice(zero), "kAnonLevel 'zero' must trip the gate");

// A THIN street with no price of any kind is in the same position. jasper-street and
// coates-drive were both thin and both carried nothing.
const thinNoPrice = base();
thinNoPrice.aggregates.kAnonLevel = "thin";
thinNoPrice.aggregates.salesCount = 1;
ok(isZeroPrice(thinNoPrice), "a thin street with no price at any grain must trip the gate");

// A street WITH a price must not. The preamble would be a lie on a page that has data,
// and switching it on corpus-wide is how a narrow fix becomes a regression.
const priced = base();
priced.aggregates.kAnonLevel = "full";
priced.aggregates.typicalPrice = 1_100_000;
ok(!isZeroPrice(priced), "a street with a typical price must NOT trip the gate");

const rangedOnly = base();
rangedOnly.aggregates.kAnonLevel = "thin";
rangedOnly.aggregates.priceRange = { low: 900_000, high: 1_200_000 };
ok(!isZeroPrice(rangedOnly), "a street with a price range must NOT trip the gate");

// A ZERO-tier street that DOES have a neighbourhood comparable still trips the gate, and
// should. DEC-ZERO-CONTEXT hands zero-tier inputs the neighbourhood's figure precisely so
// the page has something true to say; the street itself still has no price, so the
// instruction is still needed - it just takes the "one figure you may use" branch instead
// of the "no figure at all" one. Switching the gate off here is what re-opened the hole the
// second arm of DEC-GROUNDING-ZERO had to close.
const ncPriced = base();
ncPriced.neighbourhoodComparable = {
  neighbourhood: "Scott", filterByPropertyType: "detached", filterByBedroomCount: null,
  fallbackApplied: "type-only", sampleSize: 40, windowMonths: 12, mostRecentSoldAt: null,
  typicalSoldPrice: 1_050_000, priceRange: null, daysOnMarket: 88, priceChangeYoy: null,
  soldToAsk: null, kAnonLevel: "full",
};
ok(isZeroPrice(ncPriced), "a zero-tier street with only a neighbourhood comparable must still trip the gate");

// But a THIN street whose only price is the neighbourhood comparable is not zero-price -
// inputHasNoPriceAtAnyGrain already counts that figure as a price.
const thinWithNc = base();
thinWithNc.aggregates.kAnonLevel = "thin";
thinWithNc.neighbourhoodComparable = { ...ncPriced.neighbourhoodComparable! };
ok(!isZeroPrice(thinWithNc), "a thin street with a neighbourhood comparable has a price grain");

// ── The text ────────────────────────────────────────────────────────────────
const p = buildZeroPricePreamble(zero);
ok(/NO PRICE EXISTS FOR THIS STREET/.test(p), "preamble must state that no price exists");
ok(p.includes("Geddes Landing"), "preamble must name the street it is about");
ok(/\bFAILURE\b/.test(p), "preamble must call a dollar figure a failure, not a preference");
ok(/EVERY section and in the FAQ/.test(p),
   "preamble must cover every section and the FAQ - the 058 residue failed in the eval half, not market");
ok(/low \$1Ms|mid-\$600s|high-\$900s/.test(p),
   "preamble must name BAND forms too - a banned figure the model can rephrase as a band is not banned");
ok(/ZERO/.test(p), "with no comparable, the preamble must say the allowed figure count is zero");
ok(!/\$1,050,000/.test(p), "a zero-price input with no comparable must not quote any figure");

// With a comparable, exactly that figure is licensed, and only as the neighbourhood's.
const withNc = base();
withNc.neighbourhoodComparable = { ...ncPriced.neighbourhoodComparable! };
const pNc = buildZeroPricePreamble(withNc);
ok(pNc.includes("$1,050,000"), "the comparable figure must be quoted so the model cites it exactly");
ok(/NEIGHBOURHOOD/.test(pNc), "the comparable must be labelled as the neighbourhood's figure");
ok(/ONCE/.test(pNc), "the comparable must be licensed once, not as an anchor to build on");
ok(!/THERE IS NO FIGURE YOU MAY USE/.test(pNc),
   "the no-figure branch must not fire when a comparable exists");

// The preamble is PREPENDED, so it must end with a separator rather than run into the
// prompt it precedes.
ok(p.trimEnd().endsWith("---"), "preamble must end with a separator before the prompt it prefixes");

if (failures.length) {
  console.error("test-zero-price-prompt: FAIL");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("test-zero-price-prompt: PASS (15 assertions across the gate and the prompt text)");
