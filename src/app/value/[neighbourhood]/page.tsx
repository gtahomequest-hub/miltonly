// src/app/value/[neighbourhood]/page.tsx
//
// Door-hanger QR valuation landing. Per-NEIGHBOURHOOD now; the route is
// shaped so a future /value/[neighbourhood]/[street] nests cleanly — same
// <ValueLanding> shell + same HomeValuationCard, only the data fetch swaps
// to street grain (getStreetPageData). Do not foreclose that here.
//
// noindex (print/paid surface — kept out of Google, no thin-page dilution).
// ChromeGate suppresses the global navy Navbar for /value; SiteNav (rendered
// by ValueLanding) owns the chrome, mirroring /sales/ads + /sell.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHubData } from "@/lib/hubData";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import ValueLanding, { type ValueData } from "@/components/value/ValueLanding";
import "../../sell/sell-theme.css";
import "../value-theme.css";

// ISR: rebuild the baseline hourly so live sold numbers don't freeze at
// build time (getHubData's own Neon fetch cache is also 3600s).
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
  return genMeta({
    title: `See Your Home's Value — ${name}, ${config.CITY_NAME}`,
    description: `Free, no-obligation home valuation for ${name}, ${config.CITY_NAME} — prepared by hand by ${config.realtor.name} from local sold data, not an algorithm.`,
    canonical: `${config.SITE_URL}/value/${params.neighbourhood}`,
    noIndex: true,
  });
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

  // Same seam /neighbourhoods/[slug] uses. Null (unpublished hub) OR k-anon-
  // silent (thin sales) => the number-free editorial variant. No fabrication.
  const hub = await getHubData(slug);
  const grounded =
    hub != null &&
    hub.stats.typicalPrice != null &&
    hub.stats.sold12mo != null &&
    hub.stats.sold12mo > 0;

  const data: ValueData | null = grounded
    ? {
        typicalPrice: hub!.stats.typicalPrice as number,
        sold12mo: hub!.stats.sold12mo as number,
        dom: hub!.stats.dom,
      }
    : null;

  return <ValueLanding locationName={nb.name} data={data} />;
}
