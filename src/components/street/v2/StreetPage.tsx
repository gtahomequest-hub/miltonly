// src/components/street/v2/StreetPage.tsx
// The forest-v2 street shell. Pure presentational — the data window wires
// getStreetV2Data(slug) and renders <StreetV2Page data={data} />, mirroring the
// hub/condo cutover. Render order matches the legacy navy page so the cutover is
// a like-for-like restyle (PatternBlock / NeighbourhoodSoldBlock intentionally
// absent — dormant / not on this page).
import './street-theme.css';
import type { StreetV2Data } from './types';
import {
  StreetHero,
  StreetVideo,
  StreetBody,
  StreetTypes,
  StreetSoldHistory,
  StreetCommute,
  StreetInventory,
  StreetContext,
  StreetFaq,
  StreetFinalCtas,
} from './sections';
import { StreetAddresses } from './AddressLadder';
import SiteNavLive from '../../nav/SiteNavLive';
import SiteFooter from '../../nav/SiteFooter';
import { CompareModule, type CompareContrast } from '../../compare/CompareModule';
import { COMPARE_TEASER } from '@/lib/comparisonData';
import { GuideUplinks } from '../../guides/GuideUplinks';
import { guidesForStreet } from '@/lib/guides/uplinks';

// FIRST off-hub placement of the standalone CompareModule. A street buyer is
// implicitly choosing freehold vs condo, so the existing freehold-vs-condo teaser
// (COMPARE_TEASER, same as the hubs) is the right nudge. It sits after the sold-history
// section. Additive only -- it touches none of the street's own data/stats/lead-flow/VOW.
// compareContrast is optional (city-wide typical ASKING prices of active listings, cached
// upstream; CompareModule labels the line "Typical asking", MC-046); the module degrades to its
// sub text if absent. street-v2 is NOT .hub-v2, so the module proves its self-contained
// var(--h-x, <fallback>) CSS renders forest off-hub.
export function StreetV2Page({
  data,
  compareContrast,
}: {
  data: StreetV2Data;
  compareContrast?: CompareContrast | null;
}) {
  // MC-003 guide up-links. Condo-heavy is read off the IDX now (MC-046): a condo type card, i.e.
  // an active condo listing on the street. It was the condo SALE pill, which left the hero with
  // every other sold figure; a guide link keyed on sold volume would say what the pill said.
  const hubSlugs = data.context.neighbourhoods.map((n) => n.slug);
  const guides = guidesForStreet({ condoHeavy: data.productTypes.some((t) => t.type === 'condo'), hubSlugs });
  // THE PAGE IN THE CHROME (MH-006). The nav's CTA, the brief form and the strips follow the
  // street and its hub; the footer's brief form records the same.
  const hub = data.context.neighbourhoods[0];
  const navContext = { street: { slug: data.slug, name: data.name }, hub: hub ? { slug: hub.slug, name: hub.name } : undefined };
  return (
    <div className="street-v2">
      <SiteNavLive variant="page" context={navContext} />
      <StreetHero data={data} soldLine={{ soldViewHref: '#sold-records' }} />
      <StreetVideo data={data} />
      <StreetBody data={data} />
      <StreetTypes data={data} />
      <StreetSoldHistory data={data} />
      <CompareModule {...COMPARE_TEASER.freehold} contrast={compareContrast} />
      <StreetCommute data={data} />
      <StreetInventory data={data} />
      <StreetAddresses data={data} />
      <StreetContext data={data} />
      <GuideUplinks guides={guides} context={data.name} variant="street" hubs={hubSlugs} />
      <StreetFaq data={data} />
      <StreetFinalCtas data={data} />
      {/* THE FOOTER (MH-006, MA-004 change 2). 509 street pages ended here with no path to a
          hub, another street, a guide, sold data or the legal pages except back up to the
          bar, and contributed nothing to the footer link graph. The same map every page has. */}
      <SiteFooter context={navContext} />
    </div>
  );
}

export default StreetV2Page;
