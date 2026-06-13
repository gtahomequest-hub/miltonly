// src/components/listings/v2/ListingsPage.tsx
// The forest-v2 listings (MLS search) shell. Pure presentational — the data
// window wires getListingsV2Data(query) and renders
// <ListingsV2Page data={data} />, mirroring the hub/condo/street cutovers.
// Composition: hero (modes + keyword search) → stats overlap band → sticky
// filter rail + results (grid | map split) → hood band → streets → schools →
// alert CTA → FAQ → TREB attribution. basePath defaults to /listings; the
// design preview passes its own route so filters round-trip against mocks.

import './listings-theme.css';
import type { ListingsV2Data } from './types';
import { SiteNav } from '../../nav/SiteNav';
import { ResultsClient } from './ResultsClient';
import {
  ListingsHero,
  StatsBand,
  HoodBand,
  StreetsStrip,
  SchoolsStrip,
  AlertBand,
  FaqSection,
  Attribution,
} from './sections';

export function ListingsV2Page({
  data,
  basePath = '/listings',
}: {
  data: ListingsV2Data;
  basePath?: string;
}) {
  return (
    <div className="listings-v2">
      <SiteNav variant="page" />
      <ListingsHero data={data} basePath={basePath} />
      <StatsBand data={data} />
      <ResultsClient data={data} basePath={basePath} />
      <HoodBand data={data} />
      <StreetsStrip data={data} />
      <SchoolsStrip data={data} />
      <AlertBand />
      <FaqSection data={data} />
      <Attribution avgPrice={data.stats.avgPrice} />
    </div>
  );
}

export default ListingsV2Page;
