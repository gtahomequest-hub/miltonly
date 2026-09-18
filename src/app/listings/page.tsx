// src/app/listings/page.tsx
// LIVE /listings — cut over to the forest-v2 listings shell via the
// getListingsV2Data seam (the hub/condo/street cutover pattern). RESTYLE ONLY:
// the loader ports the old inline where-builder + aggregate queries verbatim
// (see src/lib/listingsV2Data.ts for the three documented fixes), metadata and
// the FAQ/Article JSON-LD are preserved, and the page stays force-dynamic.
// The legacy `revalidate = 3600` export was dead under force-dynamic — dropped.
import { generateMetadata as genMeta } from '@/lib/seo';
import { config } from '@/lib/config';
import ListingsV2Page from '@/components/listings/v2/ListingsPage';
import SiteFooter from '@/components/nav/SiteFooter';
import SchemaScript from '@/components/SchemaScript';
import { generateFAQSchema } from '@/lib/schema';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getListingsV2Data, parseListingsQuery } from '@/lib/listingsV2Data';
import { getSession } from '@/lib/auth';
import { getStreetCompareContrast } from '@/lib/comparisonData';

export const dynamic = 'force-dynamic';

// Filter params that turn /listings into a faceted duplicate of the base grid. Their presence
// flips the page to `noindex, follow` while the canonical still points at the clean /listings —
// Google crawls the variant, drops it, and follows the links out. `page` is DELIBERATELY excluded:
// pagination stays crawlable + indexable (canonicalised to base), per the faceted-nav strategy.
const FILTER_PARAMS = ['status', 'type', 'min', 'max', 'maxPrice', 'beds', 'baths', 'neighbourhood', 'q', 'sort'] as const;

export function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Metadata {
  const base = genMeta({
    title: `${config.CITY_NAME} Homes For Sale & Real Estate`,
    description: `Browse ${config.CITY_NAME} ${config.CITY_PROVINCE} homes for sale. View listing photos, property details, and neighbourhood data. Live TREB MLS® data updated daily.`,
    // Every filtered/sorted variant canonicalises to the clean base — the params are a UI
    // affordance, not a distinct page.
    canonical: `${config.SITE_URL}/listings`,
  });
  const hasFilter = FILTER_PARAMS.some((k) => {
    const v = searchParams[k];
    return typeof v === 'string' && v.length > 0;
  });
  // noindex,follow (NOT nofollow) on filtered variants: Google must still follow the links to
  // reach real content and read the canonical.
  return hasFilter ? { ...base, robots: { index: false, follow: true } } : base;
}

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function ListingsPage({ searchParams }: Props) {
  // MC-029: the sold grid was a public list of sold listings with their sold prices. /sold is
  // the gated surface for that; the old URL sends the visitor there.
  if (searchParams.status === 'sold') redirect('/sold');
  const query = parseListingsQuery(searchParams);
  // The page is force-dynamic, so the session is read here, per request, and the loader is
  // told whether the cards may carry the VOW-only facts. The decision is the server's; the
  // anonymous payload never contains them (src/lib/listings/vow.ts).
  const user = await getSession();
  const vow = !!(user && user.vowAcknowledgedAt);
  // City-wide freehold-vs-condo contrast for the CompareModule teaser — same
  // hoisted memoized-promise seam the street pages use (one resolution per
  // process; /listings is force-dynamic so this is a warm-cache hit per request).
  const [data, compareContrast] = await Promise.all([
    getListingsV2Data(query, { vow }),
    getStreetCompareContrast(),
  ]);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `About ${config.CITY_NAME} ${config.CITY_PROVINCE} Real Estate`,
    description: `An overview of the ${config.CITY_NAME} real estate market — growth, property mix, and why working with a local specialist matters.`,
    author: { '@type': 'Person', name: config.realtor.name },
    publisher: { '@type': 'Organization', name: config.SITE_NAME },
    datePublished: '2026-04-01',
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <>
      <SchemaScript schemas={[generateFAQSchema(data.faqs), articleSchema]} />
      <ListingsV2Page data={data} compareContrast={compareContrast} />
      <SiteFooter />
    </>
  );
}
