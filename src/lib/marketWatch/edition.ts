// src/lib/marketWatch/edition.ts
//
// Assembles one weekly edition. Every figure arrives already k-gated from
// windows.ts; nothing here re-derives a number or relaxes a floor.
//
// WHAT IS NOT IN v1, AND WHY. The proposed "open this weekend" section is not
// here. Open houses are read live from AMPRE at request time and expire, and
// an edition is IMMUTABLE once published: /market-watch/2026-08-31 must render
// the same page in a year that it rendered on its Monday. A stored weekend
// that has passed is a lie by the following Tuesday, and a live block inside
// an archived edition breaks the immutability the table exists to provide. The
// live block belongs on the index page instead, as its own piece of work.
// Flagged in HANDOFF-content.md rather than quietly dropped.
//
// LEASE IS OUT OF v1 (ruling 9). Nothing here reads a lease figure.

import "server-only";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { NEIGHBOURHOOD_SEED } from "@/lib/neighbourhood";
import { getMiltonSoldByNeighbourhood, getMiltonSoldOverall } from "@/lib/soldAggregates";
import { formatMoney } from "@/lib/mortgage-math";
import type { GroundedFigures, GroundedFigure } from "@/lib/content/groundedFigures";
import {
  lastCompleteWeek,
  weekFromMonday,
  previousWeek,
  trailingWindow,
  getWeeklySales,
  getByForm,
  getNeighbourhoodCounts,
  getStreetCounts,
  type WeekWindow,
  type WeeklySales,
  type FormRow,
} from "./windows";

const CITY = config.CITY_NAME;

function fig(
  key: string,
  value: number | string | null,
  label: string,
  kind: GroundedFigure["kind"],
  source: string,
): GroundedFigure {
  return { key, value, label, kind, source };
}

// ── the shape a page renders ──────────────────────────────────────────────

export interface EditionNeighbourhoodRow {
  name: string;
  slug: string | null; // null when no published hub owns the raw string
  weekCount: number;
  typical12mo: number | null;
}

export interface EditionStreetRow {
  slug: string;
  name: string;
  count: number;
}

export interface EditionSections {
  weekOf: string;
  weekLabel: string;
  windowStartIso: string;
  windowEndIso: string;
  sales: WeeklySales;
  previous: { weekOf: string; count: number };
  newListings: number;
  forms: { label: string; rows: FormRow[] };
  neighbourhoods: EditionNeighbourhoodRow[];
  streets: EditionStreetRow[];
  context12mo: { count: number; typicalPrice: number | null; avgDom: number | null };
}

export interface BuiltEdition {
  weekOf: string;
  window: WeekWindow;
  sections: EditionSections;
  summarySentence: string;
  figures: GroundedFigures;
  metaTitle: string;
  metaDescription: string;
}

// ── the one deterministic sentence ────────────────────────────────────────
//
// Generated from the data by code, never by a model. Same discipline as the
// address-anchor summary sentence. When the week is thin the sentence SAYS the
// week was thin rather than leaving a hole where a price would be.

export function buildSummarySentence(s: EditionSections): string {
  const parts: string[] = [];
  parts.push(`${s.sales.count} ${s.sales.count === 1 ? "home" : "homes"} sold in ${CITY} in the ${s.weekLabel}`);

  const delta = s.sales.count - s.previous.count;
  if (delta === 0) parts.push(`the same number as the week before`);
  else if (delta > 0) parts.push(`${delta} more than the week before`);
  else parts.push(`${Math.abs(delta)} fewer than the week before`);

  let sentence = parts.join(", ") + ".";

  if (s.sales.typicalPrice !== null) {
    sentence += ` The typical sold price was ${formatMoney(s.sales.typicalPrice)}`;
    if (s.sales.avgDom !== null) sentence += `, after ${s.sales.avgDom} days on market`;
    sentence += ".";
  } else {
    sentence += ` Too few homes sold for a typical price to be published for the week.`;
  }
  return sentence;
}

// ── assembly ──────────────────────────────────────────────────────────────

export async function buildEdition(weekOf?: string): Promise<BuiltEdition | null> {
  const window = weekOf ? weekFromMonday(weekOf) : lastCompleteWeek();
  if (!window) return null;
  const prev = previousWeek(window);
  const trailing = trailingWindow(window, 28);

  const [sales, prevSales, forms, nbhdCounts, streetCounts, hubRows, overall12] = await Promise.all([
    getWeeklySales(window),
    getWeeklySales(prev),
    getByForm(trailing),
    getNeighbourhoodCounts(window),
    getStreetCounts(window),
    getMiltonSoldByNeighbourhood(),
    getMiltonSoldOverall(),
  ]);

  // New listings, DB1, same week, same display gate every public count uses.
  const newListings = await prisma.listing.count({
    where: {
      city: config.PRISMA_CITY_VALUE,
      transactionType: "For Sale",
      permAdvertise: true,
      displayAddress: true,
      listedAt: { gte: window.startUtc, lte: window.endUtc },
    },
  });

  // Raw DB2 neighbourhood string -> published hub slug. NEIGHBOURHOOD_SEED
  // carries the raw strings each hub owns, so this is the same bridge
  // getMiltonSoldByNeighbourhood crosses; a raw string no published hub owns
  // resolves to null and renders without a link rather than being dropped.
  const rawToSlug = new Map<string, string>();
  for (const seed of NEIGHBOURHOOD_SEED) {
    for (const raw of seed.rawStrings) rawToSlug.set(raw.trim(), seed.slug);
  }
  const hubBySlug = new Map(hubRows.map((h) => [h.slug, h]));

  const neighbourhoods: EditionNeighbourhoodRow[] = nbhdCounts
    .map((r) => {
      const slug = rawToSlug.get(r.neighbourhood) ?? null;
      const hub = slug ? hubBySlug.get(slug) : undefined;
      return {
        name: hub?.name ?? r.neighbourhood,
        slug: hub ? hub.slug : null,
        weekCount: r.count,
        typical12mo: hub?.typicalPrice ?? null,
      };
    })
    .sort((a, b) => b.weekCount - a.weekCount);

  // Streets link only where a page already exists — the publish floor.
  const published = await prisma.streetContent.findMany({
    where: {
      status: "published",
      streetSlug: { in: streetCounts.map((s) => s.streetSlug) },
    },
    select: { streetSlug: true, streetName: true },
  });
  const nameBySlug = new Map(published.map((p) => [p.streetSlug, p.streetName]));
  const streets: EditionStreetRow[] = streetCounts
    .filter((s) => nameBySlug.has(s.streetSlug))
    .map((s) => ({ slug: s.streetSlug, name: nameBySlug.get(s.streetSlug) as string, count: s.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const sections: EditionSections = {
    weekOf: window.weekOf,
    weekLabel: window.label,
    windowStartIso: window.startUtc.toISOString(),
    windowEndIso: window.endUtc.toISOString(),
    sales,
    previous: { weekOf: prev.weekOf, count: prevSales.count },
    newListings,
    forms: { label: trailing.label, rows: forms },
    neighbourhoods,
    streets,
    context12mo: {
      count: overall12.count,
      typicalPrice: overall12.medianPrice,
      avgDom: overall12.avgDom,
    },
  };

  const summarySentence = buildSummarySentence(sections);

  // The grounding bundle handed to the optional paragraph, and stored on the
  // generation row. Every figure the page renders, and nothing it does not.
  const figures: GroundedFigure[] = [
    fig("week.count", sales.count, `sales, ${window.label}`, "count", "getWeeklySales"),
    fig("week.typical", sales.typicalPrice, `typical sold price, ${window.label}`, "dollar", "getWeeklySales"),
    fig("week.bandLow", sales.bandLow, `middle-half low, ${window.label}`, "dollar", "getWeeklySales"),
    fig("week.bandHigh", sales.bandHigh, `middle-half high, ${window.label}`, "dollar", "getWeeklySales"),
    fig("week.dom", sales.avgDom, `days on market, ${window.label}`, "days", "getWeeklySales"),
    fig("week.soldToAsk", sales.soldToAskPct, `sold to ask, ${window.label}`, "percent", "getWeeklySales"),
    fig("week.newListings", newListings, `new listings, ${window.label}`, "count", "prisma.listing.count"),
    fig("prevWeek.count", prevSales.count, `sales, week of ${prev.weekOf}`, "count", "getWeeklySales"),
    fig("ctx12.count", overall12.count, "sales, trailing 12 months", "count", "getMiltonSoldOverall"),
    fig("ctx12.typical", overall12.medianPrice, "typical sold price, trailing 12 months", "dollar", "getMiltonSoldOverall"),
    fig("ctx12.dom", overall12.avgDom, "days on market, trailing 12 months", "days", "getMiltonSoldOverall"),
  ];
  for (const f of forms) {
    figures.push(fig(`form.${f.slug}.count`, f.count, `${f.label} sales, ${trailing.label}`, "count", "getByForm"));
    figures.push(fig(`form.${f.slug}.typical`, f.typicalPrice, `typical ${f.label.toLowerCase()} price, ${trailing.label}`, "dollar", "getByForm"));
  }
  for (const n of neighbourhoods) {
    figures.push(fig(`nbhd.${n.name}.week`, n.weekCount, `${n.name} sales, ${window.label}`, "count", "getNeighbourhoodCounts"));
  }
  for (const s of streets) {
    figures.push(fig(`street.${s.slug}.week`, s.count, `${s.name} sales, ${window.label}`, "count", "getStreetCounts"));
  }

  const entities = [
    CITY,
    ...neighbourhoods.map((n) => n.name),
    ...streets.map((s) => s.name),
  ];

  const metaTitle = `${CITY} Market Watch, ${window.label}`;
  const metaDescription =
    sales.typicalPrice !== null
      ? `${sales.count} homes sold in ${CITY} in the ${window.label}, at a typical price of ${formatMoney(sales.typicalPrice)}. Weekly sales, new listings and activity by neighbourhood.`
      : `${sales.count} homes sold in ${CITY} in the ${window.label}. Weekly sales, new listings and activity by neighbourhood.`;

  return {
    weekOf: window.weekOf,
    window,
    sections,
    summarySentence,
    figures: { figures, entities },
    metaTitle,
    metaDescription,
  };
}
