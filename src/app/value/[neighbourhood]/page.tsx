// src/app/value/[neighbourhood]/page.tsx
//
// Door-hanger QR valuation landing. Per-NEIGHBOURHOOD now; the route is
// shaped so a future /value/[neighbourhood]/[street] nests cleanly — same
// <ValueLanding> shell + same HomeValuationCard, only the data fetch swaps
// to street grain (getStreetPageData). Do not foreclose that here.
//
// noindex, follow (print/paid surface, kept out of Google, no thin-page dilution; its links are
// still followed). ChromeGate suppresses the global navy Navbar for /value; SiteNav (rendered
// by ValueLanding) owns the chrome, mirroring /sales/ads + /sell.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40): every figure is gone ("N homes sold ...
// typical sold ... median days on market"), and with them the getHubData call that read them.
// The page reads the Neighbourhood row and nothing else.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import ValueLanding from "@/components/value/ValueLanding";
import { getMegaLive } from "@/lib/megaLive";
import "../../sell/sell-theme.css";
import "../value-theme.css";

// ISR, hourly (the menu's live content is the only thing on the page that moves).
export const revalidate = 3600;

// Prebuild all 24 canonical neighbourhood slugs. Unknown slugs fall through
// to notFound() (404) below.
export async function generateStaticParams() {
  const rows = await prisma.neighbourhood.findMany({ select: { slug: true } });
  return rows.map((r) => ({ neighbourhood: r.slug }));
}

export async function generateMetadata(
  { params }: { params: { neighbourhood: string } },
): Promise<Metadata> {
  const nb = await prisma.neighbourhood.findUnique({
    where: { slug: params.neighbourhood },
    select: { name: true },
  });
  const name = nb?.name ?? config.CITY_NAME;
  return {
    ...genMeta({
      title: `See Your Home's Value: ${name}, ${config.CITY_NAME}`,
      description: `Free, no-obligation home valuation for ${name}, ${config.CITY_NAME}, prepared by hand by ${config.realtor.name} from local sold data, not an algorithm.`,
      canonical: `${config.SITE_URL}/value/${params.neighbourhood}`,
      noIndex: true,
    }),
    // noindex, FOLLOW (MC-046 ruling 9); the shared helper's noIndex also sets nofollow.
    robots: { index: false, follow: true },
  };
}

export default async function ValueNeighbourhoodPage(
  { params }: { params: { neighbourhood: string } },
) {
  const slug = params.neighbourhood;

  const nb = await prisma.neighbourhood.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!nb) notFound();

  return (
    <ValueLanding
      locationName={nb.name}
      soldViewHref={`/sold?nbhd=${encodeURIComponent(slug)}`}
      returnPath={`/value/${slug}`}
      live={await getMegaLive().catch(() => undefined)}
    />
  );
}
