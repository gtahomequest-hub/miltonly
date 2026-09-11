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
  StreetGlance,
  StreetAreaContext,
  StreetBody,
  StreetTypes,
  StreetMarket,
  StreetCommute,
  StreetInventory,
  StreetContext,
  StreetFaq,
  StreetFinalCtas,
} from './sections';
import { StreetAddresses } from './AddressLadder';
import SiteNavLive from '../../nav/SiteNavLive';
import { CompareModule, type CompareContrast } from '../../compare/CompareModule';
import { COMPARE_TEASER } from '@/lib/comparisonData';
import { GuideUplinks } from '../../guides/GuideUplinks';
import { guidesForStreet } from '@/lib/guides/uplinks';

// FIRST off-hub placement of the standalone CompareModule. A street buyer is
// implicitly choosing freehold vs condo, so the existing freehold-vs-condo teaser
// (COMPARE_TEASER, same as the hubs) is the right nudge. Dropped after the market
// section ("you've seen the prices -> deciding freehold vs condo?"). Additive only
// -- it touches none of the street's own data/stats/lead-flow/VOW. compareContrast
// is optional (city-wide medians, cached upstream); the module degrades to its sub
// text if absent. street-v2 is NOT .hub-v2, so the module proves its self-contained
// var(--h-x, <fallback>) CSS renders forest off-hub.
export function StreetV2Page({
  data,
  compareContrast,
}: {
  data: StreetV2Data;
  compareContrast?: CompareContrast | null;
}) {
  // MC-003 guide up-links. Condo-heavy means a condo sale pill renders in the hero, which is
  // the same marker the battery's guide-links check reads off the served page.
  const guides = guidesForStreet({ condoHeavy: data.hero.salePills.some((p) => p.type === 'condo') });
  return (
    <div className="street-v2">
      <SiteNavLive variant="page" />
      <StreetHero data={data} />
      <StreetVideo data={data} />
      <StreetGlance data={data} />
      <StreetAreaContext data={data} />
      <StreetBody data={data} />
      <StreetTypes data={data} />
      <StreetMarket data={data} />
      <CompareModule {...COMPARE_TEASER.freehold} contrast={compareContrast} />
      <StreetCommute data={data} />
      <StreetInventory data={data} />
      <StreetAddresses data={data} />
      <StreetContext data={data} />
      <GuideUplinks guides={guides} context={data.name} variant="street" />
      <StreetFaq data={data} />
      <StreetFinalCtas data={data} />
    </div>
  );
}

export default StreetV2Page;
