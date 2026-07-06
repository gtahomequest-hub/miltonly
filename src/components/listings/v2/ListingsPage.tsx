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
import { CompareModule, type CompareContrast } from '../../compare/CompareModule';
import { COMPARE_TEASER } from '@/lib/comparisonData';
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

// SECOND off-hub placement of the standalone CompareModule (street-v2 was the
// first). A buyer browsing all listings is implicitly choosing an ownership
// type; the freehold-vs-condo teaser lands after they've browsed the results,
// not as an ad blocking them. Purely additive — touches none of the filter
// contract, where-builder pipeline, map, redaction, or lead flows.
// compareContrast is optional; null/omitted -> the teaser's text sub only.
export function ListingsV2Page({
  data,
  basePath = '/listings',
  compareContrast,
}: {
  data: ListingsV2Data;
  basePath?: string;
  compareContrast?: CompareContrast | null;
}) {
  return (
    <div className="listings-v2">
      <SiteNav variant="page" />
      <ListingsHero data={data} basePath={basePath} />
      <StatsBand data={data} />
      <ResultsClient data={data} basePath={basePath} />
      <CompareModule {...COMPARE_TEASER.freehold} contrast={compareContrast} />
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
