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
import FooterSection from '@/components/sections/FooterSection';
import SchemaScript from '@/components/SchemaScript';
import { generateFAQSchema } from '@/lib/schema';
import { getListingsV2Data, parseListingsQuery } from '@/lib/listingsV2Data';

export const dynamic = 'force-dynamic';

export const metadata = genMeta({
  title: `${config.CITY_NAME} Homes For Sale & Real Estate`,
  description: `Browse ${config.CITY_NAME} ${config.CITY_PROVINCE} homes for sale. View listing photos, property details, and neighbourhood data. Live TREB MLS® data updated daily.`,
  canonical: `${config.SITE_URL}/listings`,
});

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function ListingsPage({ searchParams }: Props) {
  const query = parseListingsQuery(searchParams);
  const data = await getListingsV2Data(query);

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
      <ListingsV2Page data={data} />
      <FooterSection />
    </>
  );
}
