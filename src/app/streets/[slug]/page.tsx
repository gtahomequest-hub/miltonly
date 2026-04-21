import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getStreetPageData, canonicalUrlFor } from "@/lib/street-data";
import { getStreetSoldList } from "@/lib/sold-data";
import { buildStreetPageSchema } from "@/lib/schema/street-schema";
import { SchemaInjector } from "@/lib/schema/injector";
import { Container } from "@/components/ui";
import { roundPriceForProse } from "@/lib/format";
import { formatCAD } from "@/lib/charts/theme";
import { loadStreetGeneration } from "@/lib/ai/loadStreetGeneration";
import type { StreetPageData, StreetSection, StreetFAQItem, FAQItem } from "@/types/street";

import { StreetHero } from "@/components/street/StreetHero";
import { DescriptionSidebar } from "@/components/street/DescriptionSidebar";
import { DescriptionBody } from "@/components/street/DescriptionBody";
import { InlineCTASection } from "@/components/street/InlineCTASection";
import { TypeSection } from "@/components/street/TypeSection";
import { AtAGlanceGrid } from "@/components/street/AtAGlanceGrid";
import { PatternBlock } from "@/components/street/PatternBlock";
import { MarketActivity } from "@/components/street/MarketActivity";
import { CommuteGrid } from "@/components/street/CommuteGrid";
import { ActiveInventory } from "@/components/street/ActiveInventory";
import { ContextCards } from "@/components/street/ContextCards";
import { FAQ } from "@/components/street/FAQ";
import { FinalCTAs } from "@/components/street/FinalCTAs";
import { CornerWidget } from "@/components/street/CornerWidget";
import { ExitIntent } from "@/components/street/ExitIntent";

interface Props { params: { slug: string } }

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStreetPageData(params.slug);
  if (!data) return { title: "Street Not Found" };

  // Round prices for prose surfaces (title, meta description, og:title).
  // Schema.org markup keeps the precise DB value — see buildStreetPageSchema.
  const rawPrice = data.heroProps.rawTypicalPrice ?? null;
  const priceStr = rawPrice ? formatCAD(roundPriceForProse(rawPrice)) : "";
  const tx = data.heroProps.rawTotalTransactions ?? 0;

  const summary = priceStr
    ? `Typical ${priceStr}${tx > 0 ? `, ${tx} transactions on file` : ""}`
    : `Street profile with live market data`;

  // Base title gets the layout template appended (" | Miltonly"); the og/twitter
  // paths don't apply that template so we embed the brand explicitly.
  const baseTitle = `${data.street.name}, Milton, ${summary}`;
  const ogTitle = `${baseTitle} | Miltonly`;
  const description =
    `${data.street.name} in Milton, Ontario. ${data.street.characterSummary || summary}`.trim();

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
  const [data, user, generation] = await Promise.all([
    getStreetPageData(params.slug),
    getSession(),
    // Phase 4.1 generated description. Null means "no generation on file, or
    // stale/corrupt row" — caller falls back to the legacy description shape
    // below. Never generates on-demand at render time.
    loadStreetGeneration(params.slug),
  ]);
  if (!data) notFound();

  const canSeeRecords = !!(user && user.vowAcknowledgedAt);

  // Fetch sold records only for users cleared through the VOW gate. The
  // canServeRecordsToThisRequest() guard inside getStreetSoldList will
  // also refuse if we miscomputed — belt + suspenders.
  const soldTable = canSeeRecords
    ? await getStreetSoldList(params.slug, "sale", 90, 20).catch(() => [])
    : [];

  const marketProps = {
    ...data.marketActivity,
    soldTable,
    canSeeRecords,
  };

  const ownerCtaPrice = pickOwnerCtaPrice(data);
  const contextHasContent = hasContextContent(data);

  // Description body: generated if a valid succeeded StreetGeneration row
  // exists; otherwise a legacy-shape fallback from street-data.ts (also
  // handles streets where content has never been generated).
  const descriptionBodyProps = resolveDescriptionBody(data, generation);

  // FAQ: prefer generated FAQ when present; fall back to the legacy
  // template FAQs from street-data.
  const faqs: FAQItem[] = generation
    ? generation.faq.map((f) => ({ question: f.question, answer: f.answer }))
    : data.faqs;

  // Schema builder consumes the resolved FAQ + 8-section body so JSON-LD
  // surfaces the generation's prose when available (FAQPage count, Alternatives
  // ItemList). Falls back to the legacy-shape values when no generation row
  // exists. See buildStreetPageSchema signature.
  const schema = buildStreetPageSchema(data, {
    faqs,
    sections: descriptionBodyProps.sections,
  });

  return (
    <>
      <SchemaInjector schema={schema} />

      <StreetHero {...data.heroProps} />

      <section className="border-b" style={{ paddingTop: 96, paddingBottom: 96, borderColor: "var(--line)" }}>
        <Container>
          <div className="description-grid">
            <DescriptionSidebar {...data.descriptionSidebar} />
            <DescriptionBody
              {...descriptionBodyProps}
              inlineSlot={
                ownerCtaPrice > 0 ? (
                  <InlineCTASection
                    variant="owner"
                    streetShort={data.street.shortName}
                    typicalPrice={ownerCtaPrice}
                  />
                ) : null
              }
              inlineSlotAfter={0}
            />
          </div>
        </Container>
      </section>

      {data.productTypes.map((pt) => (
        <TypeSection key={pt.type} {...pt} />
      ))}

      <AtAGlanceGrid tiles={data.glanceTiles} />

      {data.detectedPattern && <PatternBlock {...data.detectedPattern} />}

      <MarketActivity {...marketProps} />

      <CommuteGrid {...data.commuteGrid} />

      <ActiveInventory {...data.activeInventory} />

      {contextHasContent && <ContextCards {...data.contextCards} />}

      <FAQ faqs={faqs} />

      <FinalCTAs {...data.finalCTAs} />

      <CornerWidget {...data.cornerWidget} />
      <ExitIntent streetName={data.street.name} streetShort={data.street.shortName} />
    </>
  );
}

function pickOwnerCtaPrice(data: StreetPageData): number {
  const firstTyped = data.productTypes.find((p) => p.typicalPrice > 0);
  return firstTyped?.typicalPrice ?? 0;
}

function hasContextContent(data: StreetPageData): boolean {
  const { similarStreets, neighbourhoods, schools } = data.contextCards;
  return similarStreets.length + neighbourhoods.length + schools.length > 0;
}

/**
 * If a generated description exists (status=succeeded, narrowed shape),
 * return the { sections, faq } pair for DescriptionBody. Otherwise, adapt
 * the legacy-shape fallback from street-data.ts (which uses loose section
 * ids like "s1") into the StreetSection strict union. sectionsJson emitted
 * by the legacy path bypasses the StreetSectionId union at the type level
 * via the shape adapter below; this keeps the page renderable on streets
 * that have never been generated.
 */
function resolveDescriptionBody(
  data: StreetPageData,
  generation: { sections: StreetSection[]; faq: StreetFAQItem[] } | null,
): { sections: StreetSection[]; faq: StreetFAQItem[] } {
  if (generation) {
    return { sections: generation.sections, faq: generation.faq };
  }
  // Legacy fallback: street-data's descriptionBody.sections is a loose
  // DescriptionSection[] (id optional, heading, paragraphs). Map it through
  // the approved StreetSectionId union, defaulting unknown ids to "about".
  const legacySections = (data.descriptionBody?.sections ?? []) as Array<{
    id?: string;
    heading: string;
    paragraphs: string[];
  }>;
  const sections: StreetSection[] = legacySections.map((s) => ({
    id: isKnownSectionId(s.id) ? s.id : "about",
    heading: s.heading,
    paragraphs: s.paragraphs,
  }));
  return { sections, faq: [] };
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
