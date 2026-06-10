// src/app/streets-v2-preview/[slug]/page.tsx
// TEMPORARY design-preview route for the forest-v2 street shell. Renders the
// in-memory mock fixtures (no DB — immune to the SSG Neon flake), so the design
// can be reviewed standalone before the data window wires getStreetV2Data() into
// the real /streets/[slug] route. Safe to delete once the cutover lands.
//
//   /streets-v2-preview/main-street-east-milton   -> rich/publishable state
//   /streets-v2-preview/marigold-court-milton      -> thin/sub-k silent state
//
// Not matched by the middleware redirect (matcher is /streets/:path*, a distinct
// segment), so no interference with the legacy navy route.
import { notFound } from 'next/navigation';
import StreetV2Page from '@/components/street/v2/StreetPage';
import { mockStreets } from '@/components/street/v2/mockData';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(mockStreets).map((slug) => ({ slug }));
}

export const metadata = {
  title: 'Street v2 — design preview',
  robots: { index: false, follow: false },
};

export default function StreetV2Preview({ params }: { params: { slug: string } }) {
  const data = mockStreets[params.slug];
  if (!data) notFound();
  return <StreetV2Page data={data} />;
}
