#!/usr/bin/env node
// Phase 3 smoke test — picks 5 varied streets by data profile and reports
// what shape getStreetPageData() will return for each. Does NOT render the
// page; for visual verification, run `npm run dev` and open the URLs below.
//
// Usage: `node scripts/street-page-smoke-test.mjs` (reads .env.local).

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]+?)["']?\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/\\n$/, "");
    }
  } catch { /* ignore */ }
}
loadEnv();

const analyticsUrl = process.env.ANALYTICS_DATABASE_URL;
const soldUrl = process.env.SOLD_DATABASE_URL;
const dbUrl = process.env.DATABASE_URL;

if (!analyticsUrl || !soldUrl || !dbUrl) {
  console.error("Missing DB URLs. Check .env.local");
  process.exit(1);
}

const analytics = neon(analyticsUrl);
const sold = neon(soldUrl);
const db1 = neon(dbUrl);

async function findProfiles() {
  const [rich, medium, thin, leaseOnly, newStreet] = await Promise.all([
    // Rich: highest sold_count_12months with k >= 10
    analytics`
      SELECT street_slug, sold_count_12months, sold_count_90days, avg_sold_price, leased_count_12months
      FROM analytics.street_sold_stats
      WHERE sold_count_12months >= 30
      ORDER BY sold_count_12months DESC
      LIMIT 1
    `,
    // Medium: 10 <= sold_count_12months <= 25
    analytics`
      SELECT street_slug, sold_count_12months, sold_count_90days, avg_sold_price, leased_count_12months
      FROM analytics.street_sold_stats
      WHERE sold_count_12months BETWEEN 10 AND 25
      ORDER BY sold_count_12months DESC
      LIMIT 1
    `,
    // Thin: 1 <= sold_count_12months <= 4 (tests k-anonymity suppression)
    analytics`
      SELECT street_slug, sold_count_12months, sold_count_90days, avg_sold_price, leased_count_12months
      FROM analytics.street_sold_stats
      WHERE sold_count_12months BETWEEN 1 AND 4
      ORDER BY sold_count_12months DESC
      LIMIT 1
    `,
    // Lease-only: leased_count > 0 AND sold_count_12months = 0
    analytics`
      SELECT street_slug, sold_count_12months, leased_count_12months, avg_leased_price
      FROM analytics.street_sold_stats
      WHERE leased_count_12months > 0 AND sold_count_12months = 0
      ORDER BY leased_count_12months DESC
      LIMIT 1
    `,
    // New: has listings in DB1 but NO row in analytics.street_sold_stats
    db1`
      WITH all_slugs AS (
        SELECT DISTINCT "streetSlug" AS slug,
               COUNT(*)::int AS n,
               MAX("listedAt") AS latest
        FROM "Listing"
        WHERE "permAdvertise" = TRUE
        GROUP BY "streetSlug"
      )
      SELECT slug, n, latest
      FROM all_slugs
      WHERE slug NOT IN (
        SELECT DISTINCT "streetSlug" AS slug
        FROM "Listing"
        WHERE status = 'sold'
      )
      ORDER BY latest DESC NULLS LAST
      LIMIT 1
    `,
  ]);

  return [
    ["rich", rich[0]],
    ["medium", medium[0]],
    ["thin (k-anonymity test)", thin[0]],
    ["lease-only", leaseOnly[0]],
    ["new / sparse", newStreet[0]],
  ];
}

async function profileStreet(slug) {
  const [stats, typeAggs, activeCount, content] = await Promise.all([
    analytics`SELECT * FROM analytics.street_sold_stats WHERE street_slug = ${slug}`,
    sold`
      SELECT property_type, COUNT(*)::int AS n, AVG(sold_price) AS avg_price
      FROM sold.sold_records
      WHERE street_slug = ${slug}
        AND perm_advertise = TRUE
        AND transaction_type = 'For Sale'
        AND sold_date >= NOW() - INTERVAL '12 months'
      GROUP BY property_type
    `,
    db1`SELECT COUNT(*)::int AS n FROM "Listing" WHERE "streetSlug" = ${slug} AND status = 'active' AND "permAdvertise" = TRUE`,
    db1`SELECT description IS NOT NULL AS has_desc, "faqJson" IS NOT NULL AS has_faqs, "streetName" FROM "StreetContent" WHERE "streetSlug" = ${slug}`,
  ]);

  return {
    slug,
    streetName: content[0]?.streetName ?? null,
    stats: stats[0] ?? null,
    typeAggs,
    activeCount: activeCount[0]?.n ?? 0,
    hasDescription: !!content[0]?.has_desc,
    hasFaqs: !!content[0]?.has_faqs,
  };
}

function formatCADShort(n) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function renderReport(label, profile) {
  const { slug, streetName, stats, typeAggs, activeCount, hasDescription, hasFaqs } = profile;
  const s = stats ?? {};
  const soldN = Number(s.sold_count_12months ?? 0);
  const leasedN = Number(s.leased_count_12months ?? 0);
  const typical = s.avg_sold_price ? parseFloat(s.avg_sold_price) : null;
  const kAnonPass = soldN >= 5;

  console.log("");
  console.log(`── ${label.toUpperCase()} — ${streetName ?? slug}  (/streets/${slug})`);
  console.log(`   sold_count_12mo: ${soldN}   leased_count_12mo: ${leasedN}   active: ${activeCount}`);
  console.log(`   typical_sold:    ${typical ? formatCADShort(typical) : "—"} (${kAnonPass ? "publishes" : "SUPPRESSED — k<5"})`);
  console.log(`   types sold 12mo: ${typeAggs.length > 0 ? typeAggs.map(t => `${t.property_type}:${t.n}`).join(" ") : "none"}`);
  console.log(`   description:     ${hasDescription ? "present" : "MISSING"}   faqs: ${hasFaqs ? "present" : "MISSING"}`);

  const issues = [];
  if (soldN >= 5 && !typical) issues.push("avg_sold_price null despite k>=5 — stats compute may need rerun");
  if (!streetName && !soldN) issues.push("no streetName and no sold history — page may 404");
  if (issues.length > 0) console.log(`   ⚠ ${issues.join("; ")}`);
  else console.log(`   ✓ profile is internally consistent`);
}

(async () => {
  console.log("Street page smoke test — Phase 3");
  console.log("═══════════════════════════════════════════════════════════");
  const profiles = await findProfiles();
  for (const [label, row] of profiles) {
    if (!row) {
      console.log("");
      console.log(`── ${label.toUpperCase()} — no matching street found`);
      continue;
    }
    const slug = row.street_slug ?? row.slug;
    const detail = await profileStreet(slug);
    renderReport(label, detail);
  }
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("Visual check: run `npm run dev` and open each URL above.");
})().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
