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
  StreetGlance,
  StreetBody,
  StreetTypes,
  StreetMarket,
  StreetCommute,
  StreetInventory,
  StreetContext,
  StreetFaq,
  StreetFinalCtas,
} from './sections';
import { SiteNav } from '../../nav/SiteNav';

export function StreetV2Page({ data }: { data: StreetV2Data }) {
  return (
    <div className="street-v2">
      <SiteNav variant="page" />
      <StreetHero data={data} />
      <StreetGlance data={data} />
      <StreetBody data={data} />
      <StreetTypes data={data} />
      <StreetMarket data={data} />
      <StreetCommute data={data} />
      <StreetInventory data={data} />
      <StreetContext data={data} />
      <StreetFaq data={data} />
      <StreetFinalCtas data={data} />
    </div>
  );
}

export default StreetV2Page;
