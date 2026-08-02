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

export default async function TerminalPreview({ params }: { params: { slug: string } }) {
  if (params.slug !== 'clarriage-court-milton') notFound();
  const facts = await getClarriageFacts();
  return <TerminalStreetPage facts={facts} analysis={CLARRIAGE_LAYER2} />;
}
