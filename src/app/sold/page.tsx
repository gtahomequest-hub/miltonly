// src/app/sold/page.tsx
// LIVE /sold — forest-v2 restyle of the city-wide sold/leased records browse.
// RESTYLE ONLY: the VOW defence-in-depth gate (fetcher gate in sold-data.ts +
// the canSeeRecords check here), the separate VOW datastore queries, the
// 90-day/100-record caps, server-side address redaction, the GET-param filter
// contract (type / ptype / nbhd), revalidate=0, and the VOW consumer notice +
// TREB attribution are all unchanged. Only the shell is repainted forest, with
// SiteNav + SiteFooter (the site chrome; the navy Navbar is gone since MH-006).
//
// The pre-existing anon teaser (VowGate with no street/nbhd rendered "0 homes
// sold on Milton" under a hero that already shows the real totals) is dropped
// in favour of the hero totals + a clean table gate. VowGate.tsx itself is
// untouched — it's still used by the street/neighbourhood pages; this page now
// renders the gate inline using the SAME getSession + vowAcknowledgedAt check,
// so records still never reach an anon/unacknowledged browser.

import type { Metadata } from "next";
import { publishedHubSlugs, neighbourhoodRows } from "@/lib/hubSets";
import { VOW_NOTICES } from "@/lib/vowNotice";
import { NEIGHBOURHOOD_SEED } from "@/lib/neighbourhood";
import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canSeeVowRecords } from "@/lib/vow-access";
import { logVowAccess, clientIpFromHeaders } from "@/lib/vow-audit";
import { enforceVowThrottle } from "@/lib/vow/throttle";
import { getSoldNeighbourhoodOptions, getRecentSoldList } from "@/lib/sold-data";
import { vowReaderAccess } from "@/lib/vow/door";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";
import SoldTableForest from "@/components/sold/SoldTableForest";
import SoldValuationCTA from "@/components/sold/SoldValuationCTA";
import VowAcknowledgementPrompt from "@/components/vow/VowAcknowledgementPrompt";
import SoldHistoryLine from "@/components/vow/SoldHistoryLine";
import "./sold-theme.css";

// Always server-render (the gated records are per-session).
export const revalidate = 0;

type TypeFilter = "sale" | "lease";

const PROPERTY_TYPES = [
  { slug: "detached", label: "Detached" },
  { slug: "semi", label: "Semi" },
  { slug: "townhouse", label: "Townhouse" },
  { slug: "condo", label: "Condo" },
] as const;

interface PageProps {
  searchParams?: {
    nbhd?: string;
    ptype?: string;
    type?: string;
  };
}

// Every filtered view canonicalises to /sold; a filtered view ALSO self-demotes to
// `noindex, follow` so the param permutations drop out of the index while staying crawlable
// (robots no longer blocks /sold? — the block was preventing Google reading this canonical).
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  // THE HEAD IS FIGURE-FREE (MC-046 Stage 1, R4). It carried the 12-month typical, the sale count,
  // days on market and sold-to-ask, all derived from VOW records (PropTx VOW Best Practices item
  // 40). It now reads from the Town and the page's own purpose only; no sold figure, no count.
  // a hub's view names the hub (MC-027 item 3); the view is noindex either way
  const hubName = searchParams?.nbhd ? NEIGHBOURHOOD_SEED.find((n) => n.slug === searchParams.nbhd)?.name ?? null : null;
  const title = hubName
    ? `${hubName} Sold Home Prices, ${config.CITY_NAME}`
    : `${config.CITY_NAME} Sold Home Prices and Records`;
  const description = `Sold home records for ${config.CITY_NAME}, ${config.CITY_PROVINCE}, by neighbourhood and property type, from PropTx MLS®. Free for registered readers; ${config.CITY_NAME} homes for sale and for lease are open to everyone.`;
  const meta = genMeta({
    title,
    description,
    // Every filtered view canonicalises to /sold. The params are a UI affordance, not a page:
    // they were generating crawlable permutations carrying raw MLS strings.
    canonical: `${config.SITE_URL}/sold`,
    keywords: [
      `${config.CITY_NAME} sold homes`,
      `${config.CITY_NAME} sold prices`,
      `${config.CITY_NAME} real estate sold prices`,
      `recently sold homes ${config.CITY_NAME}`,
      `${config.CITY_NAME} house sold prices`,
      `${config.CITY_NAME} MLS sold data`,
    ],
  });
  // A filtered variant (nbhd / ptype / lease) is a duplicate of the base browse — noindex,follow it.
  const hasFilter = !!(searchParams?.nbhd || searchParams?.ptype || searchParams?.type);
  return hasFilter ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function SoldHubPage({ searchParams }: PageProps) {
  const user = await getSession();
  const authed = !!user;
  let canSeeRecords = canSeeVowRecords(user);
  // The hard throttle (MP-007, R-8.13): a page cannot 429, so over the ceiling the records are
  // withheld (the page renders the aggregate teaser) and no trail row is written; the throttle
  // row is written by enforceVowThrottle.
  if (canSeeRecords && user) {
    const throttle = await enforceVowThrottle({ userId: user.id, ip: clientIpFromHeaders(headers()) });
    if (!throttle.ok) canSeeRecords = false;
  }
  // MC-046: the one door. A reader who passed the gate and the throttle holds an access; everyone
  // else holds none, so this render cannot read DB2 for them.
  const access = canSeeRecords ? vowReaderAccess(user) : null;

  const typeParam: TypeFilter = searchParams?.type === "lease" ? "lease" : "sale";
  const nbhdParam = searchParams?.nbhd;
  const ptypeFilter = searchParams?.ptype;

  // Defence-in-depth: records are only FETCHED when the viewer is authed +
  // acknowledged. getRecentSoldList itself re-gates and returns [] otherwise,
  // so no anon request ever touches sold.sold_records or its cache.
  // Resolve the neighbourhood param FIRST — the records query needs the raw MLS string, while the
  // URL only ever carries the slug. Accepts a raw string too, so existing inbound links still work.
  const [soldOptions, publishedHubSlugList, nbhdRows] = await Promise.all([
    getSoldNeighbourhoodOptions(access).catch(() => []),
    publishedHubSlugs().catch(() => [] as string[]),
    neighbourhoodRows().catch(() => [] as Array<{ slug: string; name: string; rawStrings: string[] }>),
  ]);
  const publishedHubSet = new Set(publishedHubSlugList);
  // one option per published hub, in the seed's order; the raw string is the first the records
  // carry for it, or the registry's first raw string when the window has none
  const neighbourhoods = NEIGHBOURHOOD_SEED.filter((n) => publishedHubSet.has(n.slug)).map((n) => {
    const sold = soldOptions.find((o) => o.slug === n.slug);
    const reg = nbhdRows.find((r) => r.slug === n.slug);
    return { slug: n.slug, name: reg?.name ?? n.name, raw: sold?.raw ?? reg?.rawStrings?.[0] ?? n.rawStrings[0] };
  });
  const nbhdOpt = nbhdParam ? neighbourhoods.find((o) => o.slug === nbhdParam || o.raw === nbhdParam) ?? soldOptions.find((o) => o.raw === nbhdParam) : undefined;
  const nbhdRaw = nbhdOpt?.raw;

  // THE AGGREGATE LAYER AND THE 30/90-DAY COUNTS ARE GONE (MC-046 Stage 1, R6). Every typical,
  // band, count, days-on-market, sold-to-ask, by-type, quarterly and by-hub figure was derived from
  // VOW records and was served to every visitor. Only the gated records remain.
  const records = access
    ? await getRecentSoldList(access, typeParam, 90, 60, {
        neighbourhood: nbhdRaw,
        property_type: ptypeFilter,
      }).catch(() => [])
    : [];

  // The audit trail (MP-006): the city-wide records were served to this consumer. A server
  // component can write a row, not a cookie, so the inactivity clock is wound by /api/auth/me
  // when the page mounts.
  if (canSeeRecords && user) {
    const h = headers();
    await logVowAccess({
      userId: user.id,
      kind: "sold-page",
      // The scope is the area, not the filter combination, so browsing the chips does not read as
      // forty streets; the filters ride on the path.
      scope: nbhdRaw ? `neighbourhood:${nbhdRaw}` : "milton",
      path: `/sold?type=${typeParam}${nbhdParam ? `&nbhd=${nbhdParam}` : ""}${ptypeFilter ? `&ptype=${ptypeFilter}` : ""}`,
      recordCount: records.length,
      ip: clientIpFromHeaders(h),
      userAgent: h.get("user-agent"),
      reviewFlag: user.reviewFlag,
    });
  }

  const txnLabel = typeParam === "sale" ? "sold" : "leased";
  // Filter-chip hrefs — the GET-param contract still works, but the URL now carries the SLUG.
  const nbhdSlug = nbhdOpt?.slug;
  const nbhdLabel = nbhdOpt?.name;
  const nbhdQ = nbhdSlug ? `&nbhd=${encodeURIComponent(nbhdSlug)}` : "";
  const ptypeQ = ptypeFilter ? `&ptype=${ptypeFilter}` : "";
  // THE SIGN-IN RETURNS TO THIS VIEW (MC-027 item 3, MA-005 defect 2). The redirect was the bare
  // /sold, so a reader who arrived from Timberlea's hub, signed in, and came back to all of
  // Milton. The whole query travels: type, ptype and nbhd.
  const returnTo = `/sold?type=${typeParam}${nbhdQ}${ptypeQ}`;
  const signinHref = `/signin?redirect=${encodeURIComponent(returnTo)}`;
  // THE CHIP ROW IS EVERY PUBLISHED HUB (MC-027 item 3). It was the first ten distinct sold
  // strings, so twelve hubs, Timberlea among them, had no chip and no active state when the hub
  // linked here with its own nbhd. Every published hub, in the registry's order.
  const hubChips = neighbourhoods.filter((nb) => publishedHubSet.has(nb.slug));

  return (
    <div className="sold-v2">
      <SiteNavLive variant="page" />

      {/* hero: heading, lede and the (anon) sign-in CTA; no figure */}
      <section className="sv-hero">
        <div className="sv-wrap">
          <span className="sv-eyebrow">
            {config.CITY_NAME} · {config.CITY_PROVINCE} · Real estate
          </span>
          <h1>
            {nbhdLabel ? <>{nbhdLabel} <em>sold</em> homes</> : <>{config.CITY_NAME} <em>sold</em> homes</>}
          </h1>
          <p className="sv-lede">
            {nbhdLabel
              ? <>Real closed transactions from PropTx MLS<sup>®</sup> in {nbhdLabel}, {config.CITY_NAME}: exact sold prices, days on market, and sold-to-ask ratios, with the rest of {config.CITY_NAME} one chip away.</>
              : <>Real closed transactions from PropTx MLS<sup>®</sup>: exact sold prices, days on market, and sold-to-ask ratios across every {config.CITY_NAME} neighbourhood.</>}
          </p>
          {!authed && (
            <Link href={signinHref} className="sv-cta" rel="nofollow">
              Sign in free to see exact sold prices →
            </Link>
          )}
        </div>
      </section>

      {/* THE NEUTRAL LINE where the aggregate layer was (MC-046 Stage 1). It carries no figure;
          a reader who can already see the records does not need it. */}
      {!canSeeRecords && (
        <section className="sv-neutral">
          <div className="sv-wrap">
            <SoldHistoryLine subject="Milton" returnPath="/sold" />
          </div>
        </section>
      )}
      <SoldValuationCTA />

      {/* filter pill chips */}
      <section className="sv-filters">
        <div className="sv-wrap">
          <div className="sv-frow">
            <span className="sv-flabel">Transaction</span>
            <Link
              href={`/sold${nbhdSlug ? `?nbhd=${encodeURIComponent(nbhdSlug)}` : ""}`}
              className={`sv-chip${typeParam === "sale" ? " is-active" : ""}`}
              rel="nofollow"
            >
              Sold
            </Link>
            <Link
              href={`/sold?type=lease${nbhdQ}`} rel="nofollow"
              className={`sv-chip${typeParam === "lease" ? " is-active" : ""}`}
            >
              Leased
            </Link>
          </div>

          <div className="sv-frow">
            <span className="sv-flabel">Property type</span>
            <Link
              href={`/sold?type=${typeParam}${nbhdQ}`} rel="nofollow"
              className={`sv-chip${!ptypeFilter ? " is-active" : ""}`}
            >
              All
            </Link>
            {PROPERTY_TYPES.map((t) => (
              <Link
                key={t.slug}
                href={`/sold?type=${typeParam}&ptype=${t.slug}${nbhdQ}`} rel="nofollow"
                className={`sv-chip${ptypeFilter === t.slug ? " is-active" : ""}`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {neighbourhoods.length > 0 && (
            <div className="sv-frow">
              <span className="sv-flabel">Neighbourhood</span>
              <Link
                href={`/sold?type=${typeParam}${ptypeQ}`} rel="nofollow"
                className={`sv-chip${!nbhdSlug ? " is-active" : ""}`}
              >
                All
              </Link>
              {hubChips.map((nb) => (
                <Link
                  key={nb.slug}
                  href={`/sold?type=${typeParam}&nbhd=${encodeURIComponent(nb.slug)}${ptypeQ}`}
                  className={`sv-chip${nbhdSlug === nb.slug ? " is-active" : ""}`}
                  rel="nofollow"
                >
                  {nb.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* results — gated table */}
      <section className="sv-results">
        <div className="sv-wrap">
          {canSeeRecords ? (
            <>
              <p className="sv-count">
                Showing {records.length} {txnLabel} record{records.length === 1 ? "" : "s"} from the last 90 days
                {nbhdLabel ? ` · ${nbhdLabel}` : ""}
                {ptypeFilter
                  ? ` · ${PROPERTY_TYPES.find((t) => t.slug === ptypeFilter)?.label ?? ptypeFilter}`
                  : ""}
              </p>
              <SoldTableForest
                records={records}
                showStreet
                emptyMessage="No records match these filters in the last 90 days."
              />
            </>
          ) : authed ? (
            // Authed but not yet acknowledged — preserve the one-time VOW flow.
            <VowAcknowledgementPrompt />
          ) : (
            // Anonymous — clean table gate (no records fetched, none in the HTML).
            <div className="sv-gate">
              <div className="sv-gate-k">MLS® VOW · Registered access</div>
              <div className="sv-gate-h">Recent {config.CITY_NAME} sold prices, last 90 days</div>
              <p className="sv-gate-p">
                Free with a verified email: exact sold prices, days on market, and
                sold-to-ask ratios, updated daily from PropTx MLS<sup>®</sup> data.
              </p>
              <Link href={signinHref} className="sv-cta" rel="nofollow">
                Sign in free to unlock →
              </Link>
            </div>
          )}

          {/* VOW consumer notice + PropTx MLS® attribution, required on every sold surface */}
          <div className="sv-notice">
            <b>
              Source: PropTx MLS<sup>®</sup> System
            </b>
            <p>{VOW_NOTICES}</p>
            <p>{config.brokerage.name}</p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
