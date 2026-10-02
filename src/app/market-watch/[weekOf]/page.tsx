// src/app/market-watch/[weekOf]/page.tsx
// One archived edition's address, addressed by the Monday its week commences.
//
// MC-046 Stage 1 (R6, R4): the edition's content was sold statistics derived from VOW records, so it
// is no longer rendered to anyone. A published week still answers 200 with its heading and the
// neutral line, `noindex, follow`, with a figure-free head; an unknown week is a 404. The lookup
// selects the week alone, never sectionsJson, the summary, the interpretation or the stored meta.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import MarketWatchPage, { weekOfLabel } from "@/components/marketwatch/MarketWatchPage";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";

export const dynamic = "force-dynamic";

async function exists(weekOf: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) return false;
  const row = await prisma.marketEdition.findFirst({
    where: { weekOf, status: "published" },
    select: { weekOf: true },
  });
  return !!row;
}

export async function generateMetadata({
  params,
}: {
  params: { weekOf: string };
}): Promise<Metadata> {
  if (!(await exists(params.weekOf))) return genMeta({ title: "Edition not found", noIndex: true });
  const label = weekOfLabel(params.weekOf);
  const meta = genMeta({
    title: `${config.CITY_NAME} Market Watch, week of ${label}`,
    description: `${config.CITY_NAME} Market Watch for the week of ${label}. Sold history is for registered readers; ${config.CITY_NAME} homes for sale and for lease are open to everyone.`,
    canonical: `${config.SITE_URL}/market-watch/${params.weekOf}`,
  });
  return { ...meta, robots: { index: false, follow: true } };
}

export default async function EditionPage({ params }: { params: { weekOf: string } }) {
  if (!(await exists(params.weekOf))) notFound();
  return (
    <>
      <SiteNavLive variant="page" />
      <MarketWatchPage weekOf={params.weekOf} />
      <SiteFooter />
    </>
  );
}
