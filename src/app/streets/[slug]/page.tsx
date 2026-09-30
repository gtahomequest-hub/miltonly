import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getStreetPageData, canonicalUrlFor } from "@/lib/street-data";
import { mapStreetV2Data } from "@/lib/streetV2Data";
import { buildStreetPageSchema } from "@/lib/schema/street-schema";
import { SchemaInjector } from "@/lib/schema/injector";
import { loadStreetGeneration } from "@/lib/ai/loadStreetGeneration";
import { topStreetSlugsForPrerender } from "@/lib/streetPrerender";
import type { StreetSection, FAQItem } from "@/types/street";
import StreetV2Page from "@/components/street/v2/StreetPage";
import StreetMinimalPage from "@/components/street/v2/StreetMinimalPage";
import { getMinimalStreetView } from "@/lib/streetMinimal";
import { getStreetCompareContrast } from "@/lib/comparisonData";
import { streetTitle, streetMeta, addressRangeOf, STREET_NOT_FOUND_METADATA } from "@/lib/streetHead";
import { townAddressesForSlug } from "@/lib/town/addresses";

interface Props { params: { slug: string } }

// MC-035: on production the build prerenders every published street (src/lib/streetPrerender.ts,
// keyed on VERCEL_ENV); a preview prerenders the top fifty and the rest render on first visit
// under dynamicParams and the hour's revalidate below. The publish floor (an unpublished slug
// 404s) is unchanged.
export async function generateStaticParams() {
  const slugs = await topStreetSlugsForPrerender();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = true;

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStreetPageData(params.slug);
  if (!data) return STREET_NOT_FOUND_METADATA;

  // THE HEAD (MC-048). One title format and one meta shape, built from the name the H1 shows and
  // the Town's own addresses for this street, with nothing sold-derived in either: the format, its
  // length ladder and the reasons are in src/lib/streetHead.ts, and scripts/test-street-head.ts
  // holds every street to it at prebuild. The price-led head this replaced (MH-005, MA-001 change 6)
  // put a typical price and a sales count in the snippet. FROZEN until the 28-day GSC re-read against
  // scratchpad/mc048/baseline/: no title, meta or H1 change on street pages before then.
  const { title } = streetTitle(data.street.name);
  const town = townAddressesForSlug(params.slug);
  const { description } = streetMeta(data.street.name, addressRangeOf(town?.addresses.map((a) => a.n)));
  // og:image is the filmed poster where there is one and the rendered card otherwise
  // (/streets/<slug>/og.png), so a shared link has a card.
  const poster = data.video?.day?.poster ?? data.video?.night?.poster ?? null;
  const image = poster ?? `${config.SITE_URL}/streets/${params.slug}/og.png`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrlFor(params.slug) },
    openGraph: {
      title,
      description,
      url: canonicalUrlFor(params.slug),
      type: "article",
      modifiedTime: data.lastUpdated,
      images: [{ url: image, width: 1200, height: 630, alt: `${data.street.name}, ${config.CITY_NAME}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function StreetPage({ params }: Props) {
  // Minimal-template branch (registry ingest): a deliberately-published street with no
  // generated profile renders the deterministic layout, NOT the generated page. Its JSON-LD
  // carries no FAQ and no section prose. Standard pages (template='standard') follow below.
  const minimal = await getMinimalStreetView(params.slug);
  if (minimal) {
    const data = await getStreetPageData(params.slug);
    if (!data) notFound();
    const v2 = mapStreetV2Data(data, null);
    v2.eyebrow = minimal.eyebrow;
    v2.subtitle = minimal.whereItIs;
    const schema = buildStreetPageSchema(data, { faqs: [], sections: [] });
    return (
      <>
        <SchemaInjector schema={schema} />
        <StreetMinimalPage data={v2} view={minimal} />
      </>
    );
  }

  const [data, generation] = await Promise.all([
    getStreetPageData(params.slug),
    loadStreetGeneration(params.slug),
  ]);
  if (!data) notFound();

  // ── Render: forest-v2 shell from the vetted data (restyle only) ─────────────
  const v2 = mapStreetV2Data(data, generation);

  // ── JSON-LD, FROM THE SAME SUPPRESSED PROSE THE PAGE RENDERS ───────────────
  // It used to read `generation.sections` and `generation.faq` RAW, which meant the
  // structured data bypassed every suppression pass the visible page goes through —
  // numeric sentences, absence claims, dangling openers, disclaimer-only sections, and
  // the figure-denial gate added in this commit. Caught by grepping the served HTML
  // rather than the stripped text: aird-court's visible prose was clean while its
  // FAQPage node still told Google "A reliable street-level price isn't available".
  //
  // Schema is a PUBLISHED SURFACE. It gets the same copy the reader gets — one
  // suppression pass, one set of prose, no second path to the index.
  const schemaSections: StreetSection[] = generation
    ? v2.sections.map((s) => ({ id: isKnownSectionId(s.id) ? s.id : "about", heading: s.heading, paragraphs: s.paragraphs }))
    : ((data.descriptionBody?.sections ?? []) as Array<{ id?: string; heading: string; paragraphs: string[] }>).map(
        (s) => ({ id: isKnownSectionId(s.id) ? s.id : "about", heading: s.heading, paragraphs: s.paragraphs }),
      );
  const faqs: FAQItem[] = generation ? v2.faqs.map((f) => ({ question: f.question, answer: f.answer })) : [];
  const schema = buildStreetPageSchema(data, { faqs, sections: schemaSections });

  // Live freehold-vs-condo ASKING median contrast (active listings) for the CompareModule
  // teaser; StreetV2Page labels both sides "asking". City-wide (same on every street) + cached
  // -> one DB pass shared across all street pages.
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
