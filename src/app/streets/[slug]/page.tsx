import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { config } from "@/lib/config";
import { getStreetPageData, canonicalUrlFor } from "@/lib/street-data";
import { mapStreetV2Data } from "@/lib/streetV2Data";
import { buildStreetPageSchema } from "@/lib/schema/street-schema";
import { SchemaInjector } from "@/lib/schema/injector";
import { roundPriceForProse } from "@/lib/format";
import { formatCAD } from "@/lib/charts/theme";
import { windowDisclosure } from "@/lib/streetEnrichment";
import { loadStreetGeneration } from "@/lib/ai/loadStreetGeneration";
import { topStreetSlugsForPrerender } from "@/lib/streetPrerender";
import type { StreetSection, FAQItem } from "@/types/street";
import StreetV2Page from "@/components/street/v2/StreetPage";
import StreetMinimalPage from "@/components/street/v2/StreetMinimalPage";
import { getMinimalStreetView } from "@/lib/streetMinimal";
import { getStreetCompareContrast } from "@/lib/comparisonData";

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
  if (!data) return { title: "Street Not Found" };

  // Round prices for prose surfaces (meta description, og). Schema.org markup
  // keeps the precise DB value — see buildStreetPageSchema.
  // NOTE ON PROVENANCE: an earlier revision carried a hardcoded per-slug override for
  // bennett-boulevard-milton, and the comment here claimed this formula was "proven by the
  // Bennett SERP rewrite". That claim was false. GSC for /streets/bennett-boulevard-milton
  // over the three months spanning the 2026-07-18 rewrite: 1 click, 38 impressions, 2.6% CTR,
  // position 6.7 — and the single click landed 6 July, twelve days BEFORE the rewrite. Zero
  // clicks after it; impressions flatline from early August. 38 impressions cannot validate
  // anything at page level. The override also emitted a DIFFERENT suffix ("Homes, Sales &
  // Street Guide") from the formula it supposedly proved ("Homes, Prices & Sales History"),
  // so the two were never even the same test. Override removed: a per-slug exception resting
  // on a false claim is worse than no exception. This formula is unvalidated too — treat it
  // as the incumbent to beat, not as evidence.
  // THE PRICE, ITS SAMPLE COUNT AND ITS WINDOW ALL COME FROM ONE BASIS.
  // Two defects were measured in the first pass at this and are fixed here.
  //
  // (1) WRONG WINDOW. saleBasis is graduated: on 53% of priced streets it is window:"full"
  //     (~2 years), not "12mo". Pairing that price with a 12-month count states a figure the
  //     price was never derived from — bergamot-avenue's price comes from 11 sales over ~2
  //     years while the copy claimed "across 4 sales in the last 12 months". windowDisclosure()
  //     is the repo's mandated pairing ("must accompany EVERY published price",
  //     streetEnrichment.ts:182) and emits count and window from the SAME basis object.
  //
  // (2) WRONG SOURCE. There are two 12-month sales counts. rawSoldCount12mo is
  //     stats.sold_count_12months, the nightly DB3 aggregate (street-data.ts:781). The
  //     "Sales tracked" tile reads sale12?.n live (street-data.ts:1206,1218). They drift:
  //     measured 5 disagreements in an 87-street sample (~6%), including two pages emitting
  //     "1 sale" beside a tile reading 0. enrichment.counts.sale12mo is populated from the
  //     identical expression as the tile (street-data.ts:397), so agreement is structural.
  const sb = data.enrichment?.saleBasis ?? null;
  const priceStr = sb ? formatCAD(roundPriceForProse(sb.typical)) : "";

  // SALES AND LEASES ARE COUNTED SEPARATELY, AND NAMED SEPARATELY.
  // This previously read rawTotalTransactions — which is sales + leases (street-data.ts:816) — and
  // called it "recorded sales". On 296 of the 393 pages with any transactions, the number in the
  // SERP snippet disagreed with the "Transactions tracked" tile and the sales-only pill row on the
  // page itself: Gordon Krantz advertised 109 sales beside a tile reading 9; Whitlock 164 beside 5.
  // On 40 pages it claimed sales where the sales count was 0. The snippet's most clickable token
  // was false, and it broke the instant the searcher landed.
  const sales = data.enrichment?.counts.sale12mo ?? 0;
  const leases = data.enrichment?.counts.lease12mo ?? 0;
  const salesPhrase = `${sales} sale${sales === 1 ? "" : "s"} in the last 12 months`;
  const leasePhrase = `${leases} lease${leases === 1 ? "" : "s"} in the last 12 months`;

  // Fail-soft ladder, strongest publishable fact first. A street with leases but no sales now says
  // so, instead of borrowing the word "sale" from a number that was never sales.
  const hook = sb
    ? `homes typically ${priceStr} ${windowDisclosure(sb)}`
    : sales > 0
      ? `${salesPhrase} on record, current listings, and the full street read`
      : leases > 0
        ? `${leasePhrase} on record, current listings, and the full street read`
        : `current listings and the full street read`;

  // THE HEAD (MH-005, MA-001 change 6). No dash and no ampersand in the title; the description
  // opens with the hook, the one clickable fact, and takes as much of the character summary
  // as fits under 155 characters, cut at a word, so the SERP shows the whole of what it shows.
  // og:image is the filmed poster where there is one and the rendered price card otherwise
  // (/streets/<slug>/og.png), so a shared link has a card.
  const baseTitle = `${data.street.name}, ${config.CITY_NAME}: Homes, Prices and Sales History`;
  const ogTitle = `${baseTitle} | ${config.SITE_NAME}`;
  const lead = `${data.street.name}, ${config.CITY_NAME}: ${hook}.`;
  const description = fitDescription(lead, data.street.characterSummary || "", 155);
  const poster = data.video?.day?.poster ?? data.video?.night?.poster ?? null;
  const image = poster ?? `${config.SITE_URL}/streets/${params.slug}/og.png`;

  return {
    title: baseTitle,
    description,
    alternates: { canonical: canonicalUrlFor(params.slug) },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrlFor(params.slug),
      type: "article",
      modifiedTime: data.lastUpdated,
      images: [{ url: image, width: 1200, height: 630, alt: `${data.street.name}, ${config.CITY_NAME}` }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: [image] },
  };
}

export default async function StreetPage({ params }: Props) {
  // Minimal-template branch (registry ingest): a deliberately-published zero/low-
  // sale street renders the honest deterministic layout, NOT the generated page.
  // Standard pages (template='standard', the ~423 live) are untouched below.
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

/** The lead sentence, then as many whole words of the summary as fit under `max`. The lead is
 *  never cut: a hook with its number chopped is worse than a hook alone. */
function fitDescription(lead: string, summary: string, max: number): string {
  const l = lead.replace(/\s+/g, " ").trim();
  const s = summary.replace(/\s+/g, " ").trim();
  if (!s || l.length + 1 >= max) return l;
  const room = max - l.length - 1;
  if (s.length <= room) return `${l} ${s}`;
  const cut = s.slice(0, room);
  const atWord = cut.lastIndexOf(" ");
  const part = (atWord > 20 ? cut.slice(0, atWord) : cut).replace(/[,;:\s]+$/, "");
  return part ? `${l} ${part}.`.slice(0, max) : l;
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
