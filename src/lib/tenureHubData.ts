// src/lib/tenureHubData.ts
//
// THE TENURE SEAM. getTenureHubData(config): Promise<HubData | null> emits the
// SAME HubData contract HubPage/sections consume, for a NON-geographic ownership
// hub (freehold / condo / POTL). It does NOT reuse getHubData (neighbourhood-
// coupled). The TenureHubPage composer renders the tenure-appropriate subset of
// sections; geo-only fields (streets/vipStreets/condos/siblings) are emitted
// empty and TenureHubPage simply doesn't render those sections.
//
// CONFIG-DRIVEN: freehold is config #1. condo + POTL plug in as configs WITHOUT
// template changes. POTL will be the null-stats config — every stat null-degrades
// honestly (no active/sold in a segment -> omit the number, never $0/NaN), so the
// same composer renders POTL as a clean editorial-only page.
//
// SOURCES (the nothing-fake split):
//   ACTIVE  -> DB1 Prisma Listing, active sale-only LIST price (never blended).
//   SOLD    -> DB2 getSoldDb() sold.sold_records (soldDate is null in DB1), with
//              K_ANON_PRICE=5 / K_ANON_RANGE=10 discipline; sub-k -> silence.
//   The freehold set is matched on propertySubType (TRIMMED — PropTx ships
//   "Semi-Detached " with a trailing space) and EXCLUDES condo-townhouses by
//   construction. Never fall back to legacy propertyType (that carries the 45
//   condo-towns = nothing-fake violation; the clean exclusion is the point).

import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import type { HubData, HubStats, TenureCompareFacts } from "@/components/hub/types";
import { fullPrice, compactPrice } from "@/components/hub/format";

const K_ANON_PRICE = 5;
const K_ANON_RANGE = 10;

// ---- config contract -------------------------------------------------------

export interface TenureGlanceItem {
  label: string;
  value: string | null; // null -> "not stated" silent
}

export interface TenureConfig {
  slug: string; // "freehold"
  h1: string; // "Freehold Homes in Milton"
  eyebrow: string; // "Milton ownership type" (replaces HubHero's neighbourhood eyebrow)
  character: string; // hero one-liner
  // SUBTYPE set the live stat queries filter on (trimmed-match, condo-town-clean)
  subTypes: string[]; // ['Detached','Semi-Detached','Att/Row/Townhouse','Duplex']
  // ---- generalization knobs (defaults reproduce freehold output byte-identically) ----
  activeNoun?: { one: string; many: string }; // default {one:"freehold home", many:"freehold homes"}
  inventoryNoun?: string; // default "freehold" — "Across active <x> listings" / "Active <x> inventory by size"
  // by-subtype display: marketCompare label + the cost-sentence fragment per subtype.
  subTypeDisplay?: Array<{ match: string; compareLabel: string; costLabel: string }>;
  costMiddle?: "subtype" | "fee"; // default "subtype" — what the cost block's middle live-line injects
  priceFloor?: number; // default 0 — drop sub-floor anomalies (parking/locker) from PRICE stats only
  showFee?: boolean; // default false — compute + inject a typical monthly-fee range (condo)
  feeSentenceTemplate?: string; // {lo}/{hi} tokens; only used when showFee and fee data is k-safe
  soldTail?: string; // default freehold tail — editorial sentence after the sold numbers
  // NULL-STATS mode (POTL): sub-k activity -> the seam runs NO stat queries and
  // returns editorial-only HubData (nullStats:true); the composer hides every
  // stat-bearing section. overviewParas supplies the body verbatim (the cost-
  // structured fields below are freehold/condo-shaped and unused for null-stats).
  nullStats?: boolean;
  overviewParas?: string[]; // null-stats body paragraphs (used verbatim as overview)
  // editorial blocks (static, verbatim). {tokens} are injected from live stats.
  // Optional so a null-stats config (POTL) can omit them; the normal path filters
  // falsy values, so freehold/condo output is unchanged.
  lede?: string;
  threeWay?: string;
  costIntro?: string; // before the (live) cost line
  costMid?: string; // before the (live) by-subtype line
  costEnd?: string;
  feeCredibility?: string; // optional extra block (condo's status-certificate paragraph) after the cost block
  whoSuits?: string;
  honestTradeoff?: string;
  glanceStatic: TenureGlanceItem[]; // non-numeric glance rows (tenure framing)
  glanceLabels?: { fee?: string; vs?: string }; // override the fee/vs glance row labels (condo: vs->"vs Freehold")
  // section-title + breadcrumb labels (per ownership type). Defaults reproduce
  // freehold's strings byte-identically; condo/POTL each supply their own.
  breadcrumbLabel?: string; // default "Freehold" — the 3rd breadcrumb crumb
  sectionTitles?: { explained: string; market: string; faq: string };
  faqs: { question: string; answer: string }[];
  ctaBuyer: { heading: string; body: string; buttonLabel: string; href: string };
  ctaSeller: { heading: string; body: string; buttonLabel: string; href: string };
  intents: HubData["intents"];
  marketSourceLabel: string;
}

// ---- helpers ---------------------------------------------------------------

const norm = (v: string | null | undefined) => (v == null ? "" : v.trim());
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
interface SoldAgg {
  n: number;
  typical: number | null; // avg sold, k-anon gated
  lo: number | null;
  hi: number | null; // range, k-range gated
  dom: number | null;
}

async function freeholdSold(subTypes: string[]): Promise<SoldAgg> {
  const db = getSoldDb();
  if (!db) return { n: 0, typical: null, lo: null, hi: null, dom: null };
  try {
    const rows = (await db`
      SELECT COUNT(DISTINCT mls_number)::int AS n,
             AVG(sold_price) AS avg_price,
             MIN(sold_price) AS lo, MAX(sold_price) AS hi,
             AVG(days_on_market) AS dom
      FROM sold.sold_records
      WHERE city = 'Milton' AND perm_advertise = TRUE
        AND transaction_type = 'For Sale'
        AND TRIM(property_sub_type) = ANY(${subTypes}::text[])
        AND sold_date >= NOW() - INTERVAL '12 months'
        AND sold_date <= NOW()
    `) as Array<{ n: number; avg_price: string | null; lo: string | null; hi: string | null; dom: string | null }>;
    const r = rows[0];
    const n = r?.n ?? 0;
    const numOr = (v: string | null | undefined) => (v == null ? null : Math.round(parseFloat(v)));
    return {
      n,
      typical: n >= K_ANON_PRICE ? numOr(r?.avg_price) : null,
      lo: n >= K_ANON_RANGE ? numOr(r?.lo) : null,
      hi: n >= K_ANON_RANGE ? numOr(r?.hi) : null,
      dom: numOr(r?.dom),
    };
  } catch {
    return { n: 0, typical: null, lo: null, hi: null, dom: null };
  }
}

// ---- the seam --------------------------------------------------------------

export async function getTenureHubData(cfg: TenureConfig): Promise<HubData | null> {
  // NULL-STATS path (POTL): sub-k activity -> run NO stat queries (no DB hit) and
  // return an editorial-only HubData. The composer hides every stat-bearing
  // section (hero tiles, at-a-glance, market). Intentionally number-free.
  if (cfg.nullStats) {
    const glanceVal = (label: string) => cfg.glanceStatic.find((g) => g.label === label)?.value ?? "";
    return {
      slug: cfg.slug,
      name: cfg.h1,
      profile: "urban",
      character: cfg.character,
      intents: cfg.intents,
      stats: { typicalPrice: null, sold12mo: null, onMarket: null, dom: null },
      atAGlance: {
        priceRange: null,
        dominantType: glanceVal("Home types"),
        suits: glanceVal("Best suits").split(",").map((s) => s.trim()).filter(Boolean),
        commute: glanceVal("Monthly fee"),
        schools: glanceVal("vs Condo"),
      },
      glanceLabels: cfg.glanceLabels,
      breadcrumbLabel: cfg.breadcrumbLabel ?? "Freehold",
      sectionTitles: cfg.sectionTitles ?? {
        explained: "Freehold in Milton, explained",
        market: "How freehold trades in Milton",
        faq: "Freehold questions",
      },
      overview: cfg.overviewParas ?? [],
      marketCompare: [],
      commentary: { paragraphs: [], source: cfg.marketSourceLabel },
      streets: [],
      streetCount: 0,
      vipStreets: [],
      condos: [],
      faqs: cfg.faqs,
      siblings: [],
      ctaBuyer: cfg.ctaBuyer,
      ctaSeller: cfg.ctaSeller,
      nullStats: true,
      // Forward-safety: a null-stats side (future POTL-pair comparisons) emits
      // all-null facts so the /compare table degrades to silent cells cleanly.
      compareFacts: {
        activeCount: null, medianList: null, listLo: null, listHi: null,
        soldTypical: null, soldCount: null, dom: null, subtypeMedians: [],
        hasFee: Boolean(cfg.showFee), feeLo: null, feeHi: null,
      },
    };
  }

  // config defaults (reproduce freehold output byte-identically when unset)
  const activeNoun = cfg.activeNoun ?? { one: "freehold home", many: "freehold homes" };
  const inventoryNoun = cfg.inventoryNoun ?? "freehold";
  const subTypeDisplay = cfg.subTypeDisplay ?? [
    { match: "Detached", compareLabel: "Detached", costLabel: "detached homes" },
    { match: "Att/Row/Townhouse", compareLabel: "Freehold townhome", costLabel: "freehold townhomes" },
    { match: "Semi-Detached", compareLabel: "Semi-detached", costLabel: "semis" },
  ];
  const costMiddle = cfg.costMiddle ?? "subtype";
  const priceFloor = cfg.priceFloor ?? 0;
  const soldTail =
    cfg.soldTail ??
    "Freehold is the deepest, most liquid segment of the Milton market — detached homes lead it, with freehold townhomes and semis trading faster at lower prices.";

  // ACTIVE side — DB1 Prisma, active SALE-only LIST price, clean subType filter.
  const activeRows = await prisma.listing.findMany({
    where: { city: "Milton", permAdvertise: true, status: "active" },
    select: {
      propertySubType: true, price: true, bedrooms: true, transactionType: true, maintenanceFeeAmt: true,
    },
  });
  const inSet = (s: string | null) => cfg.subTypes.includes(norm(s));
  const isSale = (t: string | null) => (t ?? "").toLowerCase() !== "for lease";

  const tenureActive = activeRows.filter((r) => inSet(r.propertySubType));
  // PRICE stats use sale-priced rows ABOVE the plausibility floor (drops parking/
  // locker anomalies). The inventory COUNT (activeCount) is unfiltered.
  const saleActive = tenureActive.filter(
    (r) => isSale(r.transactionType) && typeof r.price === "number" && (r.price as number) > priceFloor,
  );
  const prices = saleActive.map((r) => r.price as number);

  const activeCount = tenureActive.length;
  const medianList = median(prices);
  const loList = prices.length ? Math.min(...prices) : null;
  const hiList = prices.length ? Math.max(...prices) : null;

  // by-subtype median (active sale list) — only k-safe segments surface
  function subMedian(label: string): number | null {
    const xs = saleActive.filter((r) => norm(r.propertySubType) === label).map((r) => r.price as number);
    return xs.length >= K_ANON_PRICE ? median(xs) : null;
  }
  const subMeds = subTypeDisplay.map((d) => ({ ...d, value: subMedian(d.match) }));

  // by-bedroom (active tenure) — k-gated, 1..5 then 6+ bucket (1-bed surfaces for
  // condos; stays sub-k/suppressed for freehold so freehold output is unchanged)
  const bedBuckets: { label: string; count: number }[] = [];
  const bedCounts = new Map<number, number>();
  for (const r of tenureActive) {
    if (typeof r.bedrooms === "number") bedCounts.set(r.bedrooms, (bedCounts.get(r.bedrooms) ?? 0) + 1);
  }
  for (let b = 1; b <= 5; b++) {
    const c = bedCounts.get(b) ?? 0;
    if (c >= K_ANON_PRICE) bedBuckets.push({ label: `${b} bed`, count: c });
  }
  let sixPlus = 0;
  for (const [b, c] of Array.from(bedCounts.entries())) if (b >= 6) sixPlus += c;
  if (sixPlus >= K_ANON_PRICE) bedBuckets.push({ label: "6+ bed", count: sixPlus });

  // typical monthly fee range (condo) — p25..p75 of maintenanceFeeAmt, k-gated,
  // floored at $50 to drop junk (e.g. $0.64). Omitted entirely if not k-safe.
  let feeLive = "";
  let feeLo: number | null = null;
  let feeHi: number | null = null;
  if (cfg.showFee) {
    const fees = tenureActive
      .map((r) => r.maintenanceFeeAmt)
      .filter((v): v is number => typeof v === "number" && v >= 50)
      .sort((a, b) => a - b);
    if (fees.length >= K_ANON_PRICE) {
      const q = (p: number) => fees[Math.floor(p * (fees.length - 1))];
      feeLo = Math.round(q(0.25) / 10) * 10;
      feeHi = Math.round(q(0.75) / 10) * 10;
      if (cfg.feeSentenceTemplate) {
        feeLive = cfg.feeSentenceTemplate.replace("{lo}", fullPrice(feeLo)).replace("{hi}", fullPrice(feeHi));
      }
    }
  }

  // SOLD side — DB2 analytics, k-anon gated.
  const sold = await freeholdSold(cfg.subTypes);

  // If there is genuinely nothing to ground (POTL-style null config), the page
  // still renders editorial-only: stats all null, numeric editorial dropped.
  const hasActive = activeCount > 0 && medianList !== null;

  const stats: HubStats = {
    typicalPrice: sold.typical, // sold avg, k-anon (null -> hero shows "not stated")
    sold12mo: sold.n > 0 ? sold.n : null,
    onMarket: activeCount > 0 ? activeCount : null,
    dom: sold.dom,
  };

  // ---- editorial assembly (inject live numbers; drop the sentence if null) ----
  const costLive = hasActive
    ? `Right now Milton has ${activeCount} active ${activeCount === 1 ? activeNoun.one : activeNoun.many}, with a median asking price of ${fullPrice(medianList as number)}${loList && hiList ? ` and asking prices running from ${fullPrice(loList)} to ${fullPrice(hiList)}` : ""}.`
    : "";
  // by-subtype cost sentence: "<label0> typically ask <p0>, <labelN> <pN>"
  const subParts: string[] = [];
  subMeds.forEach((s, i) => {
    if (s.value) subParts.push(i === 0 ? `${s.costLabel} typically ask ${fullPrice(s.value)}` : `${s.costLabel} ${fullPrice(s.value)}`);
  });
  const subLive = subParts.length ? `Across active ${inventoryNoun} listings, ${subParts.join(", ")}.` : "";

  // the cost block's middle live-line: by-subtype (freehold) or fee range (condo)
  const middleLive = costMiddle === "fee" ? feeLive : subLive;
  const costParagraph = [cfg.costIntro, costLive, cfg.costMid, middleLive, cfg.costEnd]
    .filter(Boolean)
    .join(" ");

  const overview = [cfg.lede, cfg.threeWay, costParagraph, cfg.feeCredibility, cfg.whoSuits, cfg.honestTradeoff].filter(
    (p): p is string => Boolean(p),
  );

  // glance: tenure-static rows + a live price-range row at the top
  const priceRange =
    loList && hiList ? `${compactPrice(loList)} – ${compactPrice(hiList)}` : null;

  // market commentary (sold-derived; honest silence if sub-k)
  const commentaryParas: string[] = [];
  if (sold.n >= K_ANON_PRICE && sold.typical) {
    commentaryParas.push(
      `Over the last 12 months, ${sold.n.toLocaleString("en-CA")} ${activeNoun.many} sold across Milton at a typical price of ${fullPrice(sold.typical)}${sold.dom ? `, taking about ${sold.dom} days on market` : ""}. ${soldTail}`,
    );
  } else {
    commentaryParas.push(
      `There isn't enough recent ${inventoryNoun} sales activity to publish a reliable typical sold price right now. Active asking prices above are the better current guide; ask Aamir for the latest closed comparables.`,
    );
  }
  if (bedBuckets.length) {
    const bedText = bedBuckets
      .sort((a, b) => b.count - a.count)
      .map((b) => `${b.label} (${b.count})`)
      .join(", ");
    commentaryParas.push(`Active ${inventoryNoun} inventory by size: ${bedText}.`);
  }

  // marketCompare rows = by-subtype active median (what the tenure actually spans)
  const marketCompare = subMeds
    .filter((s) => s.value)
    .map((s) => ({
      metricLabel: s.compareLabel,
      neighbourhoodValue: fullPrice(s.value as number),
      miltonValue: medianList ? fullPrice(medianList) : "—",
      delta: "active asking median",
    })) as HubData["marketCompare"];

  // COMPARE FACTS — the same k-safe numbers above, surfaced structurally for the
  // /compare side-by-side table. No new queries: every value is already computed.
  const compareFacts: TenureCompareFacts = {
    activeCount: activeCount > 0 ? activeCount : null,
    medianList,
    listLo: loList,
    listHi: hiList,
    soldTypical: sold.typical,
    soldCount: sold.n > 0 ? sold.n : null,
    dom: sold.dom,
    subtypeMedians: subMeds
      .filter((s): s is typeof s & { value: number } => s.value != null)
      .map((s) => ({ label: s.compareLabel, value: s.value })),
    hasFee: Boolean(cfg.showFee),
    feeLo,
    feeHi,
  };

  const glance = {
    priceRange,
    dominantType: cfg.glanceStatic.find((g) => g.label === "Home types")?.value ?? "Detached, semis & freehold townhomes",
    suits: (cfg.glanceStatic.find((g) => g.label === "Best suits")?.value ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    commute: cfg.glanceStatic.find((g) => g.label === "Monthly fee")?.value ?? "No condo fee",
    schools: cfg.glanceStatic.find((g) => g.label === "vs Condo")?.value ?? "Full control, full upkeep",
  };

  return {
    slug: cfg.slug,
    name: cfg.h1,
    profile: "urban",
    character: cfg.character,
    intents: cfg.intents,
    stats,
    atAGlance: glance,
    glanceLabels: cfg.glanceLabels,
    breadcrumbLabel: cfg.breadcrumbLabel ?? "Freehold",
    sectionTitles: cfg.sectionTitles ?? {
      explained: "Freehold in Milton, explained",
      market: "How freehold trades in Milton",
      faq: "Freehold questions",
    },
    overview,
    marketCompare,
    commentary: { paragraphs: commentaryParas, source: cfg.marketSourceLabel },
    // geo-only — emitted empty; TenureHubPage does not render these sections.
    streets: [],
    streetCount: 0,
    vipStreets: [],
    condos: [],
    faqs: cfg.faqs,
    siblings: [],
    ctaBuyer: cfg.ctaBuyer,
    ctaSeller: cfg.ctaSeller,
    compareFacts,
  } satisfies HubData;
}

// ---------------------------------------------------------------------------
// FREEHOLD CONFIG (config #1). Editorial verbatim from the approved blocks;
// {live} numbers inject via getTenureHubData. condo + POTL will be sibling
// configs against the same seam.
// ---------------------------------------------------------------------------

export const FREEHOLD_CONFIG: TenureConfig = {
  slug: "freehold",
  h1: "Freehold Homes in Milton",
  eyebrow: "Milton ownership type",
  character:
    "Own the home and the land outright — no condo corporation, no monthly fee, no board. In Milton, it's the default.",
  subTypes: ["Detached", "Semi-Detached", "Att/Row/Townhouse", "Duplex"],
  lede:
    "Buying freehold means you own the home and the land outright — no condo corporation, no monthly fee, no board deciding what happens to your property. It's the most complete ownership in Ontario, and in Milton it's the default: the town's explosive growth over the last two decades filled it with detached homes, semis, and freehold townhomes, so most of what you'll tour here is freehold. The appeal is control. The catch is that control and responsibility are the same thing — the roof, the furnace, the lot, the snow are all yours to maintain and, eventually, to replace.",
  threeWay:
    "Most Milton buyers are really choosing between three ownership types, not two, and the difference is who handles maintenance and who pays for it. Freehold: you own everything, pay no fee, and carry all the upkeep yourself. Condo: you own your unit, pay a monthly fee, and the corporation maintains the building, grounds, and amenities. [[POTL|/potl]] (Parcel of Tied Land — common in Milton's newer townhome developments): you own your home freehold, but pay a smaller monthly fee toward shared elements like private roads, visitor parking, and snow removal. It catches buyers off guard — a “freehold” townhome with a fee attached — which is why it's worth understanding before you're surprised by it at the offer stage. Freehold is the right fit if you want maximum control and no recurring fee, and you're prepared to budget for your own maintenance. If predictable costs and someone-else-handles-it convenience matter more, condo or POTL may serve you better.",
  costIntro:
    "Freehold spans Milton's widest price range, because the category runs from attached townhomes up to large detached homes.",
  costMid:
    "The spread inside freehold is where the real decision sits: detached homes anchor the top of the market, while freehold townhomes and semis are the more accessible path into full ownership without a condo fee.",
  costEnd:
    "When you compare a freehold townhome against a condo at a similar price, the freehold has no monthly fee — but run the honest math: set aside what that fee would have covered, because with freehold, the reserve fund is you.",
  whoSuits:
    "Freehold tends to suit buyers planning to stay and put down roots: families sizing up into detached homes, buyers who want a yard, a garage workshop, or room to renovate, and anyone who'd rather not answer to a condo board. It's a strong fit for the wave of buyers moving to Milton from elsewhere in the GTA — trading a condo or a smaller freehold closer to the city for more house and land out here, often with the commute and the schools in mind. Freehold asks more of you, financially and practically. For the right buyer, that's the appeal, not the drawback.",
  honestTradeoff:
    "No fee doesn't mean no cost — it means the cost is yours to plan for. A condo fee is partly forced savings toward shared repairs; freehold owners have to do that budgeting themselves, and the ones who are happiest went in clear-eyed: reserving for the furnace, the roof, the systems that eventually need replacing, instead of being caught out by them. The freehold owners who regret it are almost always the ones who treated “no fee” as “no maintenance budget.” Done with discipline, freehold is the most flexible, autonomous way to own in Milton. Done without it, the savings get eaten by deferred upkeep.",
  glanceStatic: [
    { label: "Home types", value: "Detached, semis & freehold townhomes" },
    { label: "Best suits", value: "Move-up families, buyers who want land, no-condo-board owners" },
    { label: "Monthly fee", value: "None — you own the land outright" },
    { label: "vs Condo", value: "Full control, full maintenance responsibility" },
  ],
  faqs: [
    {
      question: "What does freehold mean in Milton?",
      answer:
        "Freehold means you own both the home and the land it sits on outright, with no condo corporation and no monthly maintenance fee. You're responsible for all upkeep — roof, furnace, lot, snow — yourself. In Milton, most detached homes, semis, and many townhomes are freehold.",
    },
    {
      question: "Is a freehold townhome better than a condo townhome?",
      answer:
        "Neither is strictly better — it's a trade. A freehold townhome has no monthly fee and you control your own maintenance and reserves. A condo townhome charges a fee but the corporation handles shared upkeep. Watch for POTL townhomes, which are freehold but still carry a smaller fee for shared private roads and amenities.",
    },
    {
      question: "Do freehold homes really have no monthly fees?",
      answer:
        "True freehold has no condo fee. But “no fee” isn't “no cost” — you carry the full cost of maintenance and major replacements yourself, so budgeting your own reserve is essential. POTL homes are the exception: freehold ownership with a smaller monthly fee for shared common elements.",
    },
  ],
  intents: [
    { key: "buy", label: "Browse listings", sub: "Freehold homes for sale", href: "/listings" },
    { key: "sell", label: "What's my home worth", sub: "Free Milton valuation", href: "/sell" },
    { key: "invest", label: "Compare condos", sub: "Condo buildings in Milton", href: "/condos" },
    { key: "rent", label: "Explore neighbourhoods", sub: "Milton area by area", href: "/neighbourhoods" },
  ],
  ctaBuyer: {
    heading: "Find the right freehold home",
    body: "Browse active freehold listings across Milton, or tell Aamir what you're after — detached, semi, or freehold townhome — and get matched to the right streets and neighbourhoods.",
    buttonLabel: "Browse freehold listings",
    href: "/listings",
  },
  ctaSeller: {
    heading: "Selling a freehold home?",
    body: "Whether freehold, condo, or POTL fits a buyer best comes down to stage, budget, and how hands-on they want to be. Get a free, no-obligation valuation of your Milton home from Aamir.",
    buttonLabel: "Get my home value",
    href: "/sell",
  },
  marketSourceLabel: "TREB / PropTx MLS® sold data, last 12 months · Milton",
};

// ---------------------------------------------------------------------------
// CONDO CONFIG (config #2). The DECISION/guide page (/condos-guide) — distinct
// from the /condos directory. Condo set INCLUDES condo-townhouses (the 45 that
// freehold correctly excludes belong here). Same seam, same composer.
// ---------------------------------------------------------------------------

export const CONDO_CONFIG: TenureConfig = {
  slug: "condos-guide",
  h1: "Condos in Milton",
  eyebrow: "Milton ownership type",
  character:
    "Own your unit and a share of the building — a monthly fee buys you out of the roof, the grounds, the snow. Milton's most accessible way in.",
  subTypes: ["Condo Apartment", "Condo Townhouse"],
  priceFloor: 100000, // drop the one parking/locker anomaly ($20k) from price stats
  activeNoun: { one: "condo", many: "condos" },
  inventoryNoun: "condo",
  subTypeDisplay: [
    { match: "Condo Apartment", compareLabel: "Condo apartment", costLabel: "condo apartments" },
    { match: "Condo Townhouse", compareLabel: "Condo townhome", costLabel: "condo townhomes" },
  ],
  costMiddle: "fee",
  showFee: true,
  feeSentenceTemplate:
    "Across active Milton condo listings, monthly fees typically run from {lo} to {hi} — but they vary widely by building, unit size, and what the fee includes, so treat the range as a starting point, not a rule.",
  soldTail:
    "Condos are Milton's most accessible ownership tier — apartments lead on price, while condo townhomes trade higher for the extra space and a more freehold-like feel.",
  glanceLabels: { vs: "vs Freehold" },
  breadcrumbLabel: "Condos",
  sectionTitles: {
    explained: "Condos in Milton, explained",
    market: "How condos trade in Milton",
    faq: "Condo questions",
  },
  lede:
    "Buying a condo means you own your unit and a share of everything around it — the building, the grounds, the amenities — and a condo corporation maintains all of it on behalf of every owner. You pay a monthly fee for that, and in exchange you stop being personally responsible for the roof, the elevator, the lobby, the snow. For the right buyer that trade is the whole appeal: a lock-and-leave home where someone else handles the upkeep. In Milton, condos run from high-rise and mid-rise apartments to condo townhomes, and they're the most accessible entry point into ownership here — the fee buys you in at a price freehold often can't match.",
  threeWay:
    "The choice between a condo and a freehold home isn't about which is better — it's about who you want handling maintenance and how you want to pay for it. With freehold you own the land, pay no fee, and carry every repair yourself. With a condo you pay a predictable monthly fee and the corporation handles the shared building and grounds. Neither is cheaper in the long run; they just distribute the cost differently. A freehold owner who doesn't budget for a new roof gets a nasty surprise; a condo owner trades that surprise for a fee they pay whether or not anything breaks this year. If you value predictability, low personal maintenance, amenities, or a lock-and-leave lifestyle, a condo fits. If you want maximum control, no recurring fee, and a yard, freehold is the better match. And watch for the in-between: a [[POTL|/potl]] townhome is owned freehold but still carries a smaller monthly fee for shared roads and common elements — freehold ownership with a condo-style fee attached.",
  costIntro:
    "Condos are Milton's more accessible price tier, which is exactly why they matter for first-time buyers and downsizers.",
  costMid:
    "The fee is the number to understand alongside the price: a lower purchase price with a higher monthly fee can cost more over time than it first appears, and a suspiciously low fee can be a warning sign, not a bargain.",
  costEnd:
    "Compare the all-in monthly cost — mortgage plus fee — not just the sticker price, when you weigh a condo against a freehold home.",
  feeCredibility:
    "This is where condo buyers get into trouble, and where it pays to look closely. A condo fee covers two things: day-to-day operating costs (heat, water, insurance, management, maintenance of common areas) and contributions to the reserve fund — the corporation's savings for big future repairs like the roof, elevators, and parking garage. A healthy condo has a well-funded reserve and a fee that reflects the real cost of running the building. The danger sign is a building that keeps its fee artificially low to look attractive on a listing, underfunds the reserve, and then hits owners with a special assessment — a one-time bill, sometimes tens of thousands of dollars, when a major repair can't wait. Before you buy any condo, the status certificate tells you the corporation's financial health, the reserve-fund balance, any planned increases, and whether litigation or special assessments are pending. Reading it properly is the single most important step in buying a condo — and it's exactly the kind of thing worth having an experienced agent walk through with you.",
  whoSuits:
    "Condos tend to fit first-time buyers getting into the market, downsizers trading a house and its upkeep for simplicity, investors who want a lower-maintenance rental, and anyone who travels or works long hours and would rather not own a lawn and a snow shovel. In Milton specifically, condo townhomes appeal to buyers who want a bit more space and a freehold-like feel while keeping the shared-maintenance convenience. If your life is busy, mobile, or just starting out, a condo's trade — fee for freedom-from-upkeep — is often the right one.",
  honestTradeoff:
    "A condo asks you to give up some control. You're one vote among many; the corporation sets the rules, decides what gets maintained and when, and can restrict things from renovations to pets to short-term rentals. The fee can rise, and a poorly run building can become a genuine financial liability. But a well-run condo is one of the simplest, most predictable ways to own — no roof to worry about, no lot to maintain, costs you can plan around. The difference between a great condo purchase and a regretted one is almost always the building's financial health, not the unit itself. Buy the corporation, not just the condo.",
  glanceStatic: [
    { label: "Home types", value: "Condo apartments & condo townhomes" },
    { label: "Best suits", value: "First-time buyers, downsizers, investors" },
    { label: "Monthly fee", value: "Yes — covers shared upkeep & the reserve fund" },
    { label: "vs Condo", value: "Predictable costs, low personal upkeep" },
  ],
  faqs: [
    {
      question: "What does a condo fee in Milton cover?",
      answer:
        "A condo fee covers two things: day-to-day operating costs (heat, water, insurance, management, upkeep of common areas) and contributions to the reserve fund — the corporation's savings for major future repairs like the roof, elevators, and garage. A healthy fee reflects the real cost of running the building; a suspiciously low fee can mean an underfunded reserve and a future special assessment.",
    },
    {
      question: "What is a status certificate and why does it matter?",
      answer:
        "The status certificate is the condo corporation's financial and legal disclosure — reserve-fund balance, planned fee increases, pending special assessments or litigation, and the rules. Reviewing it properly is the single most important step in buying a condo: you're buying the corporation's financial health, not just the unit. Have an experienced agent walk through it with you before you commit.",
    },
    {
      question: "Condo or freehold in Milton — which should I buy?",
      answer:
        "Neither is cheaper overall; they distribute cost differently. A condo means a predictable monthly fee and someone else handling shared maintenance — good for predictability, low upkeep, and a lock-and-leave lifestyle. Freehold means no fee, full control, and a yard, but you carry every repair yourself. Watch for POTL townhomes, which are freehold but still carry a smaller fee for shared roads and common elements.",
    },
  ],
  intents: [
    { key: "buy", label: "Browse condo buildings", sub: "Milton condos directory", href: "/condos" },
    { key: "sell", label: "What's my home worth", sub: "Free Milton valuation", href: "/sell" },
    { key: "invest", label: "Compare freehold", sub: "Freehold homes in Milton", href: "/freehold" },
    { key: "rent", label: "Explore neighbourhoods", sub: "Milton area by area", href: "/neighbourhoods" },
  ],
  ctaBuyer: {
    heading: "Find the right condo",
    body: "Browse Milton's condo buildings, or tell Aamir what you're after — apartment or condo townhome, which neighbourhood, what budget — and get help reading the status certificate before you commit.",
    buttonLabel: "Browse condo buildings",
    href: "/condos",
  },
  ctaSeller: {
    heading: "Selling a condo?",
    body: "Whether a condo or a freehold home fits a buyer best comes down to their stage, budget, and how much they want to own versus outsource. Get a free, no-obligation valuation of your Milton condo from Aamir.",
    buttonLabel: "Get my condo's value",
    href: "/sell",
  },
  marketSourceLabel: "TREB / PropTx MLS® sold data, last 12 months · Milton",
};

// ---------------------------------------------------------------------------
// POTL CONFIG (config #3, the last ownership axis). NULL-STATS: POTL has sub-k
// active listings, so the page shows NO numbers at all (nullStats: true ->
// the seam runs no queries; the composer hides hero tiles, the at-a-glance
// card, and the market section). Pure editorial explainer + FAQ + CTA.
// ---------------------------------------------------------------------------

export const POTL_CONFIG: TenureConfig = {
  slug: "potl",
  h1: 'POTL Homes in Milton — What "Parcel of Tied Land" Actually Means',
  eyebrow: "Milton ownership type",
  character:
    "It looks like freehold, is sold like freehold, and comes with a small monthly fee like a condo. Here's exactly what Parcel of Tied Land means — before you make an offer.",
  subTypes: [], // null-stats: no stat queries run
  nullStats: true,
  breadcrumbLabel: "POTL",
  sectionTitles: {
    explained: "POTL in Milton, explained",
    market: "How POTL works in Milton", // hidden (null-stats); set so it never leaks a freehold default
    faq: "POTL questions",
  },
  glanceLabels: { vs: "vs Freehold" }, // glance is hidden under null-stats; set for forward use
  glanceStatic: [
    { label: "Home types", value: "Freehold townhomes tied to a common parcel" },
    { label: "Best suits", value: "Townhome buyers in newer Milton developments" },
    { label: "Monthly fee", value: "Yes — modest, for shared roads & common elements" },
    { label: "vs Condo", value: "Freehold home plus a small shared-land fee" },
  ],
  overviewParas: [
    "If you're reading this, there's a good chance you found a townhome you like in Milton, looked closer, and saw three letters that didn't quite make sense: POTL. It stands for Parcel of Tied Land, and it's the ownership type that catches more Milton buyers off guard than any other — because it looks like freehold, is sold like freehold, but comes with a monthly fee like a condo. Here's exactly what it is, why it exists, and whether it should change how you feel about the home.",
    "With a POTL home, you own your house and the land it sits on outright — that part is true freehold. You get a deed, you own the structure and the lot, and no condo corporation owns your unit. But your property is tied to a shared parcel of common land — the private roads, visitor parking, walkways, snow removal, sometimes landscaping or a shared amenity — that serves the whole development. A small condo corporation owns and maintains that common parcel, and every owner pays a monthly fee toward it. So you own your home freehold, and you co-own the shared bits through a fee. It's freehold ownership with a condo-style arrangement bolted onto the common areas.",
    "POTL became common in Milton for a simple reason: the town's newer townhome developments are often built with private internal roads and shared spaces the municipality doesn't maintain. Someone has to plow those roads, light them, and repair them — so the developer sets up a small common-elements corporation and ties every home to it. That's why you'll see POTL most often in newer townhome communities here. It lets builders create dense, well-kept developments with shared infrastructure while still selling the individual homes as freehold.",
    "The three-way picture makes POTL easy to place. Pure freehold: you own everything, no fee, you handle all your own maintenance. Condo: you own your unit, pay a fee, and the corporation maintains the building and grounds. POTL: you own your home freehold like the first, but pay a (usually smaller) fee for shared common elements like the second. The POTL fee is typically lower than a full condo fee, because it covers only the shared land and infrastructure — not a building envelope, elevators, or amenities. You're still responsible for your own home's roof, furnace, and everything inside your lot, exactly like a freehold owner.",
    "For most buyers, the answer is: not much — but go in informed. A POTL fee is usually modest, and it pays for things you'd otherwise have no way to handle yourself (you can't personally plow a private road shared by forty homes). The home is still yours, freehold. What's worth checking is the same discipline that protects any fee-based ownership: understand what the fee covers, whether it's been stable, and that the common-elements corporation is run responsibly. The fee is real and ongoing, so factor it into your monthly budget the way you would a condo fee — just usually a smaller one. The buyers who feel blindsided by POTL are almost always the ones who didn't know it was POTL until late in the process. Knowing now, before you make an offer, is the whole point.",
    "POTL isn't a catch or a downside — it's a structure, and a common one in Milton's newer townhome market. You own your home freehold; you pay a modest fee for shared land you genuinely benefit from. The only mistake is being surprised by it. If you've found a POTL home and want to understand exactly what its fee covers and whether the arrangement is sound, that's worth a conversation before you write the offer.",
  ],
  faqs: [
    {
      question: "What does POTL mean in Ontario?",
      answer:
        "Parcel of Tied Land: you own your home and lot freehold, but it's tied to a shared common-elements parcel (private roads, visitor parking, snow removal) maintained by a small condo corporation, funded by a monthly fee. Freehold ownership with a fee for the shared land.",
    },
    {
      question: "Is a POTL home freehold or condo?",
      answer:
        "Both, in a sense. The home and lot are freehold — you own them outright with a deed. The shared common elements are condo-style — co-owned and maintained by a corporation you pay a monthly fee to. Lower fee than a full condo, since it covers only shared land, not a building.",
    },
    {
      question: "Should POTL stop me from buying a townhome I like?",
      answer:
        "Usually not. The fee is typically modest and covers shared infrastructure you couldn't maintain alone. The home is still yours freehold. Just understand what the fee covers and that the corporation is well-run before you offer — being surprised by POTL late is the only real pitfall.",
    },
  ],
  intents: [
    { key: "invest", label: "Compare freehold", sub: "Freehold homes in Milton", href: "/freehold" },
    { key: "buy", label: "Compare condos", sub: "Condos in Milton", href: "/condos-guide" },
    { key: "rent", label: "Explore neighbourhoods", sub: "Milton area by area", href: "/neighbourhoods" },
    { key: "sell", label: "What's my home worth", sub: "Free Milton valuation", href: "/sell" },
  ],
  ctaBuyer: {
    heading: "Found a POTL townhome?",
    body: "Want to know exactly what you're signing up for? Aamir will walk through what the fee covers and whether the common-elements corporation is sound — before you write the offer.",
    buttonLabel: "Browse Milton listings",
    href: "/listings",
  },
  ctaSeller: {
    heading: "Selling a POTL home?",
    body: "Whether freehold, condo, or POTL fits a buyer best comes down to their stage, budget, and how hands-on they want to be. Get a free, no-obligation valuation of your Milton home from Aamir.",
    buttonLabel: "Get my home value",
    href: "/sell",
  },
  marketSourceLabel: "TREB / PropTx MLS® · Milton",
};
