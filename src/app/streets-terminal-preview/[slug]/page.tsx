// src/app/streets-terminal-preview/[slug]/page.tsx
// PROTOTYPE design-preview route for the two-layer / terminal street page. One street only
// (clarriage-court-milton). noindex via metadata; sitemap-absent (not added to sitemap.ts);
// robots-excluded (robots.ts disallows /streets-terminal-preview). Distinct segment, so the
// /streets/:path* middleware matcher never touches it. Renders LIVE data (force-dynamic — no SSG).
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getClarriageFacts, CLARRIAGE_LAYER2 } from '@/lib/proto/clarriageData';
import { TerminalStreetPage } from '@/components/proto/TerminalStreetPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clarriage Court — two-layer prototype (preview)',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function TerminalPreview({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { listings?: string };
}) {
  if (params.slug !== 'clarriage-court-milton') notFound();
  const facts = await getClarriageFacts();
  // PREVIEW-ONLY inspection switches (this route is noindex + robots-disallowed + sitemap-absent).
  //   ?listings=none  -> the no-active-inventory case, which is what MOST streets look like.
  //   ?listings=N     -> LAYOUT PROBE. Clarriage has exactly one active listing, so the 2-3 row and
  //                      the 4+ overflow branches would otherwise ship unverified. This repeats the
  //                      one REAL listing N times to exercise those layouts — it invents no property,
  //                      no price and no address, and it exists only on this preview route.
  const mode = searchParams?.listings;
  const n = mode && /^[2-9]$/.test(mode) ? Number(mode) : null;
  const view =
    mode === 'none' ? { ...facts, activeListings: [] }
    : n && facts.activeListings.length > 0
      ? { ...facts, activeListings: Array.from({ length: n }, (_, i) => ({ ...facts.activeListings[0], mlsNumber: `${facts.activeListings[0].mlsNumber}-probe${i}` })) }
      : facts;
  return <TerminalStreetPage facts={view} analysis={CLARRIAGE_LAYER2} />;
}
