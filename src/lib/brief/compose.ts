import "server-only";

// The daily brief: what moved in Milton, and one true thing about the reader's own street.
//
// THE BAR IT IS WRITTEN TO. A Milton homeowner reads it in under a minute and learns one true
// thing about their own street or neighbourhood. So it is four numbers and one named-street
// line, in that order, and nothing else. No preamble, no "hope you are well", no recap of
// what the brief is.
//
// WHAT IT IS ALLOWED TO SAY, and why the rules are here rather than in the template:
//
//   - K-ANONYMITY. Every typical price is gated at K_ANON_PRICE against the EXACT sample it is
//     computed over, and suppression is null, never 0 and never a placeholder. Milton sells
//     roughly five to fifteen homes on a weekday, so the sold typical is legitimately
//     suppressed on many days. On those days the brief prints the count and no price. That is
//     the honest edition, not a broken one.
//
//   - "CHANGED", NEVER "DROPPED". DB1 carries Listing.lastPriceChangeAt, which records THAT a
//     price changed and not what it changed from, so a reduction cannot be told from an
//     increase. See DEC-PRICE-CHANGE-NOT-DROP. The word in the copy is "changed price".
//
//   - THE SAME AGGREGATES THE SITE PUBLISHES. New-on-market comes from the same Listing
//     predicate src/lib/homeSignals.ts counts (active, permAdvertise, Milton, sale side); sold
//     comes from sold.sold_records with the same city, permission and transaction filters and
//     the same round-to-$5k the homepage and the Board use. A figure in the brief and the same
//     figure on the site cannot disagree.
//
//   - A STREET NAME COMES FROM resolveStreetName AND NOWHERE ELSE, and a street is only linked
//     when it has a published page. An unlinked street is still named; a 404 in a daily email
//     is worse than plain text.
//
// An edition with nothing in it is not sent. The signup copy promises "it is only what
// changed", so a day on which nothing changed is a day with no email. See shouldSend.

import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { config } from "@/lib/config";
import { K_ANON_PRICE } from "@/lib/kAnon";
import { resolveStreetName } from "@/lib/streetName";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import type { BriefWindow } from "@/lib/brief/window";

const round5k = (n: number) => Math.round(n / 5000) * 5000;
const CITY = config.PRISMA_CITY_VALUE;

const money = (n: number) => `$${n.toLocaleString("en-CA")}`;

export interface StreetEvent {
  slug: string;
  /** The resolved name. Never a slug, never a shortName. */
  name: string;
  kind: "listed" | "sold" | "price-change";
  /** The neighbourhood the street sits in, when the row carried one. */
  neighbourhood: string | null;
}

export interface BriefData {
  /** Sale-side listings first advertised inside the window. */
  listed: { count: number; typicalAsk: number | null };
  /** Sale-side sold records closing inside the window. */
  sold: { count: number; typicalPrice: number | null };
  /** Listings whose price CHANGED inside the window. Direction is unknowable; see above. */
  priceChanged: number;
  /** Every street with an event inside the window, most notable kind first. */
  events: StreetEvent[];
}

/** The Milton-wide read. One call per edition, shared by every subscriber. */
export async function getBriefData(win: BriefWindow): Promise<BriefData> {
  const [listedRows, changed, soldRows] = await Promise.all([
    // NEW ON THE MARKET. The same predicate getNewThisWeekCount uses, windowed to the period.
    prisma.listing.findMany({
      where: {
        status: "active",
        permAdvertise: true,
        city: CITY,
        transactionType: { not: "For Lease" },
        listedAt: { gte: win.start, lt: win.end },
      },
      select: { streetSlug: true, streetName: true, neighbourhood: true, price: true },
    }),
    prisma.listing.count({
      where: {
        status: "active",
        permAdvertise: true,
        city: CITY,
        transactionType: { not: "For Lease" },
        lastPriceChangeAt: { gte: win.start, lt: win.end },
      },
    }),
    soldInWindow(win),
  ]);

  const asks = listedRows.map((r) => r.price).filter((p) => Number.isFinite(p));
  const typicalAsk = asks.length >= K_ANON_PRICE ? round5k(midpoint(asks)) : null;

  // Sold first: a closing is the more notable event, and the ordering is what chooses the
  // street the brief names when the reader has not told us one.
  const events: StreetEvent[] = [
    ...soldRows.streets.map((s) => named(s.slug, s.rawName, s.neighbourhood, "sold" as const)),
    ...listedRows.map((r) => named(r.streetSlug, r.streetName, r.neighbourhood, "listed" as const)),
  ];

  return {
    listed: { count: listedRows.length, typicalAsk },
    sold: { count: soldRows.count, typicalPrice: soldRows.typicalPrice },
    priceChanged: changed,
    events,
  };
}

function named(
  slug: string,
  rawName: string | null,
  neighbourhood: string | null,
  kind: StreetEvent["kind"],
): StreetEvent {
  return { slug, name: resolveStreetName(slug, rawName).name, kind, neighbourhood };
}

function midpoint(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface SoldRead {
  count: number;
  typicalPrice: number | null;
  streets: Array<{ slug: string; rawName: string | null; neighbourhood: string | null }>;
}

// sold_date is a calendar date stamped 00:00 UTC, not an instant, so it is read on the window's
// DATE basis. The Toronto instants (win.start, win.end) select the wrong day here: see
// src/lib/brief/window.ts and marketWatch/windows.ts, "TWO BASES FOR ONE WEEK". The NOW() bound
// is Market Watch's Ruling 10: the table carries rows dated into 2027.
async function soldInWindow(win: BriefWindow): Promise<SoldRead> {
  const db = getSoldDb();
  if (!db) return { count: 0, typicalPrice: null, streets: [] };
  const rows = (await db`
    SELECT street_slug, neighbourhood, sold_price
    FROM sold.sold_records
    WHERE city = ${CITY} AND perm_advertise = TRUE AND transaction_type = 'For Sale'
      AND sold_date >= ${win.dateStartUtc.toISOString()} AND sold_date < ${win.dateEndExclusiveUtc.toISOString()}
      AND sold_date <= NOW()
  `) as Array<{ street_slug: string | null; neighbourhood: string | null; sold_price: unknown }>;

  const prices = rows
    .map((r) => (r.sold_price == null ? NaN : Number(r.sold_price)))
    .filter((p) => Number.isFinite(p) && p > 0);
  // The floor is checked against the sample the figure is computed over, which is these
  // prices, not the row count.
  const typicalPrice = prices.length >= K_ANON_PRICE ? round5k(midpoint(prices)) : null;

  return {
    count: rows.length,
    typicalPrice,
    streets: rows
      .filter((r): r is { street_slug: string; neighbourhood: string | null; sold_price: unknown } => Boolean(r.street_slug))
      .map((r) => ({ slug: r.street_slug, rawName: null, neighbourhood: r.neighbourhood })),
  };
}

/** Nothing changed, so there is nothing to send. The signup promised only what changed. */
export function shouldSend(data: BriefData): boolean {
  return data.listed.count > 0 || data.sold.count > 0 || data.priceChanged > 0;
}

export interface Subscriber {
  watchId: string;
  email: string;
  /** The street the signup surface knew about, when it knew one. */
  streetSlug: string | null;
  neighbourhood: string | null;
}

export interface Edition {
  subject: string;
  html: string;
  text: string;
  /** Which street the personal line named, for the send log. */
  namedStreet: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function linkFor(slug: string, published: Set<string>, origin: string): string | null {
  return published.has(slug) ? `${origin}/streets/${slug}` : null;
}

/**
 * THE ONE TRUE THING. What the reader learns about their own ground.
 *
 * Preference order, and each step is a weaker claim than the one above it:
 *   1. an event on the street their signup named
 *   2. an event in the neighbourhood their signup named
 *   3. the most notable event in Milton, named to its street
 * Step 3 is the honest floor for a subscriber who only ever gave us an email address: it is
 * still one named street and one real event, it is simply not theirs.
 */
function personalLine(
  sub: Subscriber,
  data: BriefData,
  published: Set<string>,
  origin: string,
): { html: string; text: string; namedStreet: string | null } {
  const verb = (k: StreetEvent["kind"]) =>
    k === "sold" ? "sold" : k === "listed" ? "came to market" : "changed price";

  const onStreet = sub.streetSlug ? data.events.find((e) => e.slug === sub.streetSlug) : undefined;
  if (onStreet) {
    return render(onStreet, `On ${onStreet.name}: a home ${verb(onStreet.kind)}.`, published, origin);
  }

  if (sub.streetSlug) {
    const name = resolveStreetName(sub.streetSlug).name;
    const inHood = sub.neighbourhood
      ? data.events.find((e) => e.neighbourhood && e.neighbourhood === sub.neighbourhood)
      : undefined;
    if (inHood) {
      return render(inHood, `Nothing on ${name}. Nearby, a home on ${inHood.name} ${verb(inHood.kind)}.`, published, origin);
    }
    const link = linkFor(sub.streetSlug, published, origin);
    const sentence = `Nothing changed on ${name}.`;
    return {
      html: link ? `${esc(sentence)} <a href="${link}">See its page</a>.` : esc(sentence),
      text: link ? `${sentence} ${link}` : sentence,
      namedStreet: name,
    };
  }

  const inHood = sub.neighbourhood
    ? data.events.find((e) => e.neighbourhood && e.neighbourhood === sub.neighbourhood)
    : undefined;
  if (inHood) {
    return render(inHood, `In ${sub.neighbourhood}: a home on ${inHood.name} ${verb(inHood.kind)}.`, published, origin);
  }

  // The Milton-wide floor. Prefer a street with a page, so the line the reader can act on is
  // the line they get; fall back to the most notable event either way.
  const best = data.events.find((e) => published.has(e.slug)) ?? data.events[0];
  if (!best) return { html: "", text: "", namedStreet: null };
  return render(best, `Closest to home: a house on ${best.name} ${verb(best.kind)}.`, published, origin);
}

function render(
  event: StreetEvent,
  sentence: string,
  published: Set<string>,
  origin: string,
): { html: string; text: string; namedStreet: string } {
  const link = linkFor(event.slug, published, origin);
  if (!link) return { html: esc(sentence), text: sentence, namedStreet: event.name };
  // The street's own name is the anchor, so the link says where it goes.
  const html = esc(sentence).replace(esc(event.name), `<a href="${link}">${esc(event.name)}</a>`);
  return { html, text: `${sentence} ${link}`, namedStreet: event.name };
}

/** The headline numbers, as sentences. Each one is dropped when its count is 0, so a quiet
 *  edition is short rather than padded with zeros. */
function figureLines(data: BriefData): string[] {
  const out: string[] = [];
  if (data.listed.count > 0) {
    const homes = data.listed.count === 1 ? "home" : "homes";
    out.push(
      data.listed.typicalAsk !== null
        ? `${data.listed.count} ${homes} came to market, asking a typical ${money(data.listed.typicalAsk)}.`
        : `${data.listed.count} ${homes} came to market.`,
    );
  }
  if (data.sold.count > 0) {
    const homes = data.sold.count === 1 ? "home" : "homes";
    out.push(
      data.sold.typicalPrice !== null
        ? `${data.sold.count} ${homes} sold, at a typical ${money(data.sold.typicalPrice)}.`
        : // Below the k floor the count is public and the price is not. The clause says which.
          `${data.sold.count} ${homes} sold. Too few to publish a typical price.`,
    );
  }
  if (data.priceChanged > 0) {
    const listings = data.priceChanged === 1 ? "listing" : "listings";
    // "Changed", never "dropped": see DEC-PRICE-CHANGE-NOT-DROP.
    out.push(`${data.priceChanged} ${listings} changed price.`);
  }
  return out;
}

export async function composeEdition(
  sub: Subscriber,
  data: BriefWindowedData,
): Promise<Edition> {
  const { win, brief, published, unsubscribeUrl } = data;
  // A preview edition links to the preview deployment, so a preview test of any link in it is
  // exercising the preview and not production. Both share one database.
  const origin = data.siteOrigin ?? config.SITE_URL;
  const personal = personalLine(sub, brief, published, origin);
  const figures = figureLines(brief);

  const subject = `${config.CITY_NAME} brief: ${briefSubjectTail(brief)}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#073126;">
      <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#017848;margin:0 0 10px;">
        ${esc(config.CITY_NAME)} ${esc(data.win.label)} &middot; ${esc(win.date)}
      </p>
      <ul style="font-size:15px;line-height:1.55;margin:0 0 16px;padding-left:18px;">
        ${figures.map((f) => `<li>${esc(f)}</li>`).join("")}
      </ul>
      ${personal.html ? `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;">${personal.html}</p>` : ""}
      <p style="font-size:13px;line-height:1.5;color:#4b5563;margin:0 0 18px;">
        Every figure is the same one <a href="${origin}" style="color:#017848;">${esc(config.SITE_NAME)}</a> publishes.
        Prices are suppressed when too few homes sold to publish one.
      </p>
      <p style="font-size:11px;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:12px;">
        ${esc(config.realtor.name)} &middot; RE/MAX Realty Specialists Inc., Brokerage<br/>
        <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe from the brief</a>
      </p>
    </div>
  `.trim();

  const text = [
    `${config.CITY_NAME} ${win.label} · ${win.date}`,
    "",
    ...figures.map((f) => `- ${f}`),
    "",
    personal.text,
    "",
    `Every figure is the same one ${config.SITE_NAME} publishes: ${origin}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, html, text, namedStreet: personal.namedStreet };
}

export interface BriefWindowedData {
  win: BriefWindow;
  brief: BriefData;
  /** Slugs with a published page, so a link is never a 404. */
  published: Set<string>;
  unsubscribeUrl: string;
  /** Where every link in the edition points. The canonical site in production. */
  siteOrigin?: string;
}

/** The subject names the largest real number in the edition, so a reader can triage it from
 *  the inbox list without opening anything. */
function briefSubjectTail(data: BriefData): string {
  if (data.sold.count > 0) {
    return `${data.sold.count} sold, ${data.listed.count} new`;
  }
  if (data.listed.count > 0) {
    return `${data.listed.count} new on the market`;
  }
  return `${data.priceChanged} price change${data.priceChanged === 1 ? "" : "s"}`;
}

/** The published-page set, loaded once per edition rather than per subscriber. */
export async function publishedSet(): Promise<Set<string>> {
  return new Set(await publishedStreetPageSlugs());
}
