// src/app/listings-v2-preview/page.tsx
// TEMPORARY design-preview route for the forest-v2 listings shell. Renders the
// in-memory mock fixtures (no DB) through the SAME URL param contract the live
// /listings page uses — so filters, sort, keyword search, pagination, the map
// toggle, and every card state can be reviewed end-to-end before the data
// window wires getListingsV2Data() into the real route. Safe to delete after
// the cutover.
//
//   /listings-v2-preview                       -> full active grid
//   /listings-v2-preview?status=rent           -> lease cards (/mo, amber pill)
//   /listings-v2-preview?status=sold           -> sold treatment
//   /listings-v2-preview?beds=4&type=detached  -> filter round-trip proof
//   /listings-v2-preview?q=scott               -> keyword search proof
import ListingsV2Page from '@/components/listings/v2/ListingsPage';
import { parseQuery, queryMocks } from '@/components/listings/v2/mockData';

export const dynamic = 'force-dynamic'; // searchParams drive the mock query engine

export const metadata = {
  title: 'Listings v2 — design preview',
  robots: { index: false, follow: false },
};

export default function ListingsV2Preview({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = queryMocks(parseQuery(searchParams));
  return <ListingsV2Page data={data} basePath="/listings-v2-preview" />;
}
