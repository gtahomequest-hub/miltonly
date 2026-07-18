import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getStreetPageData, canonicalUrlFor } from "@/lib/street-data";
import { mapStreetV2Data } from "@/lib/streetV2Data";
import { buildStreetPageSchema } from "@/lib/schema/street-schema";
import { SchemaInjector } from "@/lib/schema/injector";
import { roundPriceForProse } from "@/lib/format";
import { formatCAD } from "@/lib/charts/theme";
import { loadStreetGeneration } from "@/lib/ai/loadStreetGeneration";
import type { StreetSection, FAQItem } from "@/types/street";
import StreetV2Page from "@/components/street/v2/StreetPage";
import { getStreetCompareContrast } from "@/lib/comparisonData";
import { prisma } from "@/lib/prisma";

interface Props { params: { slug: string } }

export async function generateStaticParams() {
  const streets = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true },
  });
  return streets.map((s) => ({ slug: s.streetSlug }));
}

export const dynamicParams = true;

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStreetPageData(params.slug);
  if (!data) return { title: "Street Not Found" };

  // SERP override (GSC 2026-07-18 keyword report): "bennett boulevard milton"
  // sits on page 1 (pos 7.6) with zero clicks. Slug-scoped rewrite leading
  // with the searcher's words; the shared title formula below is unchanged.
  if (params.slug === "bennett-boulevard-milton") {
    const tx = data.heroProps.rawTotalTransactions ?? 0;
    const title = `${data.street.name}, Milton — Homes, Sales & Street Guide`;
    const description =
      `${data.street.name} in Milton's Beaty neighbourhood — ` +
      `${tx > 0 ? `every sale on file (${tx} transactions tracked), ` : ""}` +
      `current listings, and the full street read: home types, prices, and how the street trades.`;
    const og = `${title} | ${config.SITE_NAME}`;
    return {
      title,
      description,
      alternates: { canonical: canonicalUrlFor(params.slug) },
      openGraph: { title: og, description, url: canonicalUrlFor(params.slug), type: "article" },
      twitter: { card: "summary_large_image", title: og, description },
    };
  }

  // Round prices for prose surfaces (title, meta description, og:title).
  // Schema.org markup keeps the precise DB value — see buildStreetPageSchema.
  const rawPrice = data.heroProps.rawTypicalPrice ?? null;
  const priceStr = rawPrice ? formatCAD(roundPriceForProse(rawPrice)) : "";
  const tx = data.heroProps.rawTotalTransactions ?? 0;

  const summary = priceStr
    ? `Typical ${priceStr}${tx > 0 ? `, ${tx} transactions on file` : ""}`
    : `Street profile with live market data`;

  const baseTitle = `${data.street.name}, ${config.CITY_NAME}, ${summary}`;
  const ogTitle = `${baseTitle} | ${config.SITE_NAME}`;
  const description =
    `${data.street.name} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}. ${data.street.characterSummary || summary}`.trim();

  return {
    title: baseTitle,
    description,
    alternates: { canonical: canonicalUrlFor(params.slug) },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrlFor(params.slug),
      type: "article",
    },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export default async function StreetPage({ params }: Props) {
  const [data, generation] = await Promise.all([
    getStreetPageData(params.slug),
    loadStreetGeneration(params.slug),
  ]);
  if (!data) notFound();

  // ── JSON-LD (unchanged from the legacy page — streets are indexed) ──────────
  // Schema sources from the generation-aware sections + FAQ when a succeeded
  // StreetGeneration exists; otherwise the legacy-shape fallback. Placeholder mode
  // (no generation) -> faqs=[] so the FAQPage node is omitted, same as before.
  const schemaSections: StreetSection[] = generation
    ? generation.sections
    : ((data.descriptionBody?.sections ?? []) as Array<{ id?: string; heading: string; paragraphs: string[] }>).map(
        (s) => ({ id: isKnownSectionId(s.id) ? s.id : "about", heading: s.heading, paragraphs: s.paragraphs }),
      );
  const faqs: FAQItem[] = generation ? generation.faq.map((f) => ({ question: f.question, answer: f.answer })) : [];
  const schema = buildStreetPageSchema(data, { faqs, sections: schemaSections });

  // ── Render: forest-v2 shell from the vetted data (restyle only) ─────────────
  const v2 = mapStreetV2Data(data, generation);

  // Live freehold-vs-condo median contrast for the CompareModule teaser. City-wide
  // (same on every street) + cached -> one DB pass shared across all street pages.
  const compareContrast = await getStreetCompareContrast();

  return (
    <>
      <SchemaInjector schema={schema} />
      <StreetV2Page data={v2} compareContrast={compareContrast} />
    </>
  );
}

const KNOWN_SECTION_IDS = new Set([
  "about",
  "homes",
  "amenities",
  "market",
  "gettingAround",
  "schools",
  "bestFitFor",
  "differentPriorities",
]);
function isKnownSectionId(v: unknown): v is StreetSection["id"] {
  return typeof v === "string" && KNOWN_SECTION_IDS.has(v);
}
