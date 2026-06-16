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
import type { HubData, HubStats } from "@/components/hub/types";
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
  // editorial blocks (static, verbatim). {tokens} are injected from live stats.
  lede: string;
  threeWay: string;
  costIntro: string; // before the (live) cost line
  costMid: string; // before the (live) by-subtype line
  costEnd: string;
  whoSuits: string;
  honestTradeoff: string;
  glanceStatic: TenureGlanceItem[]; // non-numeric glance rows (tenure framing)
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
      SELECT COUNT(*)::int AS n,
             AVG(sold_price) AS avg_price,
             MIN(sold_price) AS lo, MAX(sold_price) AS hi,
             AVG(days_on_market) AS dom
      FROM sold.sold_records
      WHERE city = 'Milton' AND perm_advertise = TRUE
        AND transaction_type = 'For Sale'
        AND TRIM(property_sub_type) = ANY(${subTypes}::text[])
        AND sold_date >= NOW() - INTERVAL '12 months'
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
  // ACTIVE side — DB1 Prisma, active SALE-only LIST price, clean subType filter.
  const activeRows = await prisma.listing.findMany({
    where: { city: "Milton", permAdvertise: true, status: "active" },
    select: { propertySubType: true, price: true, bedrooms: true, transactionType: true },
  });
  const inSet = (s: string | null) => cfg.subTypes.includes(norm(s));
  const isSale = (t: string | null) => (t ?? "").toLowerCase() !== "for lease";

  const freeholdActive = activeRows.filter((r) => inSet(r.propertySubType));
  const saleActive = freeholdActive.filter(
    (r) => isSale(r.transactionType) && typeof r.price === "number" && (r.price as number) > 0,
  );
  const prices = saleActive.map((r) => r.price as number);

  const activeCount = freeholdActive.length;
  const medianList = median(prices);
  const loList = prices.length ? Math.min(...prices) : null;
  const hiList = prices.length ? Math.max(...prices) : null;

  // by-subtype median (active sale list) — only k-safe segments surface
  function subMedian(label: string): number | null {
    const xs = saleActive.filter((r) => norm(r.propertySubType) === label).map((r) => r.price as number);
    return xs.length >= K_ANON_PRICE ? median(xs) : null;
  }
  const detMed = subMedian("Detached");
  const townMed = subMedian("Att/Row/Townhouse");
  const semiMed = subMedian("Semi-Detached");

  // by-bedroom (active freehold) — k-gated, 2..6 then 6+ bucket
  const bedBuckets: { label: string; count: number }[] = [];
  const bedCounts = new Map<number, number>();
  for (const r of freeholdActive) {
    if (typeof r.bedrooms === "number") bedCounts.set(r.bedrooms, (bedCounts.get(r.bedrooms) ?? 0) + 1);
  }
  for (let b = 2; b <= 5; b++) {
    const c = bedCounts.get(b) ?? 0;
    if (c >= K_ANON_PRICE) bedBuckets.push({ label: `${b} bed`, count: c });
  }
  let sixPlus = 0;
  for (const [b, c] of Array.from(bedCounts.entries())) if (b >= 6) sixPlus += c;
  if (sixPlus >= K_ANON_PRICE) bedBuckets.push({ label: "6+ bed", count: sixPlus });

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
    ? `Right now Milton has ${activeCount} active freehold ${activeCount === 1 ? "home" : "homes"}, with a median asking price of ${fullPrice(medianList as number)}${loList && hiList ? ` and asking prices running from ${fullPrice(loList)} to ${fullPrice(hiList)}` : ""}.`
    : "";
  const subParts: string[] = [];
  if (detMed) subParts.push(`detached homes typically ask ${fullPrice(detMed)}`);
  if (townMed) subParts.push(`freehold townhomes ${fullPrice(townMed)}`);
  if (semiMed) subParts.push(`semis ${fullPrice(semiMed)}`);
  const subLive = subParts.length
    ? `Across active freehold listings, ${subParts.join(", ")}.`
    : "";

  const costParagraph = [cfg.costIntro, costLive, cfg.costMid, subLive, cfg.costEnd]
    .filter(Boolean)
    .join(" ");

  const overview = [cfg.lede, cfg.threeWay, costParagraph, cfg.whoSuits, cfg.honestTradeoff];

  // glance: tenure-static rows + a live price-range row at the top
  const priceRange =
    loList && hiList ? `${compactPrice(loList)} – ${compactPrice(hiList)}` : null;

  // market commentary (sold-derived; honest silence if sub-k)
  const commentaryParas: string[] = [];
  if (sold.n >= K_ANON_PRICE && sold.typical) {
    commentaryParas.push(
      `Over the last 12 months, ${sold.n.toLocaleString("en-CA")} freehold homes sold across Milton at a typical price of ${fullPrice(sold.typical)}${sold.dom ? `, taking about ${sold.dom} days on market` : ""}. Freehold is the deepest, most liquid segment of the Milton market — detached homes lead it, with freehold townhomes and semis trading faster at lower prices.`,
    );
  } else {
    commentaryParas.push(
      `There isn't enough recent freehold sales activity to publish a reliable typical sold price right now. Active asking prices above are the better current guide; ask Aamir for the latest closed comparables.`,
    );
  }
  if (bedBuckets.length) {
    const bedText = bedBuckets
      .sort((a, b) => b.count - a.count)
      .map((b) => `${b.label} (${b.count})`)
      .join(", ");
    commentaryParas.push(`Active freehold inventory by size: ${bedText}.`);
  }

  // marketCompare rows = by-subtype active median (what "freehold" actually spans)
  const marketCompare = [
    detMed ? { metricLabel: "Detached", neighbourhoodValue: fullPrice(detMed), miltonValue: medianList ? fullPrice(medianList) : "—", delta: "active asking median" } : null,
    townMed ? { metricLabel: "Freehold townhome", neighbourhoodValue: fullPrice(townMed), miltonValue: medianList ? fullPrice(medianList) : "—", delta: "active asking median" } : null,
    semiMed ? { metricLabel: "Semi-detached", neighbourhoodValue: fullPrice(semiMed), miltonValue: medianList ? fullPrice(medianList) : "—", delta: "active asking median" } : null,
  ].filter(Boolean) as HubData["marketCompare"];

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
    "Most Milton buyers are really choosing between three ownership types, not two, and the difference is who handles maintenance and who pays for it. Freehold: you own everything, pay no fee, and carry all the upkeep yourself. Condo: you own your unit, pay a monthly fee, and the corporation maintains the building, grounds, and amenities. POTL (Parcel of Tied Land — common in Milton's newer townhome developments): you own your home freehold, but pay a smaller monthly fee toward shared elements like private roads, visitor parking, and snow removal. It catches buyers off guard — a “freehold” townhome with a fee attached — which is why it's worth understanding before you're surprised by it at the offer stage. Freehold is the right fit if you want maximum control and no recurring fee, and you're prepared to budget for your own maintenance. If predictable costs and someone-else-handles-it convenience matter more, condo or POTL may serve you better.",
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
