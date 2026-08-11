// src/app/sold/page.tsx
// LIVE /sold — forest-v2 restyle of the city-wide sold/leased records browse.
// RESTYLE ONLY: the VOW defence-in-depth gate (fetcher gate in sold-data.ts +
// the canSeeRecords check here), the separate VOW datastore queries, the
// 90-day/100-record caps, server-side address redaction, the GET-param filter
// contract (type / ptype / nbhd), revalidate=0, and the VOW consumer notice +
// TREB attribution are all unchanged. Only the shell is repainted forest, with
// SiteNav + FooterSection (ChromeGate suppresses the navy Navbar on /sold).
//
// The pre-existing anon teaser (VowGate with no street/nbhd rendered "0 homes
// sold on Milton" under a hero that already shows the real totals) is dropped
// in favour of the hero totals + a clean table gate. VowGate.tsx itself is
// untouched — it's still used by the street/neighbourhood pages; this page now
// renders the gate inline using the SAME getSession + vowAcknowledgedAt check,
// so records still never reach an anon/unacknowledged browser.

import type { Metadata } from "next";
import Link from "next/link";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { getSession } from "@/lib/auth";
import {
  getMiltonSoldTotals,
  getSoldNeighbourhoodOptions,
  getRecentSoldList,
} from "@/lib/sold-data";
import { getMiltonSoldAggregates, getMiltonSoldOverall } from "@/lib/soldAggregates";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import SoldTableForest from "@/components/sold/SoldTableForest";
import SoldAggregates from "@/components/sold/SoldAggregates";
import SoldValuationCTA from "@/components/sold/SoldValuationCTA";
import VowAcknowledgementPrompt from "@/components/vow/VowAcknowledgementPrompt";
import "./sold-theme.css";

// Always server-render (live sold counts).
export const revalidate = 0;

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");

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

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [totals, overall] = await Promise.all([
    getMiltonSoldTotals().catch(() => ({ last30: 0, last90: 0 })),
    getMiltonSoldOverall().catch(() => null),
  ]);
  // Live-data hook (street-tier formula): typical median + 12mo count. k-safe —
  // Milton-wide always clears k, but fall back to the 90-day count if suppressed.
  const typical = overall?.medianPrice ?? null;
  const count12 = overall?.count ?? 0;
  const title =
    typical != null
      ? `${config.CITY_NAME} Sold Home Prices — Typically ${money(typical)} Across ${count12.toLocaleString("en-CA")} Sales`
      : `${config.CITY_NAME} sold homes — ${totals.last90} recent real estate sales`;
  const description =
    typical != null
      ? `What homes really sell for in ${config.CITY_NAME}, ${config.CITY_PROVINCE} — typically ${money(typical)} across ${count12.toLocaleString("en-CA")} sales in the last 12 months${overall?.avgDom != null ? `, ${overall.avgDom} days on market` : ""}${overall?.soldToAskPct != null ? ` at ${overall.soldToAskPct}% of asking` : ""}. Sold prices by neighbourhood and property type, updated daily from TREB MLS®.`
      : `Browse real sold prices and closed transactions in ${config.CITY_NAME} ${config.CITY_PROVINCE}. ${totals.last90} homes sold in the last 90 days. Free sold data for registered users.`;
  return genMeta({
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
}

export default async function SoldHubPage({ searchParams }: PageProps) {
  const user = await getSession();
  const authed = !!user;
  const canSeeRecords = authed && !!user?.vowAcknowledgedAt;

  const typeParam: TypeFilter = searchParams?.type === "lease" ? "lease" : "sale";
  const nbhdParam = searchParams?.nbhd;
  const ptypeFilter = searchParams?.ptype;

  // Defence-in-depth: records are only FETCHED when the viewer is authed +
  // acknowledged. getRecentSoldList itself re-gates and returns [] otherwise,
  // so no anon request ever touches sold.sold_records or its cache.
  // Resolve the neighbourhood param FIRST — the records query needs the raw MLS string, while the
  // URL only ever carries the slug. Accepts a raw string too, so existing inbound links still work.
  const neighbourhoods = await getSoldNeighbourhoodOptions().catch(() => []);
  const nbhdOpt = nbhdParam ? neighbourhoods.find((o) => o.slug === nbhdParam || o.raw === nbhdParam) : undefined;
  const nbhdRaw = nbhdOpt?.raw;

  const [totals, aggregates, records] = await Promise.all([
    getMiltonSoldTotals().catch(() => ({ last30: 0, last90: 0 })),
    // Public k-anon aggregate layer — always fetched (no gate); each fetcher
    // fails soft internally so this never throws.
    getMiltonSoldAggregates(),
    canSeeRecords
      ? getRecentSoldList(typeParam, 90, 60, {
          neighbourhood: nbhdRaw,
          property_type: ptypeFilter,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const txnLabel = typeParam === "sale" ? "sold" : "leased";
  const signinHref = `/signin?redirect=${encodeURIComponent("/sold")}`;

  // Filter-chip hrefs — the GET-param contract still works, but the URL now carries the SLUG.
  const nbhdSlug = nbhdOpt?.slug;
  const nbhdLabel = nbhdOpt?.name;
  const nbhdQ = nbhdSlug ? `&nbhd=${encodeURIComponent(nbhdSlug)}` : "";
  const ptypeQ = ptypeFilter ? `&ptype=${ptypeFilter}` : "";

  return (
    <div className="sold-v2">
      <SiteNav variant="page" />

      {/* hero — real totals + (anon) sign-in CTA */}
      <section className="sv-hero">
        <div className="sv-wrap">
          <span className="sv-eyebrow">
            {config.CITY_NAME} · {config.CITY_PROVINCE} · Real estate
          </span>
          <h1>
            {config.CITY_NAME} <em>sold</em> homes
          </h1>
          <p className="sv-lede">
            Real closed transactions from TREB MLS<sup>®</sup> — exact sold prices, days on
            market, and sold-to-ask ratios across every {config.CITY_NAME} neighbourhood.
          </p>
          <div className="sv-stats">
            <div className="sv-stat">
              <div className="sv-stat-v">{totals.last90}</div>
              <div className="sv-stat-l">Sold in the last 90 days</div>
            </div>
            <div className="sv-stat">
              <div className="sv-stat-v">{totals.last30}</div>
              <div className="sv-stat-l">Sold in the last 30 days</div>
            </div>
          </div>
          {!authed && (
            <Link href={signinHref} className="sv-cta" rel="nofollow">
              Sign in free to see exact sold prices →
            </Link>
          )}
        </div>
      </section>

      {/* INDEXABLE aggregate layer — public, ABOVE the gate. Milton-wide k-anon
          aggregates only (medians/counts/bands); no individual sold record ever
          crosses into this server HTML. */}
      <SoldAggregates data={aggregates} />
      <SoldValuationCTA />

      {/* filter pill chips */}
      <section className="sv-filters">
        <div className="sv-wrap">
          <div className="sv-frow">
            <span className="sv-flabel">Transaction</span>
            <Link
              href={`/sold${nbhdSlug ? `?nbhd=${encodeURIComponent(nbhdSlug)}` : ""}`}
              className={`sv-chip${typeParam === "sale" ? " is-active" : ""}`}
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
              {neighbourhoods.slice(0, 10).map((nb) => (
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
                Showing {records.length} {txnLabel} record{records.length === 1 ? "" : "s"} — last 90 days
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
              <div className="sv-gate-k">TREB VOW · Registered access</div>
              <div className="sv-gate-h">See every {config.CITY_NAME} sold price</div>
              <p className="sv-gate-p">
                Free with a verified email — exact sold prices, days on market, and
                sold-to-ask ratios, updated daily from TREB MLS<sup>®</sup> data.
              </p>
              <Link href={signinHref} className="sv-cta" rel="nofollow">
                Sign in free to unlock →
              </Link>
            </div>
          )}

          {/* VOW consumer notice + TREB MLS attribution — required on every sold surface */}
          <div className="sv-notice">
            <b>
              Source: TREB MLS<sup>®</sup>
            </b>
            <p>
              The information provided herein must only be used by consumers that have a
              bona fide interest in the purchase, sale, or lease of real estate and may not
              be used for any commercial purpose or any other purpose.
            </p>
            <p>Brokerage: RE/MAX Realty Specialists Inc.</p>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
