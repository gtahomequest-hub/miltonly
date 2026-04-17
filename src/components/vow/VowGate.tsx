// VowGate — SSR-only VOW compliance boundary (Point 2).
//
// Anti-pattern we intentionally rejected: client-side blur. That's theatre —
// DevTools reveals the underlying DOM. VOW records must never ship to an
// unauthenticated browser.
//
// Contract: this is a server component. It checks the session server-side.
//   - Authenticated + verified user → renders `children` (the authed sold view).
//   - Everyone else → renders ONLY the pre-computed aggregate teaser (count,
//     temperature, avg DOM, price range) from analytics schema. No individual
//     records, no prices per property, no addresses. Aggregates are derived
//     data and safe to show publicly.
//
// SEO-safe: the aggregate block renders real content for Google to index on
// street and neighbourhood pages, turning anon hits into topical authority
// signals and conversion prompts rather than a blank wall.

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { analyticsDb } from "@/lib/db";
import { cached, CACHE_TTL } from "@/lib/cache";
import type { PublicAggregateTeaser, MarketTemperature } from "@/lib/db-types";

interface VowGateProps {
  children: React.ReactNode;
  street?: string;
  neighbourhood?: string;
  currentPath: string;
  label?: string;
}

const TEMP_LABELS: Record<MarketTemperature, { label: string; tone: string }> = {
  hot:      { label: "Hot seller's market",      tone: "bg-red-100 text-red-800" },
  warm:     { label: "Warm seller's market",     tone: "bg-orange-100 text-orange-800" },
  balanced: { label: "Balanced market",          tone: "bg-slate-100 text-slate-800" },
  cool:     { label: "Cool buyer's market",      tone: "bg-sky-100 text-sky-800" },
  cold:     { label: "Cold buyer's market",      tone: "bg-blue-100 text-blue-800" },
};

async function loadTeaser(
  street?: string,
  neighbourhood?: string
): Promise<PublicAggregateTeaser | null> {
  if (!analyticsDb) return null;
  const sql = analyticsDb;
  const key = street
    ? `street-aggregate:${street}`
    : neighbourhood
      ? `neighbourhood-aggregate:${neighbourhood}`
      : null;
  if (!key) return null;

  try {
    return await cached<PublicAggregateTeaser | null>(
      key,
      CACHE_TTL.aggregate,
      async (): Promise<PublicAggregateTeaser | null> => {
        if (street) {
          // K-ANONYMITY GUARD — do not lower without a written compliance review.
          // MIN(sold_price) and MAX(sold_price) look like aggregates, but when
          // the set has fewer than ~10 rows they reveal individual records:
          //   n=1 → MIN = MAX = that record's exact price
          //   n=2 → MIN and MAX reveal the cheapest and most expensive of two
          //   n<5 → two or three known facts (street + date range + property
          //          type) are enough to match a range back to a specific sale
          // k=10 is the project-wide threshold (see DO-NOT-REPEAT.md "K-anonymity
          // threshold for aggregate teasers"). Rendering side returns a
          // sign-in prompt instead of the range when the CASE returns NULL.
          const rows = (await sql`
            SELECT
              s.sold_count_90days,
              s.avg_dom,
              s.market_temperature,
              CASE WHEN s.sold_count_90days >= 10 THEN (
                SELECT MIN(sold_price) FROM sold.sold_records
                WHERE street_slug = ${street}
                  AND perm_advertise = TRUE
                  AND transaction_type = 'For Sale'
                  AND sold_date >= NOW() - INTERVAL '90 days'
              ) ELSE NULL END AS price_min,
              CASE WHEN s.sold_count_90days >= 10 THEN (
                SELECT MAX(sold_price) FROM sold.sold_records
                WHERE street_slug = ${street}
                  AND perm_advertise = TRUE
                  AND transaction_type = 'For Sale'
                  AND sold_date >= NOW() - INTERVAL '90 days'
              ) ELSE NULL END AS price_max
            FROM analytics.street_sold_stats s
            WHERE s.street_slug = ${street}
          `) as Array<{
            sold_count_90days: number;
            avg_dom: string | null;
            market_temperature: MarketTemperature | null;
            price_min: string | null;
            price_max: string | null;
          }>;
          const r = rows[0];
          if (!r) return null;
          return {
            sold_count_90days: r.sold_count_90days,
            avg_dom: r.avg_dom ? Math.round(parseFloat(r.avg_dom)) : null,
            market_temperature: r.market_temperature,
            price_range_low: r.price_min ? Math.round(parseFloat(r.price_min)) : null,
            price_range_high: r.price_max ? Math.round(parseFloat(r.price_max)) : null,
          };
        }
        if (neighbourhood) {
          // K-ANONYMITY GUARD — do not lower without a written compliance review.
          // Same reasoning as the street branch above: MIN/MAX over <10 rows
          // can be back-calculated to individual sold prices. See DO-NOT-REPEAT.md
          // "K-anonymity threshold for aggregate teasers". Neighbourhoods tend
          // to have higher sale volumes than streets, so k=10 rarely suppresses
          // here in practice — but the rule is uniform regardless of scope.
          const rows = (await sql`
            SELECT
              n.sold_count_90days,
              n.avg_dom,
              CASE WHEN n.sold_count_90days >= 10 THEN (
                SELECT MIN(sold_price) FROM sold.sold_records
                WHERE neighbourhood = ${neighbourhood}
                  AND perm_advertise = TRUE
                  AND transaction_type = 'For Sale'
                  AND sold_date >= NOW() - INTERVAL '90 days'
              ) ELSE NULL END AS price_min,
              CASE WHEN n.sold_count_90days >= 10 THEN (
                SELECT MAX(sold_price) FROM sold.sold_records
                WHERE neighbourhood = ${neighbourhood}
                  AND perm_advertise = TRUE
                  AND transaction_type = 'For Sale'
                  AND sold_date >= NOW() - INTERVAL '90 days'
              ) ELSE NULL END AS price_max
            FROM analytics.neighbourhood_sold_stats n
            WHERE n.neighbourhood = ${neighbourhood}
          `) as Array<{
            sold_count_90days: number;
            avg_dom: string | null;
            price_min: string | null;
            price_max: string | null;
          }>;
          const r = rows[0];
          if (!r) return null;
          return {
            sold_count_90days: r.sold_count_90days,
            avg_dom: r.avg_dom ? Math.round(parseFloat(r.avg_dom)) : null,
            market_temperature: null, // neighbourhood schema doesn't include it
            price_range_low: r.price_min ? Math.round(parseFloat(r.price_min)) : null,
            price_range_high: r.price_max ? Math.round(parseFloat(r.price_max)) : null,
          };
        }
        return null;
      }
    );
  } catch (err) {
    console.warn("[VowGate] teaser load failed:", err);
    return null;
  }
}

function formatMoney(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

export default async function VowGate({
  children,
  street,
  neighbourhood,
  currentPath,
  label,
}: VowGateProps) {
  const user = await getSession();

  // Three gate states:
  //   1) Anon                       → aggregate teaser (existing behaviour)
  //   2) Authed, not yet acknowledged → inline VowAcknowledgementPrompt
  //   3) Authed + acknowledged      → render the full VOW children
  if (user) {
    if (!user.vowAcknowledgedAt) {
      const { default: VowAcknowledgementPrompt } = await import("./VowAcknowledgementPrompt");
      return <VowAcknowledgementPrompt />;
    }
    return <>{children}</>;
  }

  // Anon path — aggregate teaser only. Zero individual records reach the browser.
  const teaser = await loadTeaser(street, neighbourhood);
  const signinHref = `/signin?redirect=${encodeURIComponent(currentPath)}${
    street ? `&intent=sold&street=${encodeURIComponent(street)}` : ""
  }${neighbourhood ? `&intent=sold&neighbourhood=${encodeURIComponent(neighbourhood)}` : ""}`;
  const tempMeta = teaser?.market_temperature ? TEMP_LABELS[teaser.market_temperature] : null;
  const areaLabel = label || (street ? "this street" : neighbourhood ? neighbourhood : "Milton");
  const count = teaser?.sold_count_90days ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Recent sales — last 90 days
        </h3>
      </div>

      <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
        {count} home{count === 1 ? "" : "s"} sold on {areaLabel}
      </p>

      <div className="flex flex-wrap gap-3 mt-4 mb-6">
        {tempMeta && (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${tempMeta.tone}`}>
            {tempMeta.label}
          </span>
        )}
        {teaser?.avg_dom !== null && teaser?.avg_dom !== undefined && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            Avg {teaser.avg_dom} days on market
          </span>
        )}
        {teaser && teaser.price_range_low !== null && teaser.price_range_high !== null ? (
          /* count ≥ 10 — k-anonymity threshold met, range is safe to display */
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {formatMoney(teaser.price_range_low)} – {formatMoney(teaser.price_range_high)}
          </span>
        ) : count >= 1 ? (
          /* 1 ≤ count < 10 — range suppressed by k-anonymity guard in loadTeaser(). */
          /* Render a sign-in prompt chip instead, so anon users see the CTA but never */
          /* a MIN/MAX that could back-calculate an individual sold price. */
          <Link
            href={signinHref}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" fill="currentColor"/>
            </svg>
            Sign in to see sold price range for {street ? "this street" : "this neighbourhood"}
          </Link>
        ) : null}
      </div>

      <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
        <p className="text-sm font-semibold text-slate-900 mb-1">
          See all {count > 0 ? count : ""} sold prices
        </p>
        <p className="text-xs text-slate-600 mb-4">
          Free with a verified email. TREB VOW data — exact sold prices, days on market, and sold-to-ask ratios.
        </p>
        <Link
          href={signinHref}
          className="inline-block bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 transition"
        >
          Sign in free to unlock →
        </Link>
      </div>

      <p className="mt-4 text-[10px] text-slate-400">
        Source: TREB MLS® via VOW. Displayed to registered users per board policy.
      </p>
    </section>
  );
}
